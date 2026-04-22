/**
 * NVIDIA NIM Model Registry
 * Defines fallback chains for different task tiers
 * Optimized for financial analysis, DCF modeling, and risk assessment.
 *
 * All model IDs verified against the live NVIDIA NIM catalog.
 * Sorted by suitability for financial math, reasoning, and structured output.
 */

// Heavy tier: top reasoning models for DCF, thesis, and risk analysis
export const TIER_2_HEAVY = [
  'meta/llama-3.3-70b-instruct',                    // Best: math, reasoning, function calling (11M req)
  'moonshotai/kimi-k2-instruct',                     // 256K ctx, strong agentic reasoning (18M req)
  'deepseek-ai/deepseek-v3.2',                       // 685B SOTA reasoning (12M req)
  'mistralai/mixtral-8x22b-instruct-v0.1',           // MoE, advanced reasoning (2.37M req)
  'meta/llama-4-maverick-17b-128e-instruct',         // Multimodal MoE, strong general reasoning
  'google/gemma-3-27b-it',                           // Frontier reasoning, reliable fallback
];

// Fast tier: lightweight models for sentiment, news, and quick extraction
export const TIER_1_FAST = [
  'meta/llama-3.2-3b-instruct',                     // Ultra-fast, lightweight (923K req)
  'google/gemma-3-27b-it',                           // Frontier reasoning
  'microsoft/phi-4-mini-instruct',                   // Excellent mini reasoning
  'nvidia/nemotron-mini-4b-instruct',                // Optimized chat fallback
];

// Groq fallback tier (last resort when all NVIDIA models fail)
export const GROQ_MODELS_HEAVY = [
  'llama-3.3-70b-versatile',                         // Flagship Llama 3.3 on Groq
  'deepseek-r1-distill-llama-70b',                   // DeepSeek reasoning (distilled)
  'llama-3.1-70b-versatile',                         // Reliable fallback
];

export const GROQ_MODELS_FAST = [
  'llama-3.2-3b-preview',
  'llama3-8b-8192',
];

// Vision tier
export const TIER_VISION = [
  'meta/llama-3.2-11b-vision-instruct',              // Primary vision model
  'google/gemma-3-27b-it',                           // Vision fallback
];