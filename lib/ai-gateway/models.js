/**
 * NVIDIA NIM Model Registry
 * Defines fallback chains for different task tiers
 * Optimized for financial analysis, DCF modeling, and risk assessment
 */

export const TIER_1_FAST = [
  'google/gemma2-9b-it', // Faster Gemma 2 variant, excellent for news sentiment
  'meta/llama-3.2-3b-instruct', // Ultra-fast, lightweight responses
  'microsoft/phi-4-mini-flash-reasoning', // Edge-optimized reasoning model
  'nvidia/nemotron-mini-4b-instruct', // Optimized for chat & RAG workflows
];

export const TIER_2_HEAVY = [
  'mistralai/mistral-large-3-675b-instruct-2512', // Free Endpoint - 675B MoE, top-tier financial reasoning
  'deepseek-ai/deepseek-v3.2',                   // Free Endpoint - state-of-the-art reasoning
  'qwen/qwen3.5-397b-a17b',                      // Free Endpoint - 400B MoE, excellent for analysis
  'google/gemma2-27b-it',                        // Free Endpoint - strong reasoning, reliable fallback
];

export const TIER_VISION = [
  'meta/llama-3.2-11b-vision-instruct'
];