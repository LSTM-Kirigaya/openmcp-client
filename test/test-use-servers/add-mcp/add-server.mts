import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'add-mcp',
  version: '0.0.1',
});

server.registerPrompt(
  'add_prompt',
  {
    description: '用于测试的 prompt，提示客户端调用 add 工具。',
  },
  () => {
    return {
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: '这是一个测试 prompt：请调用 add(a,b) 工具完成加法计算，并返回结果。',
          },
        },
      ],
    };
  }
);

server.registerTool(
  'add',
  {
    description: '把两个整数相加，返回 sum。',
    inputSchema: {
      a: z.number().int(),
      b: z.number().int(),
    },
  },
  async ({ a, b }) => {
    const sum = a + b;
    return {
      content: [{ type: 'text', text: String(sum) }],
      // 额外塞一份结构化数据，方便测试断言
      structuredContent: { sum },
    };
  }
);

await server.connect(new StdioServerTransport());

