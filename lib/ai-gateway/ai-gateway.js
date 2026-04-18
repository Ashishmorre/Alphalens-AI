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
    let lastError = null;
    for (const model of tierModels) {
      try {
        return await this.queue.enqueue(async () => {
          console.log(`[AIGateway] Executing ${model}...`);
          const completion = await this.client.chat.completions.create({
            model, messages, temperature, max_tokens, stream: false
          });
          console.log(`[AIGateway] Response received:`, JSON.stringify(completion, null, 2).substring(0, 500));
          const content = completion.choices?.[0]?.message?.content;
          if (!content) {
            console.error(`[AIGateway] Empty content from ${model}. Full response:`, completion);
            throw new Error(`Empty response from ${model}`);
          }
          return content;
        });
      } catch (error) {
        console.warn(`[AIGateway] ${model} failed:`, error.message);
        lastError = error;
        if (error.status === 401 || error.status === 403) throw error;
      }
    }
    throw new Error(`All models exhausted. Last: ${lastError?.message}`);
  }
}

export const gateway = new AIGateway();
