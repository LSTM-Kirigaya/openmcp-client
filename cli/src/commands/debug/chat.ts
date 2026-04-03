import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../../lib/cli-helpers.js';
import { rememberSession, requireClientId } from '../../lib/mcp-session-store.js';
import { diagnoseThrownError } from '../../lib/error-diagnose.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function printThrown(error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  console.error(text);
  for (const tip of diagnoseThrownError(error)) {
    console.error(`[diagnose] ${tip}`);
  }
  process.exitCode = 1;
}

export const chatCommand = new Command('chat')
  .description('交互测试：使用 LLM Agent 测试 MCP Server');

gw(
  chatCommand
    .command('start')
    .description('启动交互测试会话')
    .option('--client-id <id>', 'MCP 会话 clientId；不传则使用当前默认会话')
    .requiredOption('--provider <id>', 'LLM 提供商 id')
    .requiredOption('--model <name>', '模型名称')
    .option('-m, --message <text>', '初始用户消息')
    .option('-f, --file <path>', '从 JSON 文件读取 messages 数组')
    .option('--max-turns <n>', '最大交互轮次', '10')
    .action(async (options) => {
      try {
        const clientId = requireClientId(options.clientId);
        rememberSession(clientId, options.gateway);

        await withGateway(options.gateway, async (bridge) => {
          const settingsRes = await bridge.commandRequest('setting/load', {});
          if (settingsRes.code !== 200) {
            printJson(settingsRes);
            process.exitCode = 1;
            return;
          }

          const settings = settingsRes.msg as any;
          const llmInfo = Array.isArray(settings?.LLM_INFO) ? settings.LLM_INFO : [];
          const lower = options.provider.toLowerCase();
          const provider = llmInfo.find(
            (p: any) => p.id?.toLowerCase() === lower || p.name?.toLowerCase() === lower
          );
          if (!provider) {
            console.error(`未找到提供商 "${options.provider}"。`);
            process.exitCode = 1;
            return;
          }
          if (!provider.userToken) {
            console.error(`提供商 "${provider.id}" 的 API Key 未设置。`);
            process.exitCode = 1;
            return;
          }

          let messages: unknown[] = [];
          if (options.message) {
            messages = [{ role: 'user', content: options.message }];
          } else if (options.file) {
            try {
              const fileContent = readJsonFile(options.file);
              messages = Array.isArray(fileContent) ? fileContent : (fileContent.messages as unknown[] ?? []);
            } catch (e: any) {
              console.error(`读取文件失败: ${e.message}`);
              process.exitCode = 1;
              return;
            }
          }

          if (messages.length === 0) {
            console.error('缺少消息内容，请通过 -m 或 -f 提供。');
            process.exitCode = 1;
            return;
          }

          const body = {
            clientId,
            baseURL: provider.baseUrl,
            apiKey: provider.userToken,
            model: options.model,
            messages,
            maxTurns: Number(options.maxTurns) || 10,
          };

          console.log(`交互测试: ${provider.name} | ${options.model}`);
          console.log(`MCP 会话: ${clientId}`);
          console.log('');

          const res = await bridge.commandRequest('batch-validation/run', body, 600000);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
