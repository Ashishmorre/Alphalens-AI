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
  'meta/llama-3.1-405b-instruct',                    // Primary: Top performance
  'meta/llama-3.1-70b-instruct',                     // Most reliable "Free" model on NIM
  'nvidia/llama-3.1-nemotron-70b-instruct',          // Excellent financial logic
  'google/gemma-2-27b-it',                           // Final stable NVIDIA fallback
];

export const GROQ_MODELS_HEAVY = [
  'llama-3.3-70b-versatile',                         // Flagship Llama 3.3 on Groq
  'deepseek-r1-distill-llama-70b',                   // DeepSeek reasoning (distilled)
  'llama-3.1-70b-versatile',                         // Reliable fallback
];

export const GROQ_MODELS_FAST = [
  'llama-3.2-3b-preview',
  'llama3-8b-8192',
];

export const TIER_VISION = [
  'google/gemma-3-27b-it',                           // Latest vision assistant
  'meta/llama-3.2-11b-vision-instruct'               // Reliable vision fallback
];