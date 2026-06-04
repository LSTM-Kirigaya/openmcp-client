/**
 * Anthropic 协议 DeepSeek 兼容测试脚本
 *
 * 用法:
 *   1. 将 DEEPSEEK_API_KEY 写入 service/.env.local
 *   2. cd service && npx tsx src/llm/test-anthropic-deepseek.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { OpenAI } from "openai";

// 从环境变量读取 API Key（通过 --env-file=.env.local 传入）

const API_KEY = process.env.DEEPSEEK_API_KEY!;
if (!API_KEY) {
    console.error("错误: 请在 service/.env.local 中设置 DEEPSEEK_API_KEY");
    process.exit(1);
}

const BASE_URL_OPENAI = "https://api.deepseek.com";
const BASE_URL_ANTHROPIC = "https://api.deepseek.com/anthropic";
const MODEL = "deepseek-chat";

async function testOpenAI() {
    console.log("\n========== 测试 1: OpenAI 协议 ==========");
    try {
        const client = new OpenAI({
            baseURL: BASE_URL_OPENAI,
            apiKey: API_KEY,
        });
        const response = await client.chat.completions.create({
            model: MODEL,
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 10,
        });
        console.log("✅ OpenAI 协议成功");
        console.log("回复:", response.choices[0]?.message?.content);
    } catch (error: any) {
        console.error("❌ OpenAI 协议失败:");
        console.error(error.message || error);
    }
}

async function testAnthropicWithApiKey() {
    console.log("\n========== 测试 2: Anthropic 协议 (传 apiKey) ==========");
    try {
        const client = new Anthropic({
            baseURL: BASE_URL_ANTHROPIC,
            apiKey: API_KEY,
        });
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 10,
            messages: [{ role: "user", content: "Hello" }],
        });
        console.log("✅ Anthropic 协议 (apiKey) 成功");
        console.log("回复:", response.content);
    } catch (error: any) {
        console.error("❌ Anthropic 协议 (apiKey) 失败:");
        console.error(error.message || error);
    }
}

async function testAnthropicWithAuthToken() {
    console.log("\n========== 测试 3: Anthropic 协议 (传 authToken) ==========");
    try {
        const client = new Anthropic({
            baseURL: BASE_URL_ANTHROPIC,
            authToken: API_KEY,
        });
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 10,
            messages: [{ role: "user", content: "Hello" }],
        });
        console.log("✅ Anthropic 协议 (authToken) 成功");
        console.log("回复:", response.content);
    } catch (error: any) {
        console.error("❌ Anthropic 协议 (authToken) 失败:");
        console.error(error.message || error);
    }
}

async function testAnthropicWithDefaultHeaders() {
    console.log("\n========== 测试 4: Anthropic 协议 (defaultHeaders Authorization) ==========");
    try {
        const client = new Anthropic({
            baseURL: BASE_URL_ANTHROPIC,
            defaultHeaders: {
                Authorization: `Bearer ${API_KEY}`,
            },
        });
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 10,
            messages: [{ role: "user", content: "Hello" }],
        });
        console.log("✅ Anthropic 协议 (defaultHeaders) 成功");
        console.log("回复:", response.content);
    } catch (error: any) {
        console.error("❌ Anthropic 协议 (defaultHeaders) 失败:");
        console.error(error.message || error);
    }
}

async function testRawFetch() {
    console.log("\n========== 测试 5: 原始 fetch (Authorization Bearer) ==========");
    try {
        const response = await fetch(`${BASE_URL_ANTHROPIC}/v1/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY!}`,
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 10,
                messages: [{ role: "user", content: "Hello" }],
            }),
        });
        const data = await response.json();
        if (response.ok) {
            console.log("✅ 原始 fetch 成功");
            console.log("回复:", data.content);
        } else {
            console.error("❌ 原始 fetch 失败:", response.status, data);
        }
    } catch (error: any) {
        console.error("❌ 原始 fetch 异常:");
        console.error(error.message || error);
    }
}

async function testRawFetchWithXApiKey() {
    console.log("\n========== 测试 6: 原始 fetch (X-Api-Key) ==========");
    try {
        const response = await fetch(`${BASE_URL_ANTHROPIC}/v1/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": API_KEY!,
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 10,
                messages: [{ role: "user", content: "Hello" }],
            }),
        });
        const data = await response.json();
        if (response.ok) {
            console.log("✅ 原始 fetch (X-Api-Key) 成功");
            console.log("回复:", data.content);
        } else {
            console.error("❌ 原始 fetch (X-Api-Key) 失败:", response.status, data);
        }
    } catch (error: any) {
        console.error("❌ 原始 fetch (X-Api-Key) 异常:");
        console.error(error.message || error);
    }
}

async function main() {
    console.log("DeepSeek Anthropic 协议兼容测试");
    console.log("API Key 前 8 位:", API_KEY.slice(0, 8) + "...");

    await testOpenAI();
    await testAnthropicWithApiKey();
    await testAnthropicWithAuthToken();
    await testAnthropicWithDefaultHeaders();
    await testRawFetch();
    await testRawFetchWithXApiKey();

    console.log("\n========== 测试完成 ==========");
}

main().catch(console.error);
