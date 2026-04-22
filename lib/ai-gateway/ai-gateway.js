import OpenAI from 'openai';
import { 
  TIER_1_FAST, 
  TIER_2_HEAVY, 
  GROQ_MODELS_FAST, 
  GROQ_MODELS_HEAVY 
} from './models.js';

class ThrottledQueue {
  constructor(ms = 1600) {
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
    this.queue = new ThrottledQueue(1600);
    
    // NVIDIA Client
    const nvKey = (process.env.NVIDIA_API_KEY || '').replace(/['"]/g, '').trim();
    this.nvidiaClient = nvKey ? new OpenAI({ baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: nvKey }) : null;

    // Groq Client (OpenAI-compatible bridge)
    const groqKey = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim();
    this.groqClient = groqKey ? new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: groqKey }) : null;

    if (!this.nvidiaClient && !this.groqClient) {
      console.error("[CRITICAL] No AI providers configured (NVIDIA or GROQ)!");
    }
  }

  async generate({ tier = 'heavy', messages, temperature = 0.1, max_tokens = 4096 }) {
    let lastError = null;

    // 1. Prepare Model Chain (Primary: NVIDIA, Fallback: Groq)
    const nvidiaModels = tier === 'fast' ? TIER_1_FAST : TIER_2_HEAVY;
    
    // Only add Groq if explicitly enabled in environment
    const useGroq = process.env.ENABLE_GROQ_FALLBACK === 'true' && this.groqClient;
    const groqModels = useGroq ? (tier === 'fast' ? GROQ_MODELS_FAST : GROQ_MODELS_HEAVY) : [];
    
    // Create execution sequence (NVIDIA first, GROQ at the very end)
    const sequence = [
      ...nvidiaModels.map(m => ({ id: m, provider: 'nvidia', client: this.nvidiaClient })),
      ...groqModels.map(m => ({ id: m, provider: 'groq', client: this.groqClient }))
    ].filter(step => step.client !== null);

    if (sequence.length === 0) {
      throw new Error("No available AI clients or models configured for this tier.");
    }

    for (let i = 0; i < sequence.length; i++) {
      const { id: model, provider, client } = sequence[i];
      
      // If we are switching from NVIDIA to GROQ, log it
      if (i > 0 && sequence[i-1].provider === 'nvidia' && provider === 'groq') {
        console.warn(`[AIGateway] ⚠️ NVIDIA chain exhausted or restricted. Switching to GROQ fallback...`);
      }

      console.log(`[AIGateway] Executing ${model} (${provider})...`);

      try {
        const content = await this.queue.enqueue(async () => {
          const start = Date.now();
          try {
            const completion = await client.chat.completions.create({
              model,
              messages,
              temperature,
              max_tokens,
              stream: false
            });
            
            const duration = Date.now() - start;
            console.log(`[AIGateway] ${model} (${provider}) responded in ${duration}ms`);
            const content = completion.choices?.[0]?.message?.content;
            
            if (!content) throw new Error(`Empty response from ${model}`);
            return content;
          } catch (apiError) {
            throw apiError;
          }
        });

        console.log(`[AIGateway] ✓ Success with ${model} (${provider})`);
        return content;

      } catch (error) {
        const isPermissionError = error.status === 403 || error.status === 401;
        
        if (isPermissionError) {
          console.error(`[AIGateway] 🛑 PERMISSION DENIED for ${model}: key restricted or invalid.`);
        } else {
          console.warn(`[AIGateway] ✗ ${model} (${provider}) failed: ${error.message}`);
        }
        
        lastError = error;

        if (i === sequence.length - 1) {
          throw new Error(`All ${sequence.length} models failed. Last error: ${lastError.message}`);
        }
        
        const waitTime = isPermissionError ? 10 : 200;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}

export const gateway = new AIGateway();
