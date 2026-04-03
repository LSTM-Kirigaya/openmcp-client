import fs from 'node:fs';
import { Command } from 'commander';
import { DEFAULT_GATEWAY, printJson, withGateway } from '../../lib/cli-helpers.js';
import { resolvePayloadFromConfig } from '../../lib/mcp-config.js';

interface ServerItem {
  id: string;
  name: string;
  source: 'local' | 'cloud';
  connectionType?: string;
  command?: string;
  args?: string[];
  url?: string;
  cwd?: string;
  transport?: string;
  endpoint?: string;
  description?: string;
  enabled?: boolean;
  serverInfo?: { name?: string; version?: string };
  [key: string]: unknown;
}

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function parseAnyJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { throw new Error('JSON 解析失败'); }
}

function readAnyJsonFile(filePath: string): unknown {
  return parseAnyJson(fs.readFileSync(filePath, 'utf-8'));
}

function loadEntryFromOptions(options: {
  file?: string;
  data?: string;
  mcpServer?: string;
}): Record<string, unknown> {
  const source = typeof options.file === 'string' && options.file.trim()
    ? readAnyJsonFile(options.file)
    : typeof options.data === 'string' && options.data.trim()
      ? parseAnyJson(options.data)
      : undefined;
  if (source === undefined) {
    throw new Error('请使用 --file 或 --data 提供连接定义');
  }
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const maybeRecord = source as Record<string, unknown>;
    if (maybeRecord.mcpServers) {
      return resolvePayloadFromConfig(maybeRecord, options.mcpServer) as Record<string, unknown>;
    }
    return maybeRecord;
  }
  throw new Error('连接定义必须是 JSON 对象');
}

function describeServer(item: ServerItem): string {
  const sourceTag = item.source === 'cloud' ? '[云端]' : '[本地]';
  const name = item.name || '未命名';

  if (item.source === 'cloud') {
    const transport = item.transport || '未知';
    const endpoint = item.endpoint || '(未设置)';
    const status = item.enabled === false ? '已禁用' : '已启用';
    const lines = [
      `  ${sourceTag}  ${name}  (${status})`,
      `    ID:       ${item.id}`,
      `    传输:     ${transport}`,
      `    端点:     ${endpoint}`,
    ];
    if (item.description) lines.push(`    描述:     ${item.description}`);
    return lines.join('\n');
  }

  const type = item.connectionType || '未知';
  let endpoint = '';
  if (type === 'STDIO') {
    const cmd = item.command || '';
    const args = Array.isArray(item.args) ? item.args.join(' ') : '';
    endpoint = `${cmd} ${args}`.trim();
  } else {
    endpoint = item.url || '(未设置)';
  }
  const version = item.serverInfo?.version ? ` v${item.serverInfo.version}` : '';

  const lines = [
    `  ${sourceTag}  ${name}${version}`,
    `    ID:       ${item.id}`,
    `    类型:     ${type}`,
    `    ${type === 'STDIO' ? '命令' : '地址'}:     ${endpoint}`,
  ];
  if (item.cwd) lines.push(`    工作目录:  ${item.cwd}`);
  return lines.join('\n');
}

export const mcpServerCommand = new Command('server')
  .description('MCP Server 配置管理（本地 + 云端统一管理）')
  .addHelpText('after', `
示例:
  列出所有 Server:     openmcp-cli mcp server list
  查看某个 Server:     openmcp-cli mcp server get --id <ID>
  添加本地 Server:     openmcp-cli mcp server add -f ./my-server.json
  删除本地 Server:     openmcp-cli mcp server delete --id <ID>

说明:
  list 命令同时显示本地和云端的 MCP Server。
  add/delete 仅操作本地 Server；云端 Server 通过云端平台管理。
`);

/* ── list ── */

gw(
  mcpServerCommand
    .command('list')
    .description('列出所有 MCP Server（本地 + 云端）')
    .option('--json', '输出原始 JSON', false)
    .option('--source <source>', '筛选来源: local | cloud')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/list', {});
          if (res.code !== 200) {
            console.error(`查询失败: ${res.msg}`);
            process.exitCode = 1;
            return;
          }

          const allServers: ServerItem[] = (res.data as any)?.servers || [];
          const filtered = options.source
            ? allServers.filter(s => s.source === options.source)
            : allServers;

          if (options.json) {
            printJson(filtered);
            return;
          }

          if (filtered.length === 0) {
            console.log('当前未配置任何 MCP Server。');
            console.log('');
            console.log('添加方式:');
            console.log('  openmcp-cli mcp server add -f ./my-server.json');
            return;
          }

          const local = filtered.filter(s => s.source === 'local');
          const cloud = filtered.filter(s => s.source === 'cloud');

          if (local.length > 0) {
            console.log(`本地 Server（${local.length} 个）:\n`);
            for (const s of local) {
              console.log(describeServer(s));
              console.log('');
            }
          }

          if (cloud.length > 0) {
            if (local.length > 0) console.log('─'.repeat(50));
            console.log(`云端 Server（${cloud.length} 个）:\n`);
            for (const s of cloud) {
              console.log(describeServer(s));
              console.log('');
            }
          }

          console.log('─'.repeat(50));
          console.log('操作提示:');
          console.log('  查看详情:  openmcp-cli mcp server get --id <ID>');
          console.log('  添加本地:  openmcp-cli mcp server add -f <配置文件>');
          console.log('  删除本地:  openmcp-cli mcp server delete --id <ID>');
          console.log('  建立连接:  openmcp-cli mcp session connect --id <ID>');
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── get ── */

gw(
  mcpServerCommand
    .command('get')
    .description('查看单个 MCP Server 详情')
    .requiredOption('--id <id>', 'Server ID')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/get', { id: options.id });
          if (res.code !== 200) {
            console.error(res.msg);
            process.exitCode = 1;
            return;
          }
          const server = res.data as ServerItem;
          console.log(describeServer(server));
          console.log('\n完整配置:');
          printJson(server);
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── add ── */

gw(
  mcpServerCommand
    .command('add')
    .description('添加新的本地 MCP Server 配置')
    .option('-f, --file <path>', '连接配置 JSON 文件')
    .option('--data <json>', '内联 JSON')
    .option('--name <name>', 'Server 显示名称')
    .option('--mcp-server <name>', '当输入为 mcpServers 聚合格式时指定 server 名')
    .action(async (options) => {
      try {
        const entry = loadEntryFromOptions(options);
        if (options.name) entry.name = options.name;
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/save', entry);
          if (res.code !== 200) {
            console.error(res.msg);
            process.exitCode = 1;
            return;
          }
          const saved = res.data as any;
          console.log(`✔ 已添加 Server: ${saved?.name} (${saved?.id})`);
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── delete ── */

gw(
  mcpServerCommand
    .command('delete')
    .description('删除本地 MCP Server 配置')
    .requiredOption('--id <id>', 'Server ID')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/delete', { id: options.id });
          if (res.code !== 200) {
            console.error(res.msg);
            process.exitCode = 1;
            return;
          }
          console.log(`✔ 已删除 Server: ${options.id}`);
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);
