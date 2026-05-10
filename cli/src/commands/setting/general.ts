import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonObjectFile } from '../../lib/cli-helpers.js';

type GatewayResponse = {
  code: number;
  msg?: unknown;
};

type SettingBridge = {
  commandRequest(command: string, data: Record<string, unknown>): Promise<GatewayResponse>;
};

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

async function loadCurrentSettings(bridge: SettingBridge) {
  const res = await bridge.commandRequest('setting/load', {});
  if (res.code !== 200) {
    return { res };
  }
  if (typeof res.msg !== 'object' || res.msg === null || Array.isArray(res.msg)) {
    return { res: { code: 500, msg: 'Returned settings is not a JSON object' } };
  }
  return { res, settings: res.msg as Record<string, unknown> };
}

const PROVIDER_FIELD_MAP: Record<string, { internal: string; label: string }> = {
  'api-key':  { internal: 'userToken', label: 'API Key' },
  'base-url': { internal: 'baseUrl',   label: 'API URL' },
};

const TOP_LEVEL_KEYS: Record<string, string> = {
  LANG:            'UI Language',
  MCP_TIMEOUT_SEC: 'MCP Timeout (seconds)',
  PROXY_SERVER:    'Proxy server address',
  MODEL_INDEX:     'Default provider index',
  SKILL_PATH:      'Skill file path',
};

function maskKey(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return token.slice(0, 2) + '***';
  return token.slice(0, 6) + '***' + token.slice(-3);
}

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export const generalCommand = new Command('general')
  .description('General settings: language, timeout, proxy, etc.');

const GENERAL_SAVE_HELP = `
Input format:
  --data and --file must contain a full settings JSON object.
  This command saves the whole settings object. For one value, prefer:
    openmcp setting general set <key> <value>

Examples:
  openmcp setting general save --data '{"LANG":"zh-CN","MCP_TIMEOUT_SEC":120}'
  openmcp setting general save --file ./settings.json
`;

/* ── list ── */

gw(
  generalCommand
    .command('list')
    .description('List all config items and available keys')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const { res, settings } = await loadCurrentSettings(bridge);
        if (!settings) {
          printJson(res);
          process.exitCode = 1;
          return;
        }

        console.log('');
        console.log('══════════════════════════════════════');
        console.log('  General Settings');
        console.log('══════════════════════════════════════');

        for (const [key, desc] of Object.entries(TOP_LEVEL_KEYS)) {
          const val = settings[key];
          const display = val === undefined || val === '' ? '(not set)' : String(val);
          console.log(`  ${key.padEnd(20)} ${display}`);
          console.log(`  ${''.padEnd(20)} ${desc}`);
          console.log('');
        }

        const llmInfo = settings.LLM_INFO as any[];
        if (Array.isArray(llmInfo) && llmInfo.length > 0) {
          console.log('══════════════════════════════════════');
          console.log('  LLM Providers');
          console.log('══════════════════════════════════════');
          console.log('');

          for (const p of llmInfo) {
            const id = p.id || '(unknown)';
            const name = p.name || '';
            const token = p.userToken || '';
            const keyStatus = token ? `${maskKey(token)}` : '(not set)';
            const models: string[] = Array.isArray(p.models) ? p.models : [];
            const modelsList = models.length > 0 ? models.join(', ') : '(no preset models)';

            console.log(`  ${id} (${name})`);
            console.log(`    ${id}.api-key       ${keyStatus}`);
            console.log(`    ${id}.base-url      ${p.baseUrl || '(not set)'}`);
            console.log(`    Available models:           ${modelsList}`);
            console.log('');
          }
        }

        const providerFields = Object.keys(PROVIDER_FIELD_MAP).join(', ');

        console.log('──────────────────────────────────────');
        console.log('Use "openmcp setting general set <key> <value>" to modify config');
        console.log('');
        console.log('Examples:');
        console.log('  openmcp setting general set deepseek.api-key sk-xxx');
        console.log('  openmcp setting general set MCP_TIMEOUT_SEC 120');
        console.log('');
        console.log(`Supported provider fields: ${providerFields}`);
        console.log('');
      });
    })
);

/* ── set ── */

gw(
  generalCommand
    .command('set <key> <value>')
    .description('Set config item (supports provider.field dot notation)')
    .action(async (key: string, value: string, options: any) => {
      await withGateway(options.gateway, async (bridge) => {
        const { res: loadRes, settings } = await loadCurrentSettings(bridge);
        if (!settings) {
          printJson(loadRes);
          process.exitCode = 1;
          return;
        }

        const dotIdx = key.indexOf('.');
        if (dotIdx > 0) {
          const providerId = key.slice(0, dotIdx);
          const field = key.slice(dotIdx + 1);

          const fieldDef = PROVIDER_FIELD_MAP[field];
          if (!fieldDef) {
            const validFields = Object.keys(PROVIDER_FIELD_MAP).map(f => `${providerId}.${f}`).join(', ');
            console.error(`Unsupported provider field "${field}".`);
            console.error('');
            console.error(`Available fields: ${validFields}`);
            process.exitCode = 1;
            return;
          }

          const llmInfo = settings.LLM_INFO as any[];
          if (!Array.isArray(llmInfo) || llmInfo.length === 0) {
            console.error('No LLM providers configured in settings.');
            process.exitCode = 1;
            return;
          }

          const lower = providerId.toLowerCase();
          const provider = llmInfo.find(
            (p: any) => p.id?.toLowerCase() === lower || p.name?.toLowerCase() === lower
          );
          if (!provider) {
            const available = llmInfo.map((p: any) => `  · ${p.id}  (${p.name})`).join('\n');
            console.error(`Provider "${providerId}" not found in settings.`);
            console.error('');
            console.error(`Configured providers:\n${available}`);
            process.exitCode = 1;
            return;
          }

          const prev = provider[fieldDef.internal];
          provider[fieldDef.internal] = value;

          const saveRes = await bridge.commandRequest('setting/save', settings);
          if (saveRes.code !== 200) {
            printJson(saveRes);
            process.exitCode = 1;
            return;
          }

          const displayValue = field === 'api-key' ? maskKey(value) : value;
          const displayPrev = field === 'api-key' && prev ? maskKey(prev) : (prev || '(not set)');
          console.log(`${provider.id} (${provider.name}) ${fieldDef.label} updated`);
          console.log(`   ${displayPrev} → ${displayValue}`);
        } else {
          const parsedValue = parseValue(value);
          const prev = settings[key];
          settings[key] = parsedValue;

          const saveRes = await bridge.commandRequest('setting/save', settings);
          if (saveRes.code !== 200) {
            printJson(saveRes);
            process.exitCode = 1;
            return;
          }

          const desc = TOP_LEVEL_KEYS[key];
          const label = desc ? `${key} (${desc})` : key;
          console.log(`${label} updated`);
          console.log(`   ${prev === undefined || prev === '' ? '(not set)' : prev} → ${parsedValue}`);
        }
      });
    })
);

/* ── save ── */

gw(
  generalCommand
    .command('save')
    .description('Import full settings from file (overwrites everything)')
    .option('-f, --file <path>', 'JSON file')
    .option('-d, --data <json>', 'Inline JSON')
    .addHelpText('after', GENERAL_SAVE_HELP)
    .action(async (options) => {
      let body: Record<string, unknown> = {};
      if (!options.data && !options.file) {
        throw new Error('Please provide settings JSON with --file or --data.\nSee: openmcp setting general save --help');
      }
      if (options.data) body = { ...body, ...parseJsonData(options.data) };
      if (options.file) body = { ...body, ...readJsonObjectFile(options.file) };
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('setting/save', body);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
