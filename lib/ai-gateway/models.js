/**
 * NVIDIA NIM Model Registry
 * Defines fallback chains for different task tiers
 * Optimized for financial analysis, DCF modeling, and risk assessment
 */

export const TIER_1_FAST = [
  'google/gemma-2-9b-it',                          // Gemma 2 9B - fast, reliable for sentiment
  'meta/llama-3.2-3b-instruct',                     // Ultra-fast, lightweight responses
  'microsoft/phi-4-mini-instruct',                   // Edge-optimized reasoning model
  'nvidia/nemotron-mini-4b-instruct',                // Optimized for chat & RAG workflows
];

export const TIER_2_HEAVY = [
  'meta/llama-3.1-405b-instruct',                    // 405B - top-tier financial reasoning, most reliable
  'mistralai/mistral-large-2-instruct',              // Mistral Large v2 - strong reasoning
  'deepseek-ai/deepseek-r1',                         // DeepSeek R1 - excellent chain-of-thought
  'google/gemma-2-27b-it',                           // Gemma 2 27B - reliable fallback
];

export const TIER_VISION = [
  'meta/llama-3.2-11b-vision-instruct'
];