/**
 * LLM provider registry tests
 * Validates that all providers in the llms array are correctly configured,
 * with specific focus on the MiniMax provider entry.
 *
 * Run: npx tsx src/hook/llm.test.ts
 */
import { llms } from './llm.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
	if (condition) {
		passed++;
	} else {
		failed++;
		console.error(`FAIL: ${msg}`);
	}
}

// ── General provider validation ──────────────────────────────────────

assert(Array.isArray(llms) && llms.length > 0, 'llms should be a non-empty array');

const ids = llms.map(l => l.id);
const uniqueIds = new Set(ids);
assert(ids.length === uniqueIds.size, 'all provider ids should be unique');

for (const llm of llms) {
	assert(typeof llm.id === 'string' && llm.id.length > 0, `provider ${llm.id} should have non-empty id`);
	assert(typeof llm.name === 'string' && llm.name.length > 0, `provider ${llm.id} should have non-empty name`);
	assert(typeof llm.baseUrl === 'string' && llm.baseUrl.length > 0, `provider ${llm.id} should have non-empty baseUrl`);
	assert(Array.isArray(llm.models), `provider ${llm.id} should have models array`);
	assert(llm.isOpenAICompatible === true, `provider ${llm.id} should be OpenAI compatible`);
	assert(typeof llm.description === 'string' && llm.description.length > 0, `provider ${llm.id} should have description`);
	assert(typeof llm.website === 'string', `provider ${llm.id} should have website`);
	assert(typeof llm.userToken === 'string', `provider ${llm.id} should have userToken`);
}

// ── MiniMax provider specific tests ──────────────────────────────────

const minimax = llms.find(l => l.id === 'minimax');
assert(minimax !== undefined, 'minimax provider should exist');

if (minimax) {
	assert(minimax.name === 'MiniMax', 'minimax name should be "MiniMax"');
	assert(minimax.baseUrl === 'https://api.minimax.io/v1', 'minimax baseUrl should be https://api.minimax.io/v1');
	assert(minimax.isOpenAICompatible === true, 'minimax should be OpenAI compatible');
	assert(minimax.userModel === 'MiniMax-M3', 'minimax default model should be MiniMax-M3');

	// Model list checks
	const models: string[] = minimax.models;
	assert(models.includes('MiniMax-M3'), 'minimax should include MiniMax-M3');
	assert(models.includes('MiniMax-M2.7'), 'minimax should include MiniMax-M2.7');
	assert(models.includes('MiniMax-M2.7-highspeed'), 'minimax should include MiniMax-M2.7-highspeed');
	assert(models.length === 3, 'minimax should have exactly 3 models');
	assert(models[0] === 'MiniMax-M3', 'MiniMax-M3 should be first in the model list');

	// Website
	assert(minimax.website === 'https://www.minimaxi.com', 'minimax website should be correct');

	// Provider
	assert(minimax.provider === 'MiniMax', 'minimax provider field should be "MiniMax"');
}

// ── Ordering: MiniMax should appear before OpenRouter ────────────────

const minimaxIdx = llms.findIndex(l => l.id === 'minimax');
const openrouterIdx = llms.findIndex(l => l.id === 'openrouter');
assert(minimaxIdx < openrouterIdx, 'minimax should appear before openrouter in the list');

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\nLLM provider tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	process.exit(1);
} else {
	console.log('All tests passed!');
}
