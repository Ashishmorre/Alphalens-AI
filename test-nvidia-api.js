/**
 * Test script to verify NVIDIA API key and model connectivity
 * Run with: node test-nvidia-api.js
 */

import OpenAI from 'openai';
import { TIER_2_HEAVY } from './lib/ai-gateway/models.js';

async function testNVIDIAConnection() {
  console.log('=== NVIDIA API Connection Test ===\n');

  // Check API key
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.error('❌ NVIDIA_API_KEY is not set');
    console.log('Set it with: export NVIDIA_API_KEY="your-key-here"');
    process.exit(1);
  }

  console.log(`✅ NVIDIA_API_KEY is set (${apiKey.substring(0, 8)}...)`);

  // Create client
  const client = new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: apiKey
  });

  // Test each model in TIER_2_HEAVY
  console.log('\nTesting models from TIER_2_HEAVY:\n');

  for (const model of TIER_2_HEAVY) {
    try {
      console.log(`Testing: ${model}...`);

      const start = Date.now();
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "API_CONNECTION_OK" if you can read this.' }
        ],
        temperature: 0.1,
        max_tokens: 50,
        stream: false
      });

      const duration = Date.now() - start;
      const content = completion.choices?.[0]?.message?.content || 'No content';

      if (content.includes('API_CONNECTION_OK') || content.length > 0) {
        console.log(`  ✅ SUCCESS (${duration}ms): ${content.substring(0, 50)}...`);
      } else {
        console.log(`  ⚠️ WARNING: Got response but unexpected content`);
      }

      // Wait between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}`);
      if (error.status === 404) {
        console.log(`     Note: Model "${model}" may not be available on your API plan.`);
      } else if (error.status === 401) {
        console.log(`     Error: Invalid API key or insufficient permissions.`);
        break;
      } else if (error.status === 429) {
        console.log(`     Error: Rate limited. Waiting longer...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.log('\n=== Test Complete ===');
}

testNVIDIAConnection().catch(console.error);
