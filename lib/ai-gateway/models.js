/**
 * NVIDIA NIM Model Registry
 * Defines fallback chains for different task tiers
 */

export const TIER_1_FAST = [
  'meta/llama-3.2-3b-instruct',
  'google/gemma-2-2b-it',
  'nvidia/nemotron-mini-4b-instruct',
  'microsoft/phi-4-mini-instruct'
];

export const TIER_2_HEAVY = [
  'meta/llama-3.3-70b-instruct',
  'mistralai/mistral-large-3-675b-instruct-2512',
  'qwen/qwen3.5-122b-a10b'
];

export const TIER_VISION = [
  'meta/llama-3.2-11b-vision-instruct'
];