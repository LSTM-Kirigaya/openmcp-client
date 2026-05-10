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
    throw new Error(`Failed to load settings: ${JSON.stringify(res.msg)}`);
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
      'No LLM providers configured in current settings.\n' +
      'Please add a provider in the Web UI first, or use the "openmcp setting llm provider add" command.'
    );
  }

  const lower = providerId.toLowerCase();
  const found = llmInfo.find(
    (p) => p.id?.toLowerCase() === lower || p.name?.toLowerCase() === lower
  );
  if (!found) {
    const available = llmInfo.map((p) => `  · ${p.id}  (${p.name})`).join('\n');
    throw new Error(
      `Provider "${providerId}" not found in settings.\n\n` +
      `Configured providers in settings:\n${available}\n\n` +
      'Hint: --provider value must be an existing provider id or name in settings.\n' +
      'Use "openmcp setting llm provider list" for details.'
    );
  }
  return found;
}

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const llmCommand = new Command('llm')
  .description('LLM API management: providers, models, testing, chat');

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
  .description('LLM provider management')
  .addHelpText('after', `
Examples:
  List all providers:     openmcp setting llm provider list
  Set DeepSeek Key:  openmcp setting llm provider update --id deepseek --api-key sk-xxx
  Set OpenAI Key:    openmcp setting llm provider update --id openai --api-key sk-xxx
  Add new provider:       openmcp setting llm provider add --id my-llm --name "My LLM"
  Delete provider:         openmcp setting llm provider delete --id my-llm
`);

gw(
  providerCmd
    .command('list')
    .description('List configured LLM providers')
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
          console.log('No LLM providers configured in current settings yet.');
          console.log('Use "openmcp setting llm provider add" to add a provider.');
          return;
        }

        console.log('Configured providers:\n');
        const needKeyProviders: string[] = [];
        for (const p of llmInfo) {
          const keyStatus = p.userToken ? '✔ Configured' : '✘ Not set';
          const models: string[] = Array.isArray(p.models) ? p.models : [];
          const modelsList = models.length > 0 ? models.join(', ') : '(no preset models)';
          console.log(`  ${p.id}  (${p.name})`);
          console.log(`    API Key:  ${keyStatus}`);
          console.log(`    Base URL: ${p.baseUrl || '(not set)'}`);
          console.log(`    Available models: ${modelsList}`);
          console.log('');
          if (!p.userToken) needKeyProviders.push(p.id);
        }

        console.log('─'.repeat(50));
        console.log('Common operations:');
        if (needKeyProviders.length > 0) {
          console.log(`  Set API Key:    openmcp setting llm provider update --id ${needKeyProviders[0]} --api-key <your-key>`);
        } else {
          console.log('  Set API Key:    openmcp setting llm provider update --id <provider-id> --api-key <your-key>');
        }
        console.log('  Change Base URL:   openmcp setting llm provider update --id <provider-id> --base-url <new-url>');
        console.log('  Add provider:      openmcp setting llm provider add --id <ID> --name <name>');
        console.log('  Delete provider:      openmcp setting llm provider delete --id <provider-id>');
        console.log('  Test connectivity:      openmcp setting llm test --provider <provider-id>');
        console.log('');
      });
    })
);

/* ── provider add ── */

gw(
  providerCmd
    .command('add')
    .description('Add a new LLM provider')
    .requiredOption('--id <id>', 'Provider ID, e.g. deepseek, openai')
    .requiredOption('--name <name>', 'Provider display name')
    .option('--base-url <url>', 'API base URL')
    .option('--api-key <key>', 'API Key')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const settings = await loadSettings(bridge);
        const llmInfo: LlmProviderInfo[] = Array.isArray(settings.LLM_INFO) ? settings.LLM_INFO : [];

        const existing = llmInfo.find(p => p.id?.toLowerCase() === options.id.toLowerCase());
        if (existing) {
          console.error(`Provider "${options.id}" already exists, use "provider update" to modify.`);
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
        console.log(`Added provider: ${options.id} (${options.name})`);
      });
    })
);

/* ── provider update ── */

gw(
  providerCmd
    .command('update')
    .description('Update an existing LLM provider (at least one change required)')
    .requiredOption('--id <id>', 'Provider ID (use provider list to view)')
    .option('--name <name>', 'New display name')
    .option('--base-url <url>', 'New API base URL')
    .option('--api-key <key>', 'New API Key')
    .addHelpText('after', `
Examples:
  Set API Key:                 openmcp setting llm provider update --id deepseek --api-key sk-xxx
  Change Base URL:                openmcp setting llm provider update --id openai --base-url https://api.openai.com/v1
  Change Key and Base URL together:    openmcp setting llm provider update --id qwen --api-key sk-xxx --base-url https://new-url.com/v1
  Change display name:                 openmcp setting llm provider update --id deepseek --name "DeepSeek V3"
`)
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const hasName = options.name !== undefined;
        const hasBaseUrl = options.baseUrl !== undefined;
        const hasApiKey = options.apiKey !== undefined;

        if (!hasName && !hasBaseUrl && !hasApiKey) {
          console.warn(`⚠ No changes specified. Please provide at least one of the following options:\n`);
          console.log(`  --api-key <key>    Set API Key`);
          console.log(`  --base-url <url>   Set API base URL`);
          console.log(`  --name <name>      Set display name`);
          console.log('');
          console.log(`Examples:`);
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
          console.error(`Provider "${options.id}" not found.`);
          if (available) console.error(`\nConfigured providers:\n${available}`);
          console.error(`\nUse "openmcp setting llm provider list" to view all providers.`);
          process.exitCode = 1;
          return;
        }

        const changes: string[] = [];
        if (hasName) {
          const old = provider.name;
          provider.name = options.name;
          changes.push(`  Display name: ${old} → ${provider.name}`);
        }
        if (hasBaseUrl) {
          const old = provider.baseUrl || '(not set)';
          provider.baseUrl = options.baseUrl;
          changes.push(`  Base URL:  ${old} → ${provider.baseUrl}`);
        }
        if (hasApiKey) {
          const masked = options.apiKey.length > 8
            ? options.apiKey.slice(0, 4) + '****' + options.apiKey.slice(-4)
            : '****';
          changes.push(`  API Key:   Updated (${masked})`);
          provider.userToken = options.apiKey;
        }

        const saveRes = await bridge.commandRequest('setting/save', settings);
        if (saveRes.code !== 200) {
          printJson(saveRes);
          process.exitCode = 1;
          return;
        }
        console.log(`✔ Updated provider: ${provider.id} (${provider.name})\n`);
        console.log('Changes:');
        for (const c of changes) console.log(c);
      });
    })
);

/* ── provider delete ── */

gw(
  providerCmd
    .command('delete')
    .description('Delete LLM provider')
    .requiredOption('--id <id>', 'Provider ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const settings = await loadSettings(bridge);
        const llmInfo: LlmProviderInfo[] = Array.isArray(settings.LLM_INFO) ? settings.LLM_INFO : [];

        const idx = llmInfo.findIndex(p => p.id?.toLowerCase() === options.id.toLowerCase());
        if (idx < 0) {
          console.error(`Provider "${options.id}" not found.`);
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
        console.log(`Deleted provider: ${removed.id} (${removed.name})`);
      });
    })
);

llmCommand.addCommand(providerCmd);

/* ── model list ── */

const modelCmd = new Command('model')
  .description('Model management');

gw(
  modelCmd
    .command('list')
    .description('List available models for a provider (fetched from remote API)')
    .requiredOption('--provider <id>', 'Provider id, e.g. deepseek, openai')
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
          console.error(`Provider "${provider.id}" (${provider.name}) API Key is not set.`);
          console.error(`Please configure first: openmcp setting llm provider update --id ${provider.id} --api-key <your-api-key>`);
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
    .description('Refresh model list for a provider and save to settings')
    .requiredOption('--provider <id>', 'Provider id')
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
          console.error(`Provider "${provider.id}" API Key is not set.`);
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
          console.log('API returned no models.');
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
        console.log(`Refreshed ${provider.id} model list (${modelIds.length} models)`);
      });
    })
);

llmCommand.addCommand(modelCmd);

/* ── test ── */

gw(
  llmCommand
    .command('test')
    .description('Test API connectivity for a provider')
    .requiredOption('--provider <id>', 'Provider id')
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
          console.error(`Provider "${provider.id}" API Key is not set.`);
          process.exitCode = 1;
          return;
        }

        console.log(`Testing ${provider.id} (${provider.name}) ...`);
        const res = await bridge.commandRequest('llm/models', {
          baseURL: provider.baseUrl,
          apiKey: provider.userToken
        });

        if (res.code === 200) {
          console.log(`Connection successful!`);
        } else {
          console.error(`Connection failed.`);
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
    .description('Synchronous chat completion')
    .requiredOption('--provider <id>', 'Provider id, e.g. deepseek, openai, qwen')
    .requiredOption('--model <name>', 'Model name, e.g. deepseek-chat, gpt-4, qwen-plus')
    .option('-m, --message <text>', 'Quickly send a single user message')
    .option('-f, --file <path>', 'Read messages array from a JSON file')
    .option('--temperature <number>', 'Temperature parameter', parseFloat)
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
          console.error(`Provider "${provider.id}" (${provider.name}) API Key is not set.`);
          console.error('');
          console.error('Please configure first:');
          console.error(`  openmcp setting llm provider update --id ${provider.id} --api-key <your-api-key>`);
          process.exitCode = 1;
          return;
        }

        const model = options.model;
        const models: string[] = Array.isArray((provider as any).models) ? (provider as any).models : [];

        if (models.length > 0 && !models.includes(model)) {
          console.error(`Model "${model}" is not in ${provider.id} (${provider.name}) available model list.`);
          console.error('');
          console.error(`Available models: ${models.join(', ')}`);
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
            console.error(`Failed to read file: ${e.message}`);
            process.exitCode = 1;
            return;
          }
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          console.error('Missing message content. Please provide via -m or -f.');
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
