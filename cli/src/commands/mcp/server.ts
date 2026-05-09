import { Command } from 'commander';
import { DEFAULT_GATEWAY, parseJsonData, printJson, readJsonObjectFile, withGateway } from '../../lib/cli-helpers.js';
import { normalizeConnectionType, resolvePayloadFromConfig } from '../../lib/mcp-config.js';

interface ServerItem {
  id: string;
  name: string;
  source: 'local';
  connectionType?: string;
  command?: string;
  args?: string[];
  url?: string;
  cwd?: string;
  serverInfo?: { name?: string; version?: string };
  [key: string]: unknown;
}

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

const ERR_NEED_FILE_OR_DATA =
  'Please provide JSON with --file or --data.\n' +
  'See: openmcp mcp server add --help';

const SERVER_INPUT_HELP = `
Input format:
  --data and --file must contain a JSON object. A file uses the same JSON shape as --data.

Direct OpenMCP server object:
  STDIO:
    {"name":"everything","connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}
  SSE:
    {"name":"remote-sse","connectionType":"SSE","url":"http://127.0.0.1:3000/sse"}
  Streamable HTTP:
    {"name":"remote-http","connectionType":"STREAMABLE_HTTP","url":"http://127.0.0.1:8080/mcp"}

mcpServers file format is also accepted:
  {"mcpServers":{"everything":{"command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}}}

Notes:
  - Direct config uses connectionType. The aliases type/transport are accepted and normalized.
  - STDIO uses command + args. Do not put a shell command in url.
  - Use --mcp-server <name> when an mcpServers file contains multiple entries.
  - In PowerShell, prefer --file for complex JSON, or escape inline quotes with backslashes.
`;

const SERVER_ADD_HELP = `
Examples:
  openmcp mcp server add --data '{"name":"everything","connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}'
  openmcp mcp server add --file ./my-server.json
  openmcp mcp server add --file ./mcp-servers.json --mcp-server everything

${SERVER_INPUT_HELP}`;

const SERVER_EDIT_HELP = `
Examples:
  openmcp mcp server edit --id <ID> --data '{"name":"everything-renamed"}'
  openmcp mcp server edit --id <ID> --data '{"connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}'
  openmcp mcp server edit --id <ID> --data '{"connectionType":"SSE","url":"http://127.0.0.1:3000/sse"}'
  openmcp mcp server edit --id <ID> --file ./patch.json

Patch format:
  The JSON object is merged into the existing server. Include only fields you want to change.
  For STDIO, use command and args. Example patch file:
    {"connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}

${SERVER_INPUT_HELP}`;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function getExplicitConnectionType(payload: Record<string, unknown>): string | undefined {
  if (hasText(payload.connectionType)) return payload.connectionType;
  if (hasText(payload.type)) return payload.type;
  if (hasText(payload.transport)) return payload.transport;
  return undefined;
}

function normalizeServerInput(input: Record<string, unknown>, mode: 'add' | 'edit'): Record<string, unknown> {
  const payload = { ...input };
  const explicitType = getExplicitConnectionType(payload);
  if (explicitType) {
    const normalized = normalizeConnectionType(explicitType);
    if (!normalized) {
      throw new Error([
        `Invalid connectionType: ${explicitType}`,
        'Expected one of: STDIO, SSE, STREAMABLE_HTTP.',
        'Example: --data \'{"connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}\''
      ].join('\n'));
    }
    payload.connectionType = normalized;
  } else if (mode === 'add') {
    if (hasText(payload.command)) payload.connectionType = 'STDIO';
    else if (hasText(payload.url)) payload.connectionType = 'SSE';
  }

  delete payload.type;
  delete payload.transport;
  validateServerInput(payload, mode);
  return payload;
}

function validateServerInput(payload: Record<string, unknown>, mode: 'add' | 'edit'): void {
  if (payload.connectionType !== undefined && typeof payload.connectionType !== 'string') {
    throw new Error('Invalid connectionType: value must be a string such as STDIO, SSE, or STREAMABLE_HTTP.');
  }
  const type = normalizeConnectionType(payload.connectionType);
  const hasCommand = hasText(payload.command);
  const hasUrl = hasText(payload.url);

  if (payload.args !== undefined && !Array.isArray(payload.args)) {
    throw new Error([
      'Invalid server args: args must be a JSON array of strings.',
      'Example: --data \'{"connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}\''
    ].join('\n'));
  }

  if (payload.env !== undefined && !isPlainObject(payload.env)) {
    throw new Error('Invalid server env: env must be a JSON object, for example {"OPENMCP_API_KEY":"..."}');
  }

  if (type === 'STDIO') {
    if (hasUrl && !hasCommand) {
      throw new Error([
        'Invalid STDIO server config: STDIO uses command and args, not url.',
        'Use: --data \'{"connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}\'',
        'Use url only for SSE or STREAMABLE_HTTP servers.'
      ].join('\n'));
    }
    if (mode === 'add' && !hasCommand) {
      throw new Error([
        'Invalid STDIO server config: command is required.',
        'Example: --data \'{"connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}\''
      ].join('\n'));
    }
  }

  if ((type === 'SSE' || type === 'STREAMABLE_HTTP') && mode === 'add' && !hasUrl) {
    throw new Error([
      `Invalid ${type} server config: url is required.`,
      'Example: --data \'{"connectionType":"SSE","url":"http://127.0.0.1:3000/sse"}\''
    ].join('\n'));
  }

  if (mode === 'add' && !type) {
    throw new Error([
      'Invalid server config: connectionType could not be determined.',
      'Use connectionType with one of STDIO, SSE, STREAMABLE_HTTP.',
      'Example: --data \'{"connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}\''
    ].join('\n'));
  }
}

function loadEntryFromOptions(options: {
  file?: string;
  data?: string;
  mcpServer?: string;
}, mode: 'add' | 'edit'): Record<string, unknown> {
  const source = typeof options.file === 'string' && options.file.trim()
    ? readJsonObjectFile(options.file)
    : typeof options.data === 'string' && options.data.trim()
      ? parseJsonData(options.data, '--data')
      : undefined;
  if (source === undefined) {
    throw new Error(ERR_NEED_FILE_OR_DATA);
  }
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const maybeRecord = source as Record<string, unknown>;
    if (maybeRecord.mcpServers) {
      return normalizeServerInput(resolvePayloadFromConfig(maybeRecord, options.mcpServer) as Record<string, unknown>, mode);
    }
    return normalizeServerInput(maybeRecord, mode);
  }
  throw new Error('Connection definition must be a JSON object');
}

function describeServer(item: ServerItem): string {
  const name = item.name || 'unnamed';
  const type = item.connectionType || 'unknown';
  let endpoint = '';
  if (type === 'STDIO') {
    const cmd = item.command || '';
    const args = Array.isArray(item.args) ? item.args.join(' ') : '';
    endpoint = `${cmd} ${args}`.trim();
  } else {
    endpoint = item.url || '(not configured)';
  }
  const version = item.serverInfo?.version ? ` v${item.serverInfo.version}` : '';

  const lines = [
    `  [local] ${name}${version}`,
    `    ID:       ${item.id}`,
    `    Type:     ${type}`,
    `    ${type === 'STDIO' ? 'Command' : 'URL'}: ${endpoint}`,
  ];
  if (item.cwd) lines.push(`    CWD:      ${item.cwd}`);
  return lines.join('\n');
}

export const mcpServerCommand = new Command('server')
  .description('Manage local MCP Server configuration')
  .addHelpText('after', `
Examples:
  openmcp mcp server list
  openmcp mcp server get --id <ID>
  openmcp mcp server add --file ./my-server.json
  openmcp mcp server edit --id <ID> --file ./patch.json
  openmcp mcp server delete --id <ID>
`);

gw(
  mcpServerCommand
    .command('list')
    .description('List local MCP Servers')
    .option('--json', 'Output raw JSON', false)
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/list', {});
          if (res.code !== 200) {
            console.error(`Query failed: ${res.msg}`);
            process.exitCode = 1;
            return;
          }
          const servers: ServerItem[] = (res.data as any)?.servers || [];
          if (options.json) {
            printJson(servers);
            return;
          }
          if (servers.length === 0) {
            console.log('No MCP Server configured.');
            console.log('Add one with: openmcp mcp server add --file ./my-server.json');
            return;
          }
          for (const server of servers) {
            console.log(describeServer(server));
            console.log('');
          }
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

gw(
  mcpServerCommand
    .command('get')
    .description('Show one local MCP Server')
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
          console.log('\nFull config:');
          printJson(server);
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

gw(
  mcpServerCommand
    .command('add')
    .description('Add a local MCP Server configuration')
    .option('--file <path>', 'JSON config file')
    .option('--data <json>', 'Inline JSON config')
    .option('--name <name>', 'Override display name')
    .option('--mcp-server <name>', 'Server name inside an mcpServers config')
    .addHelpText('after', SERVER_ADD_HELP)
    .action(async (options) => {
      try {
        const entry = loadEntryFromOptions(options, 'add');
        if (options.name) entry.name = options.name;
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/save', { ...entry, scope: 'local' });
          if (res.code !== 200) {
            console.error(res.msg);
            process.exitCode = 1;
            return;
          }
          const saved = res.data as any;
          console.log(`Added local Server: ${saved?.name} (${saved?.id})`);
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

gw(
  mcpServerCommand
    .command('edit')
    .description('Edit a local MCP Server')
    .requiredOption('--id <id>', 'Server ID')
    .option('--file <path>', 'JSON patch file')
    .option('--data <json>', 'Inline JSON patch')
    .option('--mcp-server <name>', 'Server name inside an mcpServers config')
    .addHelpText('after', SERVER_EDIT_HELP)
    .action(async (options) => {
      try {
        const patch = loadEntryFromOptions(options, 'edit');
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('servers/save', {
            ...patch,
            id: options.id,
            scope: 'local'
          });
          if (res.code !== 200) {
            console.error(res.msg);
            process.exitCode = 1;
            return;
          }
          const saved = res.data as ServerItem;
          console.log(`Updated local Server: ${saved?.name} (${saved?.id})`);
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

gw(
  mcpServerCommand
    .command('delete')
    .description('Delete a local MCP Server')
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
          console.log(`Deleted Server: ${options.id}`);
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);
