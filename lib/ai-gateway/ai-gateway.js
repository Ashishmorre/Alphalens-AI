import OpenAI from 'openai';
import {
  TIER_1_FAST,
  TIER_2_HEAVY,
  GROQ_MODELS_FAST,
  GROQ_MODELS_HEAVY
} from './models.js';

// How long to give NVIDIA a head start before also firing Groq in parallel.
// If NVIDIA responds in < HEDGE_DELAY_MS → it wins (no Groq needed).
// If NVIDIA is slow → Groq kicks in and whoever finishes first is used.
const HEDGE_DELAY_MS = 15000; // 15 seconds

// Absolute ceiling — if both providers are silent beyond this, abort.
const MODEL_TIMEOUT_MS = 270000;

export class AIGateway {
  constructor() {
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

    const groqToggle = process.env.ENABLE_GROQ_FALLBACK !== 'false';
    console.log(
      `[AIGateway] Init - NVIDIA: ${this.nvidiaClient ? 'SET' : 'MISSING'}, ` +
      `GROQ: ${this.groqClient ? 'SET' : 'MISSING'}, ` +
      `TOGGLE: ${groqToggle ? 'ON' : 'OFF'}, ` +
      `HEDGE: ${HEDGE_DELAY_MS}ms, TIMEOUT: ${MODEL_TIMEOUT_MS}ms`
    );

    if (!this.nvidiaClient && !this.groqClient) {
      console.error('[CRITICAL] No AI providers configured (NVIDIA or GROQ)!');
    }
  }

  // ── Single model call with hard timeout ─────────────────────────────────────
  async _callModel(client, model, provider, messages, temperature, max_tokens) {
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
        () => reject(new Error(`${model} timed out after ${MODEL_TIMEOUT_MS}ms`)),
        MODEL_TIMEOUT_MS
      )
    );

    const completion = await Promise.race([apiCall, timeoutPromise]);
    const duration = Date.now() - start;
    console.log(`[AIGateway] ${model} (${provider}) responded in ${duration}ms`);

    const text = completion.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Empty response from ${model}`);
    return text;
  }

  // ── First-success race across multiple promises ──────────────────────────────
  // Resolves with the first promise that succeeds.
  // Only rejects when ALL promises have rejected.
  _firstSuccess(promises) {
    return new Promise((resolve, reject) => {
      let rejected = 0;
      const errors = [];
      for (const p of promises) {
        p.then(resolve).catch(err => {
          errors.push(err.message);
          rejected++;
          if (rejected === promises.length) {
            reject(new Error(`All providers failed:\n${errors.join('\n')}`));
          }
        });
      }
    });
  }

  // ── Main generate entry point ────────────────────────────────────────────────
  async generate({ tier = 'heavy', messages, temperature = 0.1, max_tokens = 4096 }) {
    const nvidiaModel = (tier === 'fast' ? TIER_1_FAST : TIER_2_HEAVY)[0];
    const groqModel   = (tier === 'fast' ? GROQ_MODELS_FAST : GROQ_MODELS_HEAVY)[0];

    const groqDisabled = process.env.ENABLE_GROQ_FALLBACK === 'false';
    const hasNvidia    = !!this.nvidiaClient;
    const hasGroq      = !!this.groqClient && !groqDisabled;

    if (!hasNvidia && !hasGroq) {
      throw new Error('No available AI clients or models configured for this tier.');
    }

    // ── Single provider: no hedging needed ──────────────────────────────────
    if (!hasNvidia) {
      console.log('[AIGateway] NVIDIA unavailable — using Groq directly');
      return this._callModel(this.groqClient, groqModel, 'groq', messages, temperature, max_tokens);
    }
    if (!hasGroq) {
      console.log('[AIGateway] Groq unavailable — using NVIDIA directly');
      return this._callModel(this.nvidiaClient, nvidiaModel, 'nvidia', messages, temperature, max_tokens);
    }

    // ── HEDGED REQUEST: NVIDIA first, Groq joins after HEDGE_DELAY_MS ────────
    // If NVIDIA is fast (<15s) it wins with no Groq overhead.
    // If NVIDIA is slow (55-98s), Groq kicks in at 15s and wins (~18-23s total).
    console.log(`[AIGateway] Hedged mode — NVIDIA now, Groq in ${HEDGE_DELAY_MS / 1000}s if needed`);

    const nvidiaPromise = this._callModel(
      this.nvidiaClient, nvidiaModel, 'nvidia', messages, temperature, max_tokens
    ).then(result => {
      console.log('[AIGateway] ✓ NVIDIA won the race');
      return result;
    });

    // Groq starts after the hedge delay — resolves/rejects like a normal promise
    const groqPromise = new Promise((resolve, reject) => {
      setTimeout(async () => {
        console.log('[AIGateway] ⏱ Hedge window elapsed — starting Groq in parallel');
        this._callModel(
          this.groqClient, groqModel, 'groq', messages, temperature, max_tokens
        )
          .then(result => {
            console.log('[AIGateway] ✓ Groq won the race');
            resolve(result);
          })
          .catch(reject);
      }, HEDGE_DELAY_MS);
    });

    // Use whichever succeeds first (NVIDIA or Groq)
    return this._firstSuccess([nvidiaPromise, groqPromise]);
  }
}

export const gateway = new AIGateway();
