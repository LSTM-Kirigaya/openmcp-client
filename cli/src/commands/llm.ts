import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';
import { HELP_LLM } from '../lib/help-text.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const llmCommand = new Command('llm')
  .description('LLM 模型列表与同步补全（LlmController）；流式对话请用 Web UI。')
  .addHelpText('after', HELP_LLM);

gw(
  llmCommand
    .command('models')
    .description('列出模型（OpenAI 兼容 /baseURL）')
    .requiredOption('--base-url <url>', 'API base URL')
    .requiredOption('--api-key <key>', 'API Key')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('llm/models', {
          baseURL: options.baseUrl,
          apiKey: options.apiKey
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  llmCommand
    .command('models-openrouter')
    .description('获取 OpenRouter 模型列表')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('llm/models/openrouter', {});
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  llmCommand
    .command('models-dynamic')
    .description('动态提供商模型列表')
    .requiredOption('--provider-id <id>', '例如 openrouter')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('llm/models/dynamic', {
          providerId: options.providerId
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  llmCommand
    .command('chat-sync')
    .description('同步聊天补全（非流式）')
    .option('-f, --file <path>', '请求 JSON：baseURL, apiKey, model, messages, temperature?')
    .option('-d, --data <json>', '内联 JSON（与 -f 合并）')
    .action(async (options) => {
      let body: Record<string, unknown> = {};
      if (options.data) body = { ...body, ...parseJsonData(options.data) };
      if (options.file) body = { ...body, ...readJsonFile(options.file) };
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('llm/chat/completions/sync', body, 600000);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  llmCommand
    .command('abort')
    .description('中止流式会话（需 sessionId）')
    .requiredOption('--session-id <id>', 'sessionId')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('llm/chat/completions/abort', {
          sessionId: options.sessionId
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
