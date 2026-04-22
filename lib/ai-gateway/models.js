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
  'meta/llama-3.1-405b-instruct',                    // Gold standard: High reliability & performance
  'nvidia/llama-3.1-nemotron-70b-instruct',          // Excellent financial reasoning & stable
  'mistralai/mistral-large-2-instruct',              // Stable Mistral fallback
  'google/gemma-2-27b-it',                           // Reliable small fallback
];

export const TIER_VISION = [
  'google/gemma-3-27b-it',                           // Latest vision assistant
  'meta/llama-3.2-11b-vision-instruct'               // Reliable vision fallback
];