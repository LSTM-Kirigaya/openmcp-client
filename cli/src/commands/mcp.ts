import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';
import { HELP_GENERIC_CLIENT, HELP_MCP_CONNECT, HELP_MCP_ROOT } from '../lib/help-text.js';

function normalizeConnectionType(type?: string): 'STDIO' | 'SSE' | 'STREAMABLE_HTTP' | undefined {
  if (!type) return undefined;
  const normalized = type.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (normalized === 'STDIO') return 'STDIO';
  if (normalized === 'SSE') return 'SSE';
  if (normalized === 'STREAMABLE_HTTP' || normalized === 'STREAMABLEHTTP') return 'STREAMABLE_HTTP';
  return undefined;
}

type ConnectPayload = Record<string, unknown>;
type McpServerEntry = Record<string, unknown>;

function resolveConnectionTypeFromServer(server: McpServerEntry): 'STDIO' | 'SSE' | 'STREAMABLE_HTTP' {
  const rawType = typeof server.type === 'string' ? server.type : (typeof server.transport === 'string' ? server.transport : '');
  const normalized = normalizeConnectionType(rawType);
  if (normalized) return normalized;

  if (typeof server.command === 'string' && server.command.trim() !== '') {
    return 'STDIO';
  }
  if (typeof server.url === 'string' && server.url.trim() !== '') {
    return 'SSE';
  }
  return 'STDIO';
}

function mapMcpServerToPayload(server: McpServerEntry): ConnectPayload {
  const payload: ConnectPayload = {
    connectionType: resolveConnectionTypeFromServer(server)
  };
  if (typeof server.command === 'string') payload.command = server.command;
  if (Array.isArray(server.args)) payload.args = server.args;
  if (typeof server.url === 'string') payload.url = server.url;
  if (typeof server.cwd === 'string') payload.cwd = server.cwd;
  if (server.env && typeof server.env === 'object') payload.env = server.env;
  return payload;
}

function resolvePayloadFromConfig(config: ConnectPayload, serverName?: string): ConnectPayload {
  const mcpServers = config.mcpServers;
  if (mcpServers && typeof mcpServers === 'object' && !Array.isArray(mcpServers)) {
    const servers = mcpServers as Record<string, McpServerEntry>;
    const names = Object.keys(servers);
    if (names.length === 0) {
      throw new Error('配置文件为 mcpServers 格式，但未包含任何 server。');
    }

    let pickedName = serverName;
    if (!pickedName) {
      if (names.length === 1) {
        pickedName = names[0];
      } else {
        throw new Error(
          `检测到 mcpServers 聚合配置，包含多个 server。请使用 --mcp-server 指定目标。\n可选值: ${names.join(', ')}`
        );
      }
    }

    const server = servers[pickedName];
    if (!server) {
      throw new Error(
        `未找到 mcpServer "${pickedName}"。\n可选值: ${names.join(', ')}`
      );
    }
    return mapMcpServerToPayload(server);
  }

  if (serverName) {
    throw new Error('当前配置文件是扁平 McpOptions 格式，不支持 --mcp-server。');
  }

  const fileType = normalizeConnectionType(config.connectionType as string | undefined);
  if (fileType) config.connectionType = fileType;
  return config;
}

function gw(cmd: Command): Command {
  return cmd.option(
    '-g, --gateway <url>',
    'Gateway WebSocket URL（需已 openmcp-cli gateway start）',
    DEFAULT_GATEWAY
  );
}

export const mcpCommand = new Command('mcp')
  .description(
    'MCP 连接与协议操作（ConnectController / ClientController）。须先启动 Gateway；connect 成功后用返回的 clientId 调用其它子命令。'
  )
  .addHelpText('after', HELP_MCP_ROOT);

gw(
  mcpCommand
    .command('connect')
    .description(
      '连接 MCP 服务器：发送 McpOptions 到 service「connect」。务必使用 --config-file 指向 JSON 文件，或 --type + 对应参数。'
    )
    .option(
      '-c, --config-file <path>',
      'JSON 文件路径：支持扁平 McpOptions 和 mcpServers 聚合格式（见下方示例）'
    )
    .option('--mcp-server <name>', '当 --config-file 为 mcpServers 聚合格式时，指定要连接的 server 名称')
    .option('--type <type>', '无 --config-file 时必填：STDIO | SSE | STREAMABLE_HTTP（大小写不敏感）')
    .option('--command <bin>', '仅 STDIO：可执行文件，如 npx、node、uvx')
    .option('--args-json <json>', '仅 STDIO：参数 JSON 数组，建议整体用单引号包裹，如 \'["-y","pkg"]\'')
    .option('--url <url>', 'SSE / STREAMABLE_HTTP：服务端 URL')
    .option('--cwd <dir>', '工作目录（STDIO 常用）')
    .addHelpText('after', HELP_MCP_CONNECT)
    .action(async function (this: Command, options) {
      let payload: Record<string, unknown>;
      if (options.configFile) {
        try {
          const config = readJsonFile(options.configFile);
          payload = resolvePayloadFromConfig(config, options.mcpServer as string | undefined);
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
          process.exitCode = 1;
          return;
        }
      } else {
        if (options.mcpServer) {
          console.error('--mcp-server 仅在 --config-file 模式下可用');
          process.exitCode = 1;
          return;
        }
        const type = normalizeConnectionType(options.type as string | undefined);
        if (!type) {
          this.help({ error: true });
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
    .description('断开连接（disconnect）')
    .requiredOption('--client-id <id>', 'connect 成功响应中的 msg.clientId')
    .addHelpText('after', HELP_GENERIC_CLIENT)
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
    .description('检测 MCP 会话是否仍在线')
    .requiredOption('--client-id <id>', 'connect 返回的 clientId')
    .addHelpText('after', HELP_GENERIC_CLIENT)
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
    .description('按 key 列表解析当前进程环境（lookup-env-var），用于前端展示等')
    .requiredOption('--keys <keys>', '逗号分隔，如 USER,HOME,PATH')
    .addHelpText(
      'after',
      '\n示例:\n  openmcp-cli mcp lookup-env --keys USER,HOME\n'
    )
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
    .description('获取已连接 MCP Server 的实现信息（server/version）')
    .requiredOption('--client-id <id>', 'connect 返回的 clientId')
    .addHelpText('after', HELP_GENERIC_CLIENT)
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
    .description('列出 prompts（prompts/list）')
    .requiredOption('--client-id <id>', 'connect 返回的 clientId')
    .addHelpText('after', HELP_GENERIC_CLIENT)
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
    .description('获取单个 prompt 内容（prompts/get）')
    .requiredOption('--client-id <id>', 'clientId')
    .requiredOption('--prompt-id <id>', 'MCP 中的 prompt 名称/ id')
    .option('-d, --data <json>', '传给 getPrompt 的 args 对象 JSON', '{}')
    .addHelpText(
      'after',
      '\n示例:\n  openmcp-cli mcp prompts-get -c <clientId> --prompt-id my_prompt -d "{}"\n'
    )
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
    .description('列出 resources（resources/list）')
    .requiredOption('--client-id <id>', 'clientId')
    .addHelpText('after', HELP_GENERIC_CLIENT)
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
    .description('列出 resource templates（resources/templates/list）')
    .requiredOption('--client-id <id>', 'clientId')
    .addHelpText('after', HELP_GENERIC_CLIENT)
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
    .description('按 URI 读取 resource 内容（resources/read）')
    .requiredOption('--client-id <id>', 'clientId')
    .requiredOption('--uri <uri>', 'MCP resource URI')
    .addHelpText(
      'after',
      '\n示例:\n  openmcp-cli mcp resources-read -c <clientId> --uri "file:///..."\n'
    )
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
    .description('列出 tools（tools/list）')
    .requiredOption('--client-id <id>', 'clientId')
    .addHelpText('after', HELP_GENERIC_CLIENT)
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
    .description('调用指定 tool（tools/call）')
    .requiredOption('--client-id <id>', 'clientId')
    .requiredOption('--name <name>', '工具名称（与 tools-list 中一致）')
    .option('-a, --args <json>', '传给工具的参数对象 JSON', '{}')
    .addHelpText(
      'after',
      `\n示例:\n  openmcp-cli mcp tools-call -c <clientId> --name echo -a '{"message":"hi"}'\n`
    )
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
