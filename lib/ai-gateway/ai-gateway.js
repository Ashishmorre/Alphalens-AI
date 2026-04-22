import OpenAI from 'openai';
import {
  TIER_1_FAST,
  TIER_2_HEAVY,
  GROQ_MODELS_FAST,
  GROQ_MODELS_HEAVY
} from './models.js';

// Hard timeout per model attempt. If NVIDIA hasn't replied within this window,
// we abandon it and fall through to Groq — preventing Vercel's 60s function kill.
const MODEL_TIMEOUT_MS = 25000;

class ThrottledQueue {
  constructor(ms = 2000) {
    this.ms = ms;
    this.lastCall = 0;
    this.queue = [];
  }

  async enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const wait = Math.max(0, this.lastCall + this.ms - now);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));

      const { fn, resolve, reject } = this.queue.shift();
      this.lastCall = Date.now();
      try {
        const res = await fn();
        resolve(res);
      } catch (err) {
        reject(err);
      }
    }
    this.processing = false;
  }
}

export class AIGateway {
  constructor() {
    this.queue = new ThrottledQueue(2000);

    // NVIDIA Client
    const nvKey = (process.env.NVIDIA_API_KEY || '').replace(/['"]/g, '').trim();
    this.nvidiaClient = nvKey
      ? new OpenAI({ baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: nvKey })
      : null;

    // Groq Client (OpenAI-compatible bridge)
    const groqKey = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim();
    this.groqClient = groqKey
      ? new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: groqKey })
      : null;

    // Groq fallback is ON by default — only set ENABLE_GROQ_FALLBACK=false to disable
    const groqToggle = process.env.ENABLE_GROQ_FALLBACK !== 'false';
    console.log(
      `[AIGateway] Init - NVIDIA: ${this.nvidiaClient ? 'SET' : 'MISSING'}, ` +
      `GROQ: ${this.groqClient ? 'SET' : 'MISSING'}, ` +
      `TOGGLE: ${groqToggle ? 'ON' : 'OFF'}, ` +
      `TIMEOUT: ${MODEL_TIMEOUT_MS}ms`
    );

    if (!this.nvidiaClient && !this.groqClient) {
      console.error('[CRITICAL] No AI providers configured (NVIDIA or GROQ)!');
    }
  }

  async generate({ tier = 'heavy', messages, temperature = 0.1, max_tokens = 4096 }) {
    let lastError = null;

    // Build model chain: NVIDIA first, then Groq as fallback
    const nvidiaModels = tier === 'fast' ? TIER_1_FAST : TIER_2_HEAVY;

    const groqDisabled = process.env.ENABLE_GROQ_FALLBACK === 'false';
    const groqModels = (!groqDisabled && this.groqClient)
      ? (tier === 'fast' ? GROQ_MODELS_FAST : GROQ_MODELS_HEAVY)
      : [];

    const sequence = [
      ...nvidiaModels.map(m => ({ id: m, provider: 'nvidia', client: this.nvidiaClient })),
      ...groqModels.map(m => ({ id: m, provider: 'groq', client: this.groqClient })),
    ].filter(step => step.client !== null);

    if (sequence.length === 0) {
      throw new Error('No available AI clients or models configured for this tier.');
    }

    for (let i = 0; i < sequence.length; i++) {
      const { id: model, provider, client } = sequence[i];

      if (i > 0 && sequence[i - 1].provider === 'nvidia' && provider === 'groq') {
        console.warn('[AIGateway] ⚠️ NVIDIA chain exhausted or timed out. Switching to GROQ fallback...');
      }

      console.log(`[AIGateway] Executing ${model} (${provider})...`);

      try {
        const content = await this.queue.enqueue(async () => {
          const start = Date.now();

          // ── Hard timeout: race the API call against a deadline ──────────
          const apiCall = client.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens,
            stream: false,
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`${model} timed out after ${MODEL_TIMEOUT_MS}ms`)),
              MODEL_TIMEOUT_MS
            )
          );

          const completion = await Promise.race([apiCall, timeoutPromise]);
          // ────────────────────────────────────────────────────────────────

          const duration = Date.now() - start;
          console.log(`[AIGateway] ${model} (${provider}) responded in ${duration}ms`);

          const text = completion.choices?.[0]?.message?.content;
          if (!text) throw new Error(`Empty response from ${model}`);
          return text;
        });

        console.log(`[AIGateway] ✓ Success with ${model} (${provider})`);
        return content;

      } catch (error) {
        const isPermissionError = error.status === 403 || error.status === 401;
        const isTimeout = error.message?.includes('timed out');

        if (isPermissionError) {
          console.error(`[AIGateway] 🛑 PERMISSION DENIED for ${model}: key restricted or invalid.`);
        } else if (isTimeout) {
          console.warn(`[AIGateway] ⏱ ${model} (${provider}) timed out — trying next model`);
        } else {
          console.warn(`[AIGateway] ✗ ${model} (${provider}) failed: ${error.message}`);
        }

        lastError = error;

        if (i === sequence.length - 1) {
          throw new Error(`All ${sequence.length} models failed. Last error: ${lastError.message}`);
        }

        // No wait on timeout (already wasted 25s), short wait on permission error
        const waitTime = isTimeout ? 0 : isPermissionError ? 10 : 200;
        if (waitTime > 0) await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}

export const gateway = new AIGateway();
