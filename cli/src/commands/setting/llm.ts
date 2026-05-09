import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, readJsonFile } from '../../lib/cli-helpers.js';
import type { MessageBridge } from '../../lib/message-bridge.js';

interface LlmProviderInfo {
  id: string;
  name: string;
  baseUrl: string;
  userToken: string;
  userModel: string;
  [key: string]: unknown;
}

interface SettingsConfig {
  MODEL_INDEX: number;
  LLM_INFO: LlmProviderInfo[];
  [key: string]: unknown;
}

async function loadSettings(bridge: MessageBridge): Promise<SettingsConfig> {
  const res = await bridge.commandRequest('setting/load', {});
  if (res.code !== 200) {
    throw new Error(`加载设置失败: ${JSON.stringify(res.msg)}`);
  }
  return res.msg as SettingsConfig;
}

async function resolveLlmProvider(
  bridge: MessageBridge,
  providerId: string
): Promise<LlmProviderInfo> {
  const settings = await loadSettings(bridge);
  const llmInfo = settings.LLM_INFO;
  if (!Array.isArray(llmInfo) || llmInfo.length === 0) {
    throw new Error(
      '当前 settings 中未配置任何 LLM 提供商。\n' +
      '请先在 Web UI 中添加提供商，或通过 "openmcp setting llm provider add" 命令添加。'
    );
  }

  const lower = providerId.toLowerCase();
  const found = llmInfo.find(
    (p) => p.id?.toLowerCase() === lower || p.name?.toLowerCase() === lower
  );
  if (!found) {
    const available = llmInfo.map((p) => `  · ${p.id}  (${p.name})`).join('\n');
    throw new Error(
      `在 settings 中未找到提供商 "${providerId}"。\n\n` +
      `settings 中已配置的提供商:\n${available}\n\n` +
      '提示: --provider 的值必须是 settings 中已有的提供商 id 或 name。\n' +
      '使用 "openmcp setting llm provider list" 查看详情。'
    );
  }
  return found;
}

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const llmCommand = new Command('llm')
  .description('大模型 API 管理：提供商、模型、测试、对话');

const LLM_CHAT_HELP = `
Input format:
  Use -m for one user message.
  Use --file for either a messages array or an object with a messages array.

Example messages file:
  [{"role":"user","content":"hello"}]

Examples:
  openmcp setting llm chat --provider deepseek --model deepseek-chat -m "hello"
  openmcp setting llm chat --provider deepseek --model deepseek-chat --file ./messages.json
`;

/* ── provider list ── */

const providerCmd = new Command('provider')
  .description('LLM 提供商管理')
  .addHelpText('after', `
示例:
  查看所有提供商:     openmcp setting llm provider list
  设置 DeepSeek Key:  openmcp setting llm provider update --id deepseek --api-key sk-xxx
  设置 OpenAI Key:    openmcp setting llm provider update --id openai --api-key sk-xxx
  添加新提供商:       openmcp setting llm provider add --id my-llm --name "My LLM"
  删除提供商:         openmcp setting llm provider delete --id my-llm
`);

gw(
  providerCmd
    .command('list')
    .description('列出已配置的 LLM 提供商')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('setting/load', {});
        if (res.code !== 200) {
          printJson(res);
          process.exitCode = 1;
          return;
        }
        const settings = res.msg as SettingsConfig;
        const llmInfo = settings.LLM_INFO ?? [];

        if (!Array.isArray(llmInfo) || llmInfo.length === 0) {
          console.log('当前 settings 中尚未配置任何 LLM 提供商。');
          console.log('使用 "openmcp setting llm provider add" 添加提供商。');
          return;
        }

        console.log('已配置的提供商:\n');
        const needKeyProviders: string[] = [];
        for (const p of llmInfo) {
          const keyStatus = p.userToken ? '✔ 已配置' : '✘ 未设置';
          const models: string[] = Array.isArray(p.models) ? p.models : [];
          const modelsList = models.length > 0 ? models.join(', ') : '(无预置模型)';
          console.log(`  ${p.id}  (${p.name})`);
          console.log(`    API Key:  ${keyStatus}`);
          console.log(`    Base URL: ${p.baseUrl || '(未设置)'}`);
          console.log(`    可选模型: ${modelsList}`);
          console.log('');
          if (!p.userToken) needKeyProviders.push(p.id);
        }

        console.log('─'.repeat(50));
        console.log('常用操作:');
        if (needKeyProviders.length > 0) {
          console.log(`  设置 API Key:    openmcp setting llm provider update --id ${needKeyProviders[0]} --api-key <你的Key>`);
        } else {
          console.log('  设置 API Key:    openmcp setting llm provider update --id <提供商ID> --api-key <你的Key>');
        }
        console.log('  修改 Base URL:   openmcp setting llm provider update --id <提供商ID> --base-url <新地址>');
        console.log('  添加提供商:      openmcp setting llm provider add --id <ID> --name <名称>');
        console.log('  删除提供商:      openmcp setting llm provider delete --id <提供商ID>');
        console.log('  测试连通性:      openmcp setting llm test --provider <提供商ID>');
        console.log('');
      });
    })
);

/* ── provider add ── */

gw(
  providerCmd
    .command('add')
    .description('添加新的 LLM 提供商')
    .requiredOption('--id <id>', '提供商 ID，如 deepseek, openai')
    .requiredOption('--name <name>', '提供商显示名称')
    .option('--base-url <url>', 'API 基础地址')
    .option('--api-key <key>', 'API Key')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const settings = await loadSettings(bridge);
        const llmInfo: LlmProviderInfo[] = Array.isArray(settings.LLM_INFO) ? settings.LLM_INFO : [];

        const existing = llmInfo.find(p => p.id?.toLowerCase() === options.id.toLowerCase());
        if (existing) {
          console.error(`提供商 "${options.id}" 已存在，请使用 "provider update" 修改。`);
          process.exitCode = 1;
          return;
        }

        const newProvider: LlmProviderInfo = {
          id: options.id,
          name: options.name,
          baseUrl: options.baseUrl || '',
          userToken: options.apiKey || '',
          userModel: '',
        };
        llmInfo.push(newProvider);
        settings.LLM_INFO = llmInfo;

        const saveRes = await bridge.commandRequest('setting/save', settings);
        if (saveRes.code !== 200) {
          printJson(saveRes);
          process.exitCode = 1;
          return;
        }
        console.log(`已添加提供商: ${options.id} (${options.name})`);
      });
    })
);

/* ── provider update ── */

gw(
  providerCmd
    .command('update')
    .description('更新已有的 LLM 提供商（需指定至少一个修改项）')
    .requiredOption('--id <id>', '提供商 ID（使用 provider list 查看）')
    .option('--name <name>', '新的显示名称')
    .option('--base-url <url>', '新的 API 基础地址')
    .option('--api-key <key>', '新的 API Key')
    .addHelpText('after', `
示例:
  设置 API Key:                 openmcp setting llm provider update --id deepseek --api-key sk-xxx
  修改 Base URL:                openmcp setting llm provider update --id openai --base-url https://api.openai.com/v1
  同时修改 Key 和 Base URL:    openmcp setting llm provider update --id qwen --api-key sk-xxx --base-url https://new-url.com/v1
  修改显示名称:                 openmcp setting llm provider update --id deepseek --name "DeepSeek V3"
`)
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const hasName = options.name !== undefined;
        const hasBaseUrl = options.baseUrl !== undefined;
        const hasApiKey = options.apiKey !== undefined;

        if (!hasName && !hasBaseUrl && !hasApiKey) {
          console.warn(`⚠ 未指定任何要修改的内容。请至少提供以下选项之一:\n`);
          console.log(`  --api-key <key>    设置 API Key`);
          console.log(`  --base-url <url>   设置 API 基础地址`);
          console.log(`  --name <name>      设置显示名称`);
          console.log('');
          console.log(`示例:`);
          console.log(`  openmcp setting llm provider update --id ${options.id} --api-key sk-xxx`);
          console.log(`  openmcp setting llm provider update --id ${options.id} --base-url https://api.example.com/v1`);
          console.log(`  openmcp setting llm provider update --id ${options.id} --api-key sk-xxx --base-url https://api.example.com/v1`);
          process.exitCode = 1;
          return;
        }

        const settings = await loadSettings(bridge);
        const llmInfo: LlmProviderInfo[] = Array.isArray(settings.LLM_INFO) ? settings.LLM_INFO : [];

        const provider = llmInfo.find(p => p.id?.toLowerCase() === options.id.toLowerCase());
        if (!provider) {
          const available = llmInfo.map(p => `  · ${p.id}  (${p.name})`).join('\n');
          console.error(`未找到提供商 "${options.id}"。`);
          if (available) console.error(`\n已配置的提供商:\n${available}`);
          console.error(`\n使用 "openmcp setting llm provider list" 查看所有提供商。`);
          process.exitCode = 1;
          return;
        }

        const changes: string[] = [];
        if (hasName) {
          const old = provider.name;
          provider.name = options.name;
          changes.push(`  显示名称: ${old} → ${provider.name}`);
        }
        if (hasBaseUrl) {
          const old = provider.baseUrl || '(未设置)';
          provider.baseUrl = options.baseUrl;
          changes.push(`  Base URL:  ${old} → ${provider.baseUrl}`);
        }
        if (hasApiKey) {
          const masked = options.apiKey.length > 8
            ? options.apiKey.slice(0, 4) + '****' + options.apiKey.slice(-4)
            : '****';
          changes.push(`  API Key:   已更新 (${masked})`);
          provider.userToken = options.apiKey;
        }

        const saveRes = await bridge.commandRequest('setting/save', settings);
        if (saveRes.code !== 200) {
          printJson(saveRes);
          process.exitCode = 1;
          return;
        }
        console.log(`✔ 已更新提供商: ${provider.id} (${provider.name})\n`);
        console.log('变更内容:');
        for (const c of changes) console.log(c);
      });
    })
);

/* ── provider delete ── */

gw(
  providerCmd
    .command('delete')
    .description('删除 LLM 提供商')
    .requiredOption('--id <id>', '提供商 ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const settings = await loadSettings(bridge);
        const llmInfo: LlmProviderInfo[] = Array.isArray(settings.LLM_INFO) ? settings.LLM_INFO : [];

        const idx = llmInfo.findIndex(p => p.id?.toLowerCase() === options.id.toLowerCase());
        if (idx < 0) {
          console.error(`未找到提供商 "${options.id}"。`);
          process.exitCode = 1;
          return;
        }

        const removed = llmInfo.splice(idx, 1)[0];
        settings.LLM_INFO = llmInfo;

        const saveRes = await bridge.commandRequest('setting/save', settings);
        if (saveRes.code !== 200) {
          printJson(saveRes);
          process.exitCode = 1;
          return;
        }
        console.log(`已删除提供商: ${removed.id} (${removed.name})`);
      });
    })
);

llmCommand.addCommand(providerCmd);

/* ── model list ── */

const modelCmd = new Command('model')
  .description('模型管理');

gw(
  modelCmd
    .command('list')
    .description('列出指定提供商的可用模型（从远端 API 拉取）')
    .requiredOption('--provider <id>', '提供商 id，如 deepseek, openai')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        let provider: LlmProviderInfo;
        try {
          provider = await resolveLlmProvider(bridge, options.provider);
        } catch (e: any) {
          console.error(e.message);
          process.exitCode = 1;
          return;
        }

        if (!provider.userToken) {
          console.error(`提供商 "${provider.id}" (${provider.name}) 的 API Key 未设置。`);
          console.error(`请先配置: openmcp setting llm provider update --id ${provider.id} --api-key <你的API Key>`);
          process.exitCode = 1;
          return;
        }

        const res = await bridge.commandRequest('llm/models', {
          baseURL: provider.baseUrl,
          apiKey: provider.userToken
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

/* ── model refresh ── */

gw(
  modelCmd
    .command('refresh')
    .description('刷新指定提供商的模型列表并保存到设置')
    .requiredOption('--provider <id>', '提供商 id')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        let provider: LlmProviderInfo;
        try {
          provider = await resolveLlmProvider(bridge, options.provider);
        } catch (e: any) {
          console.error(e.message);
          process.exitCode = 1;
          return;
        }

        if (!provider.userToken) {
          console.error(`提供商 "${provider.id}" 的 API Key 未设置。`);
          process.exitCode = 1;
          return;
        }

        const modelsRes = await bridge.commandRequest('llm/models', {
          baseURL: provider.baseUrl,
          apiKey: provider.userToken
        });
        if (modelsRes.code !== 200) {
          printJson(modelsRes);
          process.exitCode = 1;
          return;
        }

        const modelData = modelsRes.msg as any;
        const modelRows = Array.isArray(modelData) ? modelData : modelData?.data;
        const modelIds: string[] = Array.isArray(modelRows)
          ? modelRows.map((m: any) => m.id).filter(Boolean)
          : [];

        if (modelIds.length === 0) {
          console.log('API 未返回任何模型。');
          return;
        }

        const settings = await loadSettings(bridge);
        const llmInfo = settings.LLM_INFO;
        const target = llmInfo.find(p => p.id === provider.id);
        if (target) {
          (target as any).models = modelIds;
        }

        const saveRes = await bridge.commandRequest('setting/save', settings);
        if (saveRes.code !== 200) {
          printJson(saveRes);
          process.exitCode = 1;
          return;
        }
        console.log(`已刷新 ${provider.id} 的模型列表（${modelIds.length} 个模型）`);
      });
    })
);

llmCommand.addCommand(modelCmd);

/* ── test ── */

gw(
  llmCommand
    .command('test')
    .description('测试指定提供商的 API 连通性')
    .requiredOption('--provider <id>', '提供商 id')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        let provider: LlmProviderInfo;
        try {
          provider = await resolveLlmProvider(bridge, options.provider);
        } catch (e: any) {
          console.error(e.message);
          process.exitCode = 1;
          return;
        }

        if (!provider.userToken) {
          console.error(`提供商 "${provider.id}" 的 API Key 未设置。`);
          process.exitCode = 1;
          return;
        }

        console.log(`测试 ${provider.id} (${provider.name}) ...`);
        const res = await bridge.commandRequest('llm/models', {
          baseURL: provider.baseUrl,
          apiKey: provider.userToken
        });

        if (res.code === 200) {
          console.log(`连接成功！`);
        } else {
          console.error(`连接失败。`);
          printJson(res);
          process.exitCode = 1;
        }
      });
    })
);

/* ── chat ── */

gw(
  llmCommand
    .command('chat')
    .description('同步聊天补全')
    .requiredOption('--provider <id>', '提供商 id，如 deepseek, openai, qwen')
    .requiredOption('--model <name>', '模型名称，如 deepseek-chat, gpt-4, qwen-plus')
    .option('-m, --message <text>', '快捷发送单条用户消息')
    .option('-f, --file <path>', '从 JSON 文件读取 messages 数组')
    .option('--temperature <number>', '温度参数', parseFloat)
    .addHelpText('after', LLM_CHAT_HELP)
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        let provider: LlmProviderInfo;
        try {
          provider = await resolveLlmProvider(bridge, options.provider);
        } catch (e: any) {
          console.error(e.message);
          process.exitCode = 1;
          return;
        }

        if (!provider.userToken) {
          console.error(`提供商 "${provider.id}" (${provider.name}) 的 API Key 未设置。`);
          console.error('');
          console.error('请先配置:');
          console.error(`  openmcp setting llm provider update --id ${provider.id} --api-key <你的API Key>`);
          process.exitCode = 1;
          return;
        }

        const model = options.model;
        const models: string[] = Array.isArray((provider as any).models) ? (provider as any).models : [];

        if (models.length > 0 && !models.includes(model)) {
          console.error(`模型 "${model}" 不在 ${provider.id} (${provider.name}) 的可选模型列表中。`);
          console.error('');
          console.error(`可选模型: ${models.join(', ')}`);
          process.exitCode = 1;
          return;
        }

        let messages: unknown[] | undefined;

        if (options.message) {
          messages = [{ role: 'user', content: options.message }];
        } else if (options.file) {
          try {
            const fileContent = readJsonFile(options.file);
            messages = Array.isArray(fileContent)
              ? fileContent
              : (fileContent.messages as unknown[]);
          } catch (e: any) {
            console.error(`读取文件失败: ${e.message}`);
            process.exitCode = 1;
            return;
          }
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          console.error('缺少消息内容，请通过 -m 或 -f 提供。');
          process.exitCode = 1;
          return;
        }

        console.log(`${provider.name} | ${model}`);

        const body = {
          baseURL: provider.baseUrl,
          apiKey: provider.userToken,
          model,
          messages,
          temperature: options.temperature,
        };

        const res = await bridge.commandRequest('llm/chat/completions/sync', body, 600000);
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
