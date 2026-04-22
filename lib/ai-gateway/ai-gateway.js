import OpenAI from 'openai';
import { TIER_1_FAST, TIER_2_HEAVY } from './models.js';

class ThrottledQueue {
  constructor(delayMs = 1600) {
    this.delayMs = delayMs;
    this.queue = [];
    this.isProcessing = false;
  }
  enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this.processQueue();
    });
  }
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const { taskFn, resolve, reject } = this.queue.shift();
    try { resolve(await taskFn()); } catch (e) { reject(e); }
    await new Promise(r => setTimeout(r, this.delayMs));
    this.isProcessing = false;
    this.processQueue();
  }
}

export class AIGateway {
  constructor() {
    this.queue = new ThrottledQueue(1600);
    const rawKey = process.env.NVIDIA_API_KEY || '';
    const cleanKey = rawKey.replace(/['"]/g, '').trim();
    if (!cleanKey) {
      console.error("[CRITICAL] NVIDIA_API_KEY missing!");
      this.client = null;
    } else {
      console.log(`[AIGateway] NVIDIA key configured: ${cleanKey.substring(0, 10)}...`);
      this.client = new OpenAI({ baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: cleanKey });
    }

    // Check if GROQ is configured (reserved for future use)
    const groqKey = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim();
    if (groqKey) {
      console.warn("[AIGateway] GROQ_API_KEY is set but GROQ fallback not yet implemented. Only NVIDIA will be used.");
    }
  }

  async generate({ tier = 'heavy', messages, temperature = 0.1, max_tokens = 4096 }) {
    // Check if client is available
    if (!this.client) {
      const groqSet = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim();
      if (groqSet) {
        throw new Error('NVIDIA_API_KEY is missing. GROQ fallback is reserved for future implementation. Please provide a valid NVIDIA API key.');
      } else {
        throw new Error('No AI provider configured. Please set NVIDIA_API_KEY in your environment variables.');
      }
    }

    const tierModels = tier === 'fast' ? TIER_1_FAST : TIER_2_HEAVY;
    console.log(`[AIGateway] Tier: ${tier}, Models:`, tierModels);
    let lastError = null;

    for (let i = 0; i < tierModels.length; i++) {
      const model = tierModels[i];
      console.log(`[AIGateway] Executing ${model}...`);

      try {
        const content = await this.queue.enqueue(async () => {
          const start = Date.now();
          
          try {
            const completion = await this.client.chat.completions.create({
              model,
              messages,
              temperature,
              max_tokens,
              stream: false
            });
            
            const duration = Date.now() - start;
            console.log(`[AIGateway] ${model} responded in ${duration}ms`);
            const content = completion.choices?.[0]?.message?.content;
            
            if (!content) {
              console.error(`[AIGateway] ${model} returned empty content`, {
                model,
                hasChoices: !!completion.choices,
                choiceCount: completion.choices?.length || 0
              });
              throw new Error(`Empty response from ${model}`);
            }
            return content;
          } catch (apiError) {
            const duration = Date.now() - start;
            console.error(`[AIGateway] API call failed for ${model} after ${duration}ms:`, {
              model,
              message: apiError.message,
              status: apiError.status,
              code: apiError.code,
              type: apiError.type
            });
            throw apiError;
          }
        });

        console.log(`[AIGateway] ✓ Success with ${model}`);
        return content;

      } catch (error) {
        console.warn(`[AIGateway] ✗ ${model} failed:`, {
          message: error.message,
          status: error.status,
          code: error.code
        });
        lastError = error;

        if (i === tierModels.length - 1) {
          throw new Error(`All ${tierModels.length} models in ${tier} tier failed. Last error: ${lastError.message}`);
        }
        
        // Brief pause before next model
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
}

export const gateway = new AIGateway();
