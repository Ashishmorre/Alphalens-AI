import OpenAI from 'openai';

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

const MODELS = {
  fast: ['meta/llama-3.2-3b-instruct', 'google/gemma-2-9b-it', 'microsoft/phi-4-mini-flash-reasoning'],
  heavy: ['meta/llama-3.3-70b-instruct', 'mistralai/mistral-large-3-675b-instruct-2512', 'qwen/qwen3.5-122b-a10b', 'deepseek-ai/deepseek-v3.1']
};

export class AIGateway {
  constructor() {
    this.queue = new ThrottledQueue(1600);
    const rawKey = process.env.NVIDIA_API_KEY || '';
    const cleanKey = rawKey.replace(/['"]/g, '').trim();
    if (!cleanKey) console.error("[CRITICAL] NVIDIA_API_KEY missing!");
    else console.log(`[AIGateway] Key: ${cleanKey.substring(0, 10)}...`);
    this.client = new OpenAI({ baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: cleanKey });
  }

  async generate({ tier = 'heavy', messages, temperature = 0.1, max_tokens = 4096 }) {
    const tierModels = MODELS[tier] || MODELS.heavy;
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
