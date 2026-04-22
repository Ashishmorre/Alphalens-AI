import OpenAI from 'openai';
import {
  TIER_1_FAST,
  TIER_2_HEAVY,
  GROQ_MODELS_FAST,
  GROQ_MODELS_HEAVY
} from './models.js';

// How long to wait for NVIDIA before giving up and trying Groq.
// CRITICAL: Vercel's edge proxy (bom1→iad1) has an ~100s hard limit regardless
// of maxDuration. NVIDIA at 150s caused the edge to drop connections mid-flight.
// 80s gives NVIDIA a generous window; worst-case total = 80s + 8s (Groq) = 88s max.
const NVIDIA_TIMEOUT_MS = 80000; // 80 seconds

// Groq hard ceiling (it's normally 3-8s, so 60s is very generous)
const GROQ_TIMEOUT_MS = 60000; // 60 seconds

export class AIGateway {
  constructor() {
    const nvKey  = (process.env.NVIDIA_API_KEY  || '').replace(/['"]/g, '').trim();
    const groqKey = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim();

    this.nvidiaClient = nvKey
      ? new OpenAI({ baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: nvKey })
      : null;

    this.groqClient = groqKey
      ? new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: groqKey })
      : null;

    const groqEnabled = process.env.ENABLE_GROQ_FALLBACK !== 'false';
    console.log(
      `[AIGateway] Init - NVIDIA: ${this.nvidiaClient ? 'SET' : 'MISSING'}, ` +
      `GROQ: ${this.groqClient ? 'SET' : 'MISSING'}, ` +
      `TOGGLE: ${groqEnabled ? 'ON' : 'OFF'}, ` +
      `NVIDIA_TIMEOUT: ${NVIDIA_TIMEOUT_MS / 1000}s, GROQ_TIMEOUT: ${GROQ_TIMEOUT_MS / 1000}s`
    );

    if (!this.nvidiaClient && !this.groqClient) {
      console.error('[CRITICAL] No AI providers configured!');
    }
  }

  // ── Call one model with a hard timeout ──────────────────────────────────────
  async _callModel(client, model, provider, messages, temperature, max_tokens, timeoutMs) {
    const start = Date.now();
    console.log(`[AIGateway] Executing ${model} (${provider})...`);

    const apiCall = client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${provider} timed out after ${timeoutMs / 1000}s`)),
        timeoutMs
      )
    );

    const completion = await Promise.race([apiCall, timeoutPromise]);
    const duration = Date.now() - start;
    console.log(`[AIGateway] ${model} (${provider}) responded in ${duration}ms`);

    const text = completion.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Empty response from ${model}`);
    return text;
  }

  // ── Main generate ────────────────────────────────────────────────────────────
  async generate({ tier = 'heavy', messages, temperature = 0.1, max_tokens = 4096 }) {
    const nvidiaModel = (tier === 'fast' ? TIER_1_FAST : TIER_2_HEAVY)[0];
    const groqModel   = (tier === 'fast' ? GROQ_MODELS_FAST : GROQ_MODELS_HEAVY)[0];

    const groqDisabled = process.env.ENABLE_GROQ_FALLBACK === 'false';
    const hasNvidia    = !!this.nvidiaClient;
    const hasGroq      = !!this.groqClient && !groqDisabled;

    if (!hasNvidia && !hasGroq) {
      throw new Error('No AI providers configured.');
    }

    // ── Step 1: Try NVIDIA first, wait up to 150s ────────────────────────────
    if (hasNvidia) {
      try {
        const result = await this._callModel(
          this.nvidiaClient, nvidiaModel, 'nvidia',
          messages, temperature, max_tokens,
          NVIDIA_TIMEOUT_MS
        );
        console.log('[AIGateway] ✓ NVIDIA succeeded');
        return result;

      } catch (err) {
        const isTimeout = err.message?.includes('timed out');
        if (isTimeout) {
          console.warn(`[AIGateway] ⏱ NVIDIA took >150s — switching to Groq...`);
        } else {
          console.warn(`[AIGateway] ✗ NVIDIA failed: ${err.message} — switching to Groq...`);
        }

        if (!hasGroq) {
          throw new Error(`NVIDIA failed and no Groq fallback available. Error: ${err.message}`);
        }
      }
    }

    // ── Step 2: Groq fallback (only reached if NVIDIA timed out or failed) ────
    console.log('[AIGateway] Starting Groq fallback...');
    const result = await this._callModel(
      this.groqClient, groqModel, 'groq',
      messages, temperature, max_tokens,
      GROQ_TIMEOUT_MS
    );
    console.log('[AIGateway] ✓ Groq succeeded');
    return result;
  }
}

export const gateway = new AIGateway();
