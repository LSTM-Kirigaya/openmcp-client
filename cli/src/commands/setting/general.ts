import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../../lib/cli-helpers.js';

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
    return { res: { code: 500, msg: '返回的 settings 不是 JSON 对象' } };
  }
  return { res, settings: res.msg as Record<string, unknown> };
}

const PROVIDER_FIELD_MAP: Record<string, { internal: string; label: string }> = {
  'api-key':  { internal: 'userToken', label: 'API Key' },
  'base-url': { internal: 'baseUrl',   label: 'API 地址' },
};

const TOP_LEVEL_KEYS: Record<string, string> = {
  LANG:            '界面语言',
  MCP_TIMEOUT_SEC: 'MCP 超时时间（秒）',
  PROXY_SERVER:    '代理服务器地址',
  MODEL_INDEX:     '默认提供商索引',
  SKILL_PATH:      'Skill 文件路径',
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
  .description('通用设置：语言、超时、代理等');

/* ── list ── */

gw(
  generalCommand
    .command('list')
    .description('查看所有配置项及可用的 key')
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
        console.log('  通用设置');
        console.log('══════════════════════════════════════');

        for (const [key, desc] of Object.entries(TOP_LEVEL_KEYS)) {
          const val = settings[key];
          const display = val === undefined || val === '' ? '(未设置)' : String(val);
          console.log(`  ${key.padEnd(20)} ${display}`);
          console.log(`  ${''.padEnd(20)} ${desc}`);
          console.log('');
        }

        const llmInfo = settings.LLM_INFO as any[];
        if (Array.isArray(llmInfo) && llmInfo.length > 0) {
          console.log('══════════════════════════════════════');
          console.log('  LLM 提供商');
          console.log('══════════════════════════════════════');
          console.log('');

          for (const p of llmInfo) {
            const id = p.id || '(unknown)';
            const name = p.name || '';
            const token = p.userToken || '';
            const keyStatus = token ? `${maskKey(token)}` : '(未设置)';
            const models: string[] = Array.isArray(p.models) ? p.models : [];
            const modelsList = models.length > 0 ? models.join(', ') : '(无预置模型)';

            console.log(`  ${id} (${name})`);
            console.log(`    ${id}.api-key       ${keyStatus}`);
            console.log(`    ${id}.base-url      ${p.baseUrl || '(未设置)'}`);
            console.log(`    可选模型:           ${modelsList}`);
            console.log('');
          }
        }

        const providerFields = Object.keys(PROVIDER_FIELD_MAP).join(', ');

        console.log('──────────────────────────────────────');
        console.log('使用 "openmcp setting general set <key> <value>" 修改配置');
        console.log('');
        console.log('示例:');
        console.log('  openmcp setting general set deepseek.api-key sk-xxx');
        console.log('  openmcp setting general set MCP_TIMEOUT_SEC 120');
        console.log('');
        console.log(`提供商支持的字段: ${providerFields}`);
        console.log('');
      });
    })
);

/* ── set ── */

gw(
  generalCommand
    .command('set <key> <value>')
    .description('设置配置项（支持 provider.field 点号路径）')
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
            console.error(`不支持的提供商字段 "${field}"。`);
            console.error('');
            console.error(`可用字段: ${validFields}`);
            process.exitCode = 1;
            return;
          }

          const llmInfo = settings.LLM_INFO as any[];
          if (!Array.isArray(llmInfo) || llmInfo.length === 0) {
            console.error('settings 中未配置任何 LLM 提供商。');
            process.exitCode = 1;
            return;
          }

          const lower = providerId.toLowerCase();
          const provider = llmInfo.find(
            (p: any) => p.id?.toLowerCase() === lower || p.name?.toLowerCase() === lower
          );
          if (!provider) {
            const available = llmInfo.map((p: any) => `  · ${p.id}  (${p.name})`).join('\n');
            console.error(`settings 中未找到提供商 "${providerId}"。`);
            console.error('');
            console.error(`已配置的提供商:\n${available}`);
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
          const displayPrev = field === 'api-key' && prev ? maskKey(prev) : (prev || '(未设置)');
          console.log(`${provider.id} (${provider.name}) ${fieldDef.label} 已更新`);
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
          console.log(`${label} 已更新`);
          console.log(`   ${prev === undefined || prev === '' ? '(未设置)' : prev} → ${parsedValue}`);
        }
      });
    })
);

/* ── save ── */

gw(
  generalCommand
    .command('save')
    .description('从文件导入完整设置（整包覆盖）')
    .option('-f, --file <path>', 'JSON 文件')
    .option('-d, --data <json>', '内联 JSON')
    .action(async (options) => {
      let body: Record<string, unknown> = {};
      if (options.data) body = { ...body, ...parseJsonData(options.data) };
      if (options.file) body = { ...body, ...readJsonFile(options.file) };
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('setting/save', body);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
