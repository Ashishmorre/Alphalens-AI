import OpenAI from 'openai';
import {
  TIER_1_FAST,
  TIER_2_HEAVY,
  GROQ_MODELS_FAST,
  GROQ_MODELS_HEAVY
} from './models.js';

// ─── Policy ───────────────────────────────────────────────────────────────────
// PRIMARY:  NVIDIA — always used, wait up to 90s (safely under Vercel edge proxy limit)
// FALLBACK: Groq   — ONLY if NVIDIA throws a hard error (auth failure, rate limit,
//                   connection refused, 4xx/5xx). Timeout is NOT a hard error;
//                   on timeout we throw so the client can show a "retry" message.
//
// Vercel edge proxy (bom1→iad1) has an ~100s hard limit that ignores maxDuration.
// 90s keeps us safely under that ceiling while giving NVIDIA maximum headroom.
// ─────────────────────────────────────────────────────────────────────────────
const NVIDIA_TIMEOUT_MS = 90000;  // 90 seconds — primary provider ceiling
const GROQ_TIMEOUT_MS   = 60000;  // 60 seconds — last-resort ceiling (Groq is 3–8s normally)

// Errors that indicate NVIDIA is broken (not just slow) → trigger Groq last-resort
const HARD_ERROR_PATTERNS = [
  'unauthorized', '401', 'invalid_api_key', 'authentication',
  'rate_limit', 'quota', '429',
  'connection refused', 'econnrefused', 'enotfound',
  'service unavailable', '503', '502', '500',
  'model not found', 'invalid model',
]

function isHardError(err) {
  const msg = (err.message || '').toLowerCase()
  return HARD_ERROR_PATTERNS.some(p => msg.includes(p))
}

export class AIGateway {
  constructor() {
    const nvKey   = (process.env.NVIDIA_API_KEY  || '').replace(/['"]/g, '').trim()
    const groqKey = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim()

    this.nvidiaClient = nvKey
      ? new OpenAI({ baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: nvKey })
      : null

    this.groqClient = groqKey
      ? new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: groqKey })
      : null

    console.log(
      `[AIGateway] Init — NVIDIA: ${this.nvidiaClient ? 'SET' : 'MISSING'}, ` +
      `GROQ (last-resort): ${this.groqClient ? 'SET' : 'MISSING'}, ` +
      `NVIDIA_TIMEOUT: ${NVIDIA_TIMEOUT_MS / 1000}s`
    )

    if (!this.nvidiaClient) {
      console.error('[CRITICAL] NVIDIA API key not configured!')
    }
  }

  // ── Call a model with a hard wall-clock timeout ───────────────────────────
  async _callModel(client, model, provider, messages, temperature, max_tokens, timeoutMs) {
    const start = Date.now()
    console.log(`[AIGateway] → ${provider} / ${model}`)

    const apiCall = client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`TIMEOUT:${provider} did not respond within ${timeoutMs / 1000}s`)),
        timeoutMs
      )
    )

    const completion = await Promise.race([apiCall, timeoutPromise])
    const duration = Date.now() - start
    console.log(`[AIGateway] ✓ ${provider} responded in ${Math.round(duration / 1000)}s`)

    const text = completion.choices?.[0]?.message?.content
    if (!text) throw new Error(`HARD:Empty response from ${model}`)
    return text
  }

  // ── Main entry point ──────────────────────────────────────────────────────
  async generate({ tier = 'heavy', messages, temperature = 0.1, max_tokens = 4096 }) {
    const nvidiaModel = (tier === 'fast' ? TIER_1_FAST : TIER_2_HEAVY)[0]
    const groqModel   = (tier === 'fast' ? GROQ_MODELS_FAST : GROQ_MODELS_HEAVY)[0]

    if (!this.nvidiaClient) {
      throw new Error('[AIGateway] NVIDIA API key not configured. Cannot proceed.')
    }

    // ── Step 1: NVIDIA (primary, always) ─────────────────────────────────────
    try {
      const result = await this._callModel(
        this.nvidiaClient, nvidiaModel, 'nvidia',
        messages, temperature, max_tokens,
        NVIDIA_TIMEOUT_MS
      )
      console.log('[AIGateway] ✓ NVIDIA succeeded — done.')
      return result

    } catch (err) {
      const isTimeout = err.message?.startsWith('TIMEOUT:')
      const isHard    = isHardError(err)

      if (isTimeout) {
        // NVIDIA was slow but not broken — tell the client to retry.
        // Do NOT fall back to Groq for a slow response.
        console.warn('[AIGateway] ⏱ NVIDIA timed out (slow response). Surfacing error for client retry.')
        throw new Error(
          'NVIDIA is responding slowly. Please try again — it is usually faster on retry.'
        )
      }

      // Hard error: NVIDIA is broken/unavailable — try Groq as absolute last resort
      if (isHard && this.groqClient) {
        console.warn(`[AIGateway] ✗ NVIDIA hard error: ${err.message}`)
        console.warn('[AIGateway] ⚠ LAST RESORT: Falling back to Groq due to NVIDIA hard failure.')
        try {
          const result = await this._callModel(
            this.groqClient, groqModel, 'groq (last-resort)',
            messages, temperature, max_tokens,
            GROQ_TIMEOUT_MS
          )
          console.log('[AIGateway] ✓ Groq (last-resort) succeeded.')
          return result
        } catch (groqErr) {
          throw new Error(`Both NVIDIA and Groq failed. NVIDIA: ${err.message} | Groq: ${groqErr.message}`)
        }
      }

      // No Groq configured, or unknown error type — surface as-is
      throw new Error(`NVIDIA failed: ${err.message}`)
    }
  }
}

export const gateway = new AIGateway()
