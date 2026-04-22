/**
 * NVIDIA NIM Model Registry
 * Defines fallback chains for different task tiers
 * Optimized for financial analysis, DCF modeling, and risk assessment
 */

export const TIER_1_FAST = [
  'google/gemma-3-27b-it',                          // Gemma 3 27B - latest frontier vision/reasoning
  'meta/llama-3.2-3b-instruct',                     // Ultra-fast for sentiment
  'microsoft/phi-4-mini-instruct',                   // Excellent mini reasoning
  'nvidia/nemotron-mini-4b-instruct',                // Optimized chat fallback
];

export const TIER_2_HEAVY = [
  'nvidia/llama-3.3-nemotron-super-49b-v1.5',       // Primary: Best-in-class for financial math/reasoning
  'deepseek-ai/deepseek-v3.2',                       // State-of-the-art 685B reasoning
  'google/gemma-4-31b-it',                           // Agentic-optimized flagship
  'mistralai/mistral-large-3-675b-instruct-2512',    // High-tier fallback
];

export const TIER_VISION = [
  'google/gemma-3-27b-it',                           // Latest vision assistant
  'meta/llama-3.2-11b-vision-instruct'               // Reliable vision fallback
];