/**
 * MiniMax LLM integration tests
 * Tests that the MiniMax API endpoint is reachable and the OpenAI-compatible
 * SDK works correctly with MiniMax's /v1/chat/completions endpoint.
 *
 * Requires: MINIMAX_API_KEY environment variable
 * Run: MINIMAX_API_KEY=<key> npx tsx src/hook/llm.integration.test.ts
 */
import { OpenAI } from 'openai';
import { llms } from './llm.js';

const API_KEY = process.env.MINIMAX_API_KEY;
if (!API_KEY) {
	console.log('SKIP: MINIMAX_API_KEY not set, skipping integration tests');
	process.exit(0);
}

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

const minimax = llms.find(l => l.id === 'minimax');
if (!minimax) {
	console.error('FAIL: minimax provider not found');
	process.exit(1);
}

const client = new OpenAI({
	baseURL: minimax.baseUrl,
	apiKey: API_KEY
});

// ── Test 1: Non-streaming chat completion ────────────────────────────

async function testNonStreaming() {
	console.log('Test 1: Non-streaming chat completion...');
	const response = await client.chat.completions.create({
		model: 'MiniMax-M3',
		messages: [
			{ role: 'user', content: 'Say "hello" and nothing else.' }
		],
		temperature: 0.1,
		stream: false
	});

	const content = response.choices?.[0]?.message?.content ?? '';
	assert(content.length > 0, 'non-streaming response should have content');
	assert(response.choices.length > 0, 'response should have at least one choice');
	console.log(`  Response: "${content.substring(0, 80)}"`);
}

// ── Test 2: Streaming chat completion ────────────────────────────────

async function testStreaming() {
	console.log('Test 2: Streaming chat completion...');
	const stream = await client.chat.completions.create({
		model: 'MiniMax-M3',
		messages: [
			{ role: 'user', content: 'Count from 1 to 3.' }
		],
		temperature: 0.1,
		stream: true
	});

	let chunks = 0;
	let fullContent = '';
	for await (const chunk of stream) {
		chunks++;
		const delta = chunk.choices?.[0]?.delta?.content;
		if (delta) fullContent += delta;
	}

	assert(chunks > 0, 'streaming should produce at least one chunk');
	assert(fullContent.length > 0, 'streaming should produce non-empty content');
	console.log(`  Got ${chunks} chunks, content: "${fullContent.substring(0, 80)}"`);
}

// ── Test 3: Tool calling support ─────────────────────────────────────

async function testToolCalling() {
	console.log('Test 3: Tool calling support...');
	const response = await client.chat.completions.create({
		model: 'MiniMax-M3',
		messages: [
			{ role: 'user', content: 'What is the weather in Tokyo?' }
		],
		tools: [
			{
				type: 'function',
				function: {
					name: 'get_weather',
					description: 'Get the current weather in a given location',
					parameters: {
						type: 'object',
						properties: {
							location: {
								type: 'string',
								description: 'The city name, e.g. Tokyo'
							}
						},
						required: ['location']
					}
				}
			}
		],
		temperature: 0.1,
		stream: false
	});

	const msg = response.choices?.[0]?.message;
	const hasToolCall = msg?.tool_calls && msg.tool_calls.length > 0;
	assert(hasToolCall === true, 'response should include a tool call');
	if (hasToolCall) {
		const toolCall = msg!.tool_calls![0];
		if (toolCall.type !== 'function') {
			assert(false, `tool call should be a function call, got ${toolCall.type}`);
			return;
		}
		assert(toolCall.function.name === 'get_weather', 'tool call should be get_weather');
		console.log(`  Tool call: ${toolCall.function.name}(${toolCall.function.arguments})`);
	}
}

// ── Run all tests ────────────────────────────────────────────────────

async function run() {
	await testNonStreaming();
	await testStreaming();
	await testToolCalling();

	console.log(`\nMiniMax integration tests: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
	else console.log('All integration tests passed!');
}

run().catch(err => {
	console.error('Integration test error:', err.message || err);
	process.exit(1);
});
