import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');

function getNpxCommand() {
    return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

async function main() {
    console.log('=====================');

    const configPath = path.join(repoRoot, 'test', 'test-use-servers', 'add-mcp', 'add-mcp.json');
    console.log('loadMcpConfig', configPath);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as any;
    const firstServerKey = Object.keys(config.mcpServers ?? {})[0];
    const mcp = config.mcpServers?.[firstServerKey];

    if (!mcp?.command || !Array.isArray(mcp.args)) {
        throw new Error('Invalid mcpServers config: missing command/args');
    }

    const transport = new StdioClientTransport({
        command: mcp.command === 'npx' ? getNpxCommand() : mcp.command,
        args: mcp.args,
        cwd: repoRoot,
        env: mcp.env,
    });

    const client = new Client(
        { name: 'add-mcp-test', version: '0.0.1' },
        { capabilities: {} }
    );

    await client.connect(transport);

    const promptRes = await client.getPrompt({ name: 'add_prompt', arguments: {} });
    const firstText =
        promptRes.messages
            ?.flatMap((m: any) => (Array.isArray(m.content) ? m.content : [m.content]))
            ?.find((c: any) => c?.type === 'text')?.text ?? '';

    // 新版 SDK 的 prompt 主要内容在 messages 里，description 可能为空
    console.log('prompt: ', firstText || (promptRes as any).description || '(empty prompt)');

    const res = await client.callTool({ name: 'add', arguments: { a: 1, b: 2 } });
    const content = (res as any).content as Array<{ type: string; text?: string }> | undefined;
    const text = content?.find((c) => c.type === 'text')?.text ?? '';
    const sum = Number(text);

    assert.equal(sum, 3);
    console.log('test result: ', sum);

    await client.close();
}

await main();
