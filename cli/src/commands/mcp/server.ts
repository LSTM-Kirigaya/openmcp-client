import fs from 'node:fs';
import { Command } from 'commander';
import { DEFAULT_GATEWAY, printJson, withGateway } from '../../lib/cli-helpers.js';
import { resolvePayloadFromConfig } from '../../lib/mcp-config.js';

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

function parseAnyJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse JSON');
  }
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
    .action(async (options) => {
      try {
        const entry = loadEntryFromOptions(options);
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
    .action(async (options) => {
      try {
        const patch = loadEntryFromOptions(options);
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
