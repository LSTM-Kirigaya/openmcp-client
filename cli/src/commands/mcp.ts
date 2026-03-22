import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const mcpCommand = new Command('mcp').description('MCP 连接与协议操作（对应 ConnectController / ClientController）');

gw(
  mcpCommand
    .command('connect')
    .description('连接 MCP 服务器（body 为 McpOptions）')
    .option('-c, --config <path>', 'JSON 配置文件（完整 McpOptions）')
    .option('--type <type>', 'STDIO | SSE | STREAMABLE_HTTP（无 --config 时必填）')
    .option('--command <bin>', 'STDIO 可执行文件')
    .option('--args-json <json>', 'STDIO 参数 JSON 数组，如 [\"main.py\"]')
    .option('--url <url>', 'SSE / Streamable HTTP URL')
    .option('--cwd <dir>', '工作目录')
    .action(async (options) => {
      let payload: Record<string, unknown>;
      if (options.config) {
        payload = readJsonFile(options.config);
      } else {
        const type = options.type as string | undefined;
        if (!type) {
          console.error('请使用 --config，或提供 --type（以及对应参数）。');
          process.exitCode = 1;
          return;
        }
        payload = {
          connectionType: type,
          cwd: options.cwd
        };
        if (type === 'STDIO') {
          if (options.command) payload.command = options.command;
          if (options.argsJson) {
            try {
              payload.args = JSON.parse(options.argsJson);
            } catch {
              console.error('--args-json 必须是 JSON 数组');
              process.exitCode = 1;
              return;
            }
          }
        } else {
          if (options.url) payload.url = options.url;
        }
      }

      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('connect', payload, 120000);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('disconnect')
    .description('断开连接')
    .requiredOption('--client-id <id>', 'clientId（connect 返回）')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('disconnect', { clientId: options.clientId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('ping')
    .description('检测 client 是否仍在线')
    .requiredOption('--client-id <id>', 'clientId')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('ping', { clientId: options.clientId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('lookup-env')
    .description('解析环境变量键（lookup-env-var）')
    .requiredOption('--keys <keys>', '逗号分隔，如 USER,HOME')
    .action(async (options) => {
      const keys = String(options.keys)
        .split(',')
        .map((k: string) => k.trim())
        .filter(Boolean);
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('lookup-env-var', { keys });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('server-version')
    .description('获取 MCP server 版本信息')
    .requiredOption('--client-id <id>', 'clientId')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('server/version', { clientId: options.clientId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('prompts-list')
    .description('列出 prompts')
    .requiredOption('--client-id <id>', 'clientId')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('prompts/list', { clientId: options.clientId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('prompts-get')
    .description('获取单个 prompt')
    .requiredOption('--client-id <id>', 'clientId')
    .requiredOption('--prompt-id <id>', 'promptId')
    .option('-d, --data <json>', '额外参数 JSON（args 对象）', '{}')
    .action(async (options) => {
      const args = parseJsonData(options.data);
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('prompts/get', {
          clientId: options.clientId,
          promptId: options.promptId,
          args
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('resources-list')
    .description('列出 resources')
    .requiredOption('--client-id <id>', 'clientId')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('resources/list', { clientId: options.clientId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('resource-templates-list')
    .description('列出 resource templates')
    .requiredOption('--client-id <id>', 'clientId')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('resources/templates/list', { clientId: options.clientId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('resources-read')
    .description('读取 resource')
    .requiredOption('--client-id <id>', 'clientId')
    .requiredOption('--uri <uri>', 'resourceUri')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('resources/read', {
          clientId: options.clientId,
          resourceUri: options.uri
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('tools-list')
    .description('列出 tools')
    .requiredOption('--client-id <id>', 'clientId')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('tools/list', { clientId: options.clientId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpCommand
    .command('tools-call')
    .description('调用 tool')
    .requiredOption('--client-id <id>', 'clientId')
    .requiredOption('--name <name>', 'toolName')
    .option('-a, --args <json>', 'toolArgs JSON 对象', '{}')
    .action(async (options) => {
      const toolArgs = parseJsonData(options.args);
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('tools/call', {
          clientId: options.clientId,
          toolName: options.name,
          toolArgs
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
