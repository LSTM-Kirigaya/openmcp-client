import { Command } from 'commander';
import {
  printJson,
  printResponse,
  withGateway,
  DEFAULT_GATEWAY,
  parseJsonData,
  readJsonFile,
  writeJsonFile
} from '../lib/cli-helpers.js';
import { HELP_GENERIC_CLIENT, HELP_MCP_CONNECT, HELP_MCP_ROOT } from '../lib/help-text.js';
import {
  buildTemplate,
  normalizeConnectionType,
  payloadToMcpServer,
  previewMergedEnv,
  resolvePayloadFromConfig,
  validateConfig
} from '../lib/mcp-config.js';
import {
  getCurrentClientId,
  getRecentSessions,
  getSessionByClientId,
  getSessionStorePath,
  rememberSession,
  removeSession,
  requireClientId,
  setCurrentClientId
} from '../lib/mcp-session-store.js';
import { findRpcHistoryById, getRpcHistoryPath, queryRpcHistory } from '../lib/rpc-history.js';
import { diagnoseThrownError } from '../lib/error-diagnose.js';

type ConnectPayload = Record<string, unknown>;
type CloudProjectTransport = 'stdio' | 'sse' | 'http';

type CloudProjectItem = {
  id: string;
  name: string;
  transport: CloudProjectTransport;
  endpoint: string;
  description?: string;
  enabled?: boolean;
};

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL（需已 openmcp-cli gateway start）', DEFAULT_GATEWAY);
}

function resolveClientIdForCommand(options: { clientId?: string; gateway: string }): string {
  const clientId = requireClientId(options.clientId);
  rememberSession(clientId, options.gateway);
  return clientId;
}

function printThrown(error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  console.error(text);
  for (const tip of diagnoseThrownError(error)) {
    console.error(`[diagnose] ${tip}`);
  }
  process.exitCode = 1;
}

function toCloudProjectList(response: { data?: unknown; msg?: unknown }): CloudProjectItem[] {
  const raw = (response.data ?? response.msg) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is CloudProjectItem => {
    return (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as any).id === 'string' &&
      typeof (item as any).name === 'string' &&
      typeof (item as any).transport === 'string' &&
      typeof (item as any).endpoint === 'string'
    );
  });
}

function mapCloudTransportToConnectionType(transport: CloudProjectTransport): 'STDIO' | 'SSE' | 'STREAMABLE_HTTP' {
  if (transport === 'stdio') return 'STDIO';
  if (transport === 'sse') return 'SSE';
  return 'STREAMABLE_HTTP';
}

function buildPayloadFromCloudProject(project: CloudProjectItem): ConnectPayload {
  const connectionType = mapCloudTransportToConnectionType(project.transport);
  if (connectionType === 'STDIO') {
    return {
      connectionType,
      command: project.endpoint
    };
  }
  return {
    connectionType,
    url: project.endpoint
  };
}

export const mcpCommand = new Command('mcp')
  .description('MCP 连接与协议操作（ConnectController / ClientController）。支持会话管理、配置生命周期、历史回放。')
  .addHelpText('after', HELP_MCP_ROOT);

gw(
  mcpCommand
    .command('connect')
    .description('连接 MCP 服务器：发送 McpOptions 到 service「connect」。支持配置文件或命令行参数。')
    .option('-c, --config-file <path>', 'JSON 文件路径：支持扁平 McpOptions 和 mcpServers 聚合格式（见下方示例）')
    .option('--mcp-server <name>', '当 --config-file 为 mcpServers 聚合格式时，指定要连接的 server 名称')
    .option('--type <type>', '无 --config-file 时必填：STDIO | SSE | STREAMABLE_HTTP（大小写不敏感）')
    .option('--command <bin>', '仅 STDIO：可执行文件，如 npx、node、uvx')
    .option('--args-json <json>', '仅 STDIO：参数 JSON 数组，建议整体用单引号包裹，如 \'["-y","pkg"]\'')
    .option('--url <url>', 'SSE / STREAMABLE_HTTP：服务端 URL')
    .option('--cwd <dir>', '工作目录（STDIO 常用）')
    .addHelpText('after', HELP_MCP_CONNECT)
    .action(async function (this: Command, options) {
      try {
        let payload: ConnectPayload;
        if (options.configFile) {
          const config = readJsonFile(options.configFile);
          payload = resolvePayloadFromConfig(config, options.mcpServer as string | undefined);
        } else {
          if (options.mcpServer) {
            throw new Error('--mcp-server 仅在 --config-file 模式下可用');
          }
          const type = normalizeConnectionType(options.type as string | undefined);
          if (!type) {
            this.help({ error: true });
            return;
          }
          payload = { connectionType: type, cwd: options.cwd };
          if (type === 'STDIO') {
            if (options.command) payload.command = options.command;
            if (options.argsJson) {
              const parsed = JSON.parse(options.argsJson);
              if (!Array.isArray(parsed)) throw new Error('--args-json 必须是 JSON 数组');
              payload.args = parsed;
            }
          } else if (options.url) {
            payload.url = options.url;
          }
        }

        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('connect', payload, 120000);
          printResponse('connect', res);
          if (res.code === 200 && typeof (res.msg as any)?.clientId === 'string') {
            rememberSession((res.msg as any).clientId, options.gateway, payload);
          }
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('cloud-list')
    .description('列出云端 MCP 项目（projects/list），用于连接前查看可选项')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('projects/list', {});
          printResponse('projects/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('cloud-connect')
    .description('通过云端 MCP 项目直接连接（projects/list -> connect）')
    .option('--project-id <id>', '云端项目 ID')
    .option('--name <name>', '云端项目名（与 --project-id 二选一）')
    .option('--allow-disabled', '允许连接 disabled 项目', false)
    .action(async function (this: Command, options) {
      try {
        if (!options.projectId && !options.name) {
          this.help({ error: true });
          return;
        }

        await withGateway(options.gateway, async (bridge) => {
          const listRes = await bridge.commandRequest('projects/list', {});
          if (listRes.code !== 200) {
            printResponse('projects/list', listRes);
            process.exitCode = 1;
            return;
          }
          const projects = toCloudProjectList(listRes);
          const project = projects.find((item) => {
            if (!options.allowDisabled && item.enabled === false) return false;
            if (options.projectId) return item.id === options.projectId;
            return item.name === options.name;
          });
          if (!project) {
            throw new Error('未找到匹配的云端项目（或项目已被禁用）');
          }

          const payload = buildPayloadFromCloudProject(project);
          const connectRes = await bridge.commandRequest('connect', payload, 120000);
          printResponse('connect', connectRes);
          const clientId = (connectRes.msg as any)?.clientId ?? (connectRes.data as any)?.clientId;
          if (connectRes.code === 200 && typeof clientId === 'string') {
            rememberSession(clientId, options.gateway, payload);
          }
          if (connectRes.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

const sessionsCmd = new Command('sessions').description('会话管理（默认会话 / 最近连接 / 网关活动会话）');
gw(
  sessionsCmd
    .command('list')
    .description('列出 Gateway 中当前活跃会话（connect/list）')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('connect/list', {});
          printResponse('connect/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
sessionsCmd
  .command('current')
  .description('查看当前默认会话')
  .action(() => {
    printJson({
      currentClientId: getCurrentClientId() ?? null,
      storePath: getSessionStorePath()
    });
  });
sessionsCmd
  .command('recent')
  .description('查看最近连接记录')
  .option('--limit <n>', '数量，默认 20', '20')
  .action((options) => {
    const limit = Number(options.limit || 20);
    printJson({
      currentClientId: getCurrentClientId() ?? null,
      recent: getRecentSessions(limit),
      storePath: getSessionStorePath()
    });
  });
sessionsCmd
  .command('use')
  .description('切换默认会话')
  .requiredOption('--client-id <id>', '目标 clientId')
  .action((options) => {
    setCurrentClientId(options.clientId);
    printJson({ ok: true, currentClientId: options.clientId });
  });
mcpCommand.addCommand(sessionsCmd);

const configCmd = new Command('config').description('MCP 配置生命周期：校验、模板、导出、env 预览');
configCmd
  .command('validate')
  .description('校验配置文件结构与连接字段')
  .requiredOption('-f, --file <path>', '配置文件路径')
  .action((options) => {
    try {
      const config = readJsonFile(options.file);
      const result = validateConfig(config);
      printJson(result);
      if (!result.ok) process.exitCode = 1;
    } catch (error) {
      printThrown(error);
    }
  });
configCmd
  .command('init')
  .description('生成模板配置')
  .option('--template <kind>', 'stdio | sse | http', 'stdio')
  .requiredOption('-o, --output <path>', '输出文件')
  .action((options) => {
    const kind = String(options.template).toLowerCase() as 'stdio' | 'sse' | 'http';
    if (!['stdio', 'sse', 'http'].includes(kind)) {
      printThrown('模板仅支持 stdio|sse|http');
      return;
    }
    const template = buildTemplate(kind);
    writeJsonFile(options.output, template);
    printJson({ ok: true, output: options.output, template: kind });
  });
configCmd
  .command('export')
  .description('从本地会话记录导出 mcpServers 配置')
  .requiredOption('--client-id <id>', '会话 clientId')
  .requiredOption('-o, --output <path>', '输出文件')
  .option('--name <name>', 'mcpServers 的 server 名称')
  .action((options) => {
    const session = getSessionByClientId(options.clientId);
    if (!session?.connectPayload) {
      printThrown('该会话没有可导出的 connectPayload，请先用当前 CLI 重新 connect 一次。');
      return;
    }
    const serverName = options.name || `server-${options.clientId.slice(0, 8)}`;
    const out = {
      version: '1.0.0',
      mcpServers: {
        [serverName]: payloadToMcpServer(session.connectPayload)
      }
    };
    writeJsonFile(options.output, out);
    printJson({ ok: true, output: options.output, serverName });
  });
configCmd
  .command('env-preview')
  .description('展示配置解析后的 env 注入结果（基于当前 CLI 进程环境）')
  .requiredOption('-f, --file <path>', '配置文件路径')
  .option('--mcp-server <name>', '聚合配置时指定 server')
  .action((options) => {
    try {
      const config = readJsonFile(options.file);
      const payload = resolvePayloadFromConfig(config, options.mcpServer as string | undefined);
      const preview = previewMergedEnv(payload);
      printJson({
        connectionType: payload.connectionType,
        injectedKeys: preview.injectedKeys,
        mergedEnv: preview.env
      });
    } catch (error) {
      printThrown(error);
    }
  });
mcpCommand.addCommand(configCmd);

const historyCmd = new Command('history').description('CLI 调用历史与回放');
historyCmd
  .command('list')
  .description('列出调用历史')
  .option('--limit <n>', '数量，默认 20', '20')
  .option('--command <name>', '按命令过滤，如 tools/call')
  .option('--failed', '仅失败请求', false)
  .action((options) => {
    const limit = Number(options.limit || 20);
    const rows = queryRpcHistory({
      limit,
      command: options.command,
      failedOnly: Boolean(options.failed)
    });
    printJson({ path: getRpcHistoryPath(), total: rows.length, rows });
  });
gw(
  historyCmd
    .command('replay')
    .description('回放历史请求（按 id 或失败记录）')
    .option('--id <id>', '按记录 ID 回放单条')
    .option('--failed', '回放最近失败记录', false)
    .option('--limit <n>', '失败回放数量，默认 1', '1')
    .action(async (options) => {
      try {
        const tasks = options.id
          ? [findRpcHistoryById(options.id)].filter(Boolean)
          : queryRpcHistory({ failedOnly: Boolean(options.failed), limit: Number(options.limit || 1) });
        if (tasks.length === 0) {
          throw new Error('未找到可回放的历史记录');
        }

        await withGateway(options.gateway, async (bridge) => {
          for (const row of tasks as any[]) {
            const req = { ...(row.request || {}) };
            delete (req as any)._id;
            const res = await bridge.commandRequest(row.command, req);
            printResponse(row.command, res);
            if (res.code !== 200) process.exitCode = 1;
          }
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
mcpCommand.addCommand(historyCmd);

gw(
  mcpCommand
    .command('disconnect')
    .description('断开连接（disconnect）')
    .option('--client-id <id>', 'connect 成功响应中的 msg.clientId；不传则使用当前默认会话')
    .addHelpText('after', HELP_GENERIC_CLIENT)
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('disconnect', { clientId });
          printResponse('disconnect', res);
          if (res.code === 200) removeSession(clientId);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('ping')
    .description('检测 MCP 会话是否仍在线')
    .option('--client-id <id>', 'connect 返回的 clientId；不传则使用当前默认会话')
    .addHelpText('after', HELP_GENERIC_CLIENT)
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('ping', { clientId });
          printResponse('ping', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('lookup-env')
    .description('按 key 列表解析当前进程环境（lookup-env-var），用于前端展示等')
    .requiredOption('--keys <keys>', '逗号分隔，如 USER,HOME,PATH')
    .addHelpText('after', '\n示例:\n  openmcp-cli mcp lookup-env --keys USER,HOME\n')
    .action(async (options) => {
      try {
        const keys = String(options.keys)
          .split(',')
          .map((k: string) => k.trim())
          .filter(Boolean);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('lookup-env-var', { keys });
          printResponse('lookup-env-var', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('server-version')
    .description('获取已连接 MCP Server 的实现信息（server/version）')
    .option('--client-id <id>', 'connect 返回的 clientId；不传则使用当前默认会话')
    .addHelpText('after', HELP_GENERIC_CLIENT)
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('server/version', { clientId });
          printResponse('server/version', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('prompts-list')
    .description('列出 prompts（prompts/list）')
    .option('--client-id <id>', 'connect 返回的 clientId；不传则使用当前默认会话')
    .addHelpText('after', HELP_GENERIC_CLIENT)
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('prompts/list', { clientId });
          printResponse('prompts/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('prompts-get')
    .description('获取单个 prompt 内容（prompts/get）')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .requiredOption('--prompt-id <id>', 'MCP 中的 prompt 名称/ id')
    .option('-d, --data <json>', '传给 getPrompt 的 args 对象 JSON', '{}')
    .addHelpText('after', '\n示例:\n  openmcp-cli mcp prompts-get -c <clientId> --prompt-id my_prompt -d "{}"\n')
    .action(async (options) => {
      try {
        const args = parseJsonData(options.data);
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('prompts/get', { clientId, promptId: options.promptId, args });
          printResponse('prompts/get', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('resources-list')
    .description('列出 resources（resources/list）')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .addHelpText('after', HELP_GENERIC_CLIENT)
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('resources/list', { clientId });
          printResponse('resources/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('resource-templates-list')
    .description('列出 resource templates（resources/templates/list）')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .addHelpText('after', HELP_GENERIC_CLIENT)
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('resources/templates/list', { clientId });
          printResponse('resources/templates/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('resources-read')
    .description('按 URI 读取 resource 内容（resources/read）')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .requiredOption('--uri <uri>', 'MCP resource URI')
    .addHelpText('after', '\n示例:\n  openmcp-cli mcp resources-read -c <clientId> --uri "file:///..."\n')
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('resources/read', { clientId, resourceUri: options.uri });
          printResponse('resources/read', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('tools-list')
    .description('列出 tools（tools/list）')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .addHelpText('after', HELP_GENERIC_CLIENT)
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('tools/list', { clientId });
          printResponse('tools/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpCommand
    .command('tools-call')
    .description('调用指定 tool（tools/call）')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .requiredOption('--name <name>', '工具名称（与 tools-list 中一致）')
    .option('-a, --args <json>', '传给工具的参数对象 JSON', '{}')
    .addHelpText('after', `\n示例:\n  openmcp-cli mcp tools-call -c <clientId> --name echo -a '{"message":"hi"}'\n`)
    .action(async (options) => {
      try {
        const toolArgs = parseJsonData(options.args);
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('tools/call', { clientId, toolName: options.name, toolArgs });
          printResponse('tools/call', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
