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

/** add / edit 共用：印在子命令 --help 文末 */
function serverJsonFieldsHelpText(): string {
  return `
JSON 怎么写（add 要完整可连；edit 只写要改的键；本地与云端是同一类对象）

  • 用 --file 或 --data 传入一个 JSON 对象（二选一）。
  • 默认 --scope local 写入本机；--scope cloud 同步到云端（需已登录）。
  • 统一按下面 connectionType 形式填写；云端由服务端映射为项目字段，无需在 CLI 侧换格式。

先选定连接类型，再按该类填必填项（connectionType 是字段名，取值如下）：

【connectionType = STDIO】
  必填：connectionType: "STDIO", command（可执行文件或解释器入口）
  可选：args（字符串数组）, cwd, env（对象）, name, description

【connectionType = SSE】
  必填：connectionType: "SSE", url（SSE 入口地址）
  可选：oauth, env, name, description

【connectionType = STREAMABLE_HTTP】（也可写 HTTP，会归一为 STREAMABLE_HTTP）
  必填：connectionType: "STREAMABLE_HTTP", url
  可选：oauth, env, name, description

【Cursor 风格聚合】根级 mcpServers: { "别名": { ... } }；多个别名时命令行需加 --mcp-server <别名>

示例（--data；本地可省略 --scope cloud）

  STDIO:
  --scope cloud --data '{"name":"demo-stdio","connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}'

  SSE:
  --scope cloud --data '{"name":"demo-sse","connectionType":"SSE","url":"https://example.com/mcp/sse"}'

  STREAMABLE_HTTP:
  --scope cloud --data '{"name":"demo-http","connectionType":"STREAMABLE_HTTP","url":"https://example.com/mcp"}'

PowerShell 建议整条 --data 用单引号包住 JSON，避免转义问题。
`.trim();
}

const ERR_NEED_FILE_OR_DATA =
  '请使用 --file 或 --data 提供 JSON。\n' +
  '字段说明请查看: openmcp-cli mcp server add --help';

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
    throw new Error(ERR_NEED_FILE_OR_DATA);
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
    const lines = [
      `  ${sourceTag}  ${name}`,
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
  列出全部:            openmcp-cli mcp server list
  仅列出本地/云端:      openmcp-cli mcp server list --scope local
  查看详情:             openmcp-cli mcp server get --id <ID>
  添加本地 Server:      openmcp-cli mcp server add --file ./my-server.json
  添加云端 Server:      openmcp-cli mcp server add --scope cloud --file ./cloud.json
  编辑 Server:          openmcp-cli mcp server edit --id <ID> --file ./patch.json
  改名(内联 JSON):     openmcp-cli mcp server edit --id <ID> --data "{\\"name\\":\\"新名称\\"}"
  删除 Server:          openmcp-cli mcp server delete --id <ID>

说明:
  list 默认合并本地与云端；用 --scope 可只看一侧。
  add / edit 的 JSON 字段相同：--file 与 --data 二选一；详见各子命令 -h 文末。
  add 默认写入本地；--scope cloud 时在云端创建项目（需已登录）。
  edit 按 --id 自动识别本地或云端（无需 --scope）。
  get/delete 按 ID 自动区分本地记录与云端项目。
`);

/* ── list ── */

gw(
  mcpServerCommand
    .command('list')
    .description('列出 MCP Server（默认本地 + 云端）')
    .option('--json', '输出原始 JSON', false)
    .option(
      '--scope <scope>',
      '筛选范围: all（默认）| local | cloud',
      'all'
    )
    .action(async (options) => {
      try {
        const scope = String(options.scope || 'all').toLowerCase();
        if (!['all', 'local', 'cloud'].includes(scope)) {
          console.error('无效的 --scope，请使用 all、local 或 cloud');
          process.exitCode = 1;
          return;
        }
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/list', {});
          if (res.code !== 200) {
            console.error(`查询失败: ${res.msg}`);
            process.exitCode = 1;
            return;
          }

          const allServers: ServerItem[] = (res.data as any)?.servers || [];
          const filtered =
            scope === 'all'
              ? allServers
              : allServers.filter(s => s.source === scope);

          if (options.json) {
            printJson(filtered);
            return;
          }

          if (filtered.length === 0) {
            console.log('当前未配置任何 MCP Server。');
            console.log('');
            console.log('添加方式:');
            console.log('  本地:  openmcp-cli mcp server add --file ./my-server.json');
            console.log('  云端:  openmcp-cli mcp server add --scope cloud --file ./cloud.json');
            if (scope === 'cloud') {
              console.log('');
              console.log('提示: 云端列表需已登录云端账号。');
            }
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
          console.log('  添加:      openmcp-cli mcp server add [--scope cloud] --file <配置文件>');
          console.log('  编辑:      openmcp-cli mcp server edit --id <ID> --file <patch.json>');
          console.log('  删除:      openmcp-cli mcp server delete --id <ID>');
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
    .description('查看单个 MCP Server 详情（本地或云端，按 ID）')
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
    .description('添加 MCP Server 配置（默认本地，可用 --scope cloud 创建云端项目）')
    .option('--file <path>', 'JSON 配置文件（与 --data 二选一）')
    .option('--data <json>', '内联 JSON 字符串（与 --file 二选一）')
    .option('--name <name>', '覆盖 JSON 中的显示名称')
    .option('--mcp-server <name>', 'mcpServers 聚合配置中要选中的 server 名')
    .option('--scope <scope>', '保存目标: local（默认）| cloud', 'local')
    .addHelpText('after', `\n${serverJsonFieldsHelpText()}\n`)
    .action(async (options) => {
      try {
        const scope = String(options.scope || 'local').toLowerCase();
        if (!['local', 'cloud'].includes(scope)) {
          console.error('无效的 --scope，请使用 local 或 cloud');
          process.exitCode = 1;
          return;
        }
        const entry = loadEntryFromOptions(options);
        if (options.name) entry.name = options.name;
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/save', { ...entry, scope });
          if (res.code !== 200) {
            console.error(res.msg);
            process.exitCode = 1;
            return;
          }
          const saved = res.data as any;
          const where = scope === 'cloud' ? '云端' : '本地';
          console.log(`✔ 已添加${where} Server: ${saved?.name} (${saved?.id})`);
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── edit ── */

gw(
  mcpServerCommand
    .command('edit')
    .description('编辑 MCP Server（--file/--data 传入部分字段 JSON；按 ID 自动识别本地或云端）')
    .requiredOption('--id <id>', 'Server ID')
    .option('--file <path>', 'JSON 文件，可只含待修改字段（与 --data 二选一）')
    .option('--data <json>', '内联 JSON，可只含待修改字段（与 --file 二选一）')
    .option('--mcp-server <name>', 'mcpServers 聚合配置中要选中的 server 名')
    .addHelpText('after', `\n${serverJsonFieldsHelpText()}\n`)
    .action(async (options) => {
      try {
        const hasFile = typeof options.file === 'string' && options.file.trim();
        const hasData = typeof options.data === 'string' && options.data.trim();
        if (!hasFile && !hasData) {
          console.error(ERR_NEED_FILE_OR_DATA);
          process.exitCode = 1;
          return;
        }
        const patch = loadEntryFromOptions(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/save', {
            ...patch,
            id: options.id,
            scope: 'auto'
          });
          if (res.code !== 200) {
            console.error(res.msg);
            process.exitCode = 1;
            return;
          }
          const saved = res.data as ServerItem & { source?: string };
          const where =
            saved?.source === 'cloud' ? '云端' : saved?.source === 'local' ? '本地' : '';
          const prefix = where ? `✔ 已更新${where} Server` : '✔ 已更新 Server';
          console.log(`${prefix}: ${saved?.name} (${saved?.id})`);
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
    .description('删除 MCP Server（本地或云端，按 ID）')
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
