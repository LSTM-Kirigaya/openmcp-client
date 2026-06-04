import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY, readJsonFile } from '../../lib/cli-helpers.js';
import { resolveClientIdWithGateway } from '../../lib/mcp-session-store.js';
import { diagnoseThrownError } from '../../lib/error-diagnose.js';

type MessageLike = {
  role?: unknown;
  content?: unknown;
};

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function printThrown(error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  console.error(text);
  for (const tip of diagnoseThrownError(error)) {
    console.error(`[diagnose] ${tip}`);
  }
  process.exitCode = 1;
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item) {
          return String((item as { text?: unknown }).text ?? '');
        }
        return JSON.stringify(item);
      })
      .filter(Boolean)
      .join('\n');
  }
  return JSON.stringify(content);
}

function messageArrayFromFile(value: unknown): MessageLike[] | null {
  if (Array.isArray(value)) return value as MessageLike[];
  if (value && typeof value === 'object' && Array.isArray((value as { messages?: unknown }).messages)) {
    return (value as { messages: MessageLike[] }).messages;
  }
  return null;
}

function lastUserMessage(messages: MessageLike[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === 'user') {
      const text = contentToText(message.content).trim();
      if (text) return text;
    }
  }
  return '';
}

function loadUserInput(options: { message?: string; file?: string }): string {
  if (options.message?.trim()) return options.message.trim();
  if (!options.file) {
    throw new Error('Missing input. Pass -m "hello" or --file ./messages.json.');
  }

  let fileContent: unknown;
  try {
    fileContent = readJsonFile(options.file);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read --file: ${detail}`);
  }

  if (typeof fileContent === 'string' && fileContent.trim()) return fileContent.trim();
  if (fileContent && typeof fileContent === 'object') {
    const objectContent = fileContent as { input?: unknown; message?: unknown };
    if (typeof objectContent.input === 'string' && objectContent.input.trim()) return objectContent.input.trim();
    if (typeof objectContent.message === 'string' && objectContent.message.trim()) return objectContent.message.trim();
  }

  const messages = messageArrayFromFile(fileContent);
  if (!messages) {
    throw new Error(
      'Invalid --file format. Expected a JSON string, {"input":"..."}, {"message":"..."}, a messages array, or {"messages":[...]}.'
    );
  }

  const input = lastUserMessage(messages);
  if (!input) {
    throw new Error('Invalid --file messages. Expected at least one non-empty message with role "user".');
  }
  return input;
}

function assistantResponseFromTrace(trace: unknown[]): string {
  for (let i = trace.length - 1; i >= 0; i--) {
    const message = trace[i] as MessageLike;
    if (message?.role === 'assistant') {
      const text = contentToText(message.content).trim();
      if (text) return text;
    }
  }
  return '';
}

export const chatCommand = new Command('chat')
  .description('Interactive MCP chat using an LLM agent');

const CHAT_START_HELP = `
Input format:
  -m, --message is a single user message.
  --file can be:
    "hello"
    {"input":"hello"}
    [{"role":"user","content":"hello"}]
    {"messages":[{"role":"user","content":"hello"}]}

The command asks the configured LLM to answer through the connected MCP session.
For messages files, the last non-empty user message is used as the agent input.
Pass --validate only when you also want a smoke evaluation of the generated trace.

Examples:
  openmcp debug chat start --provider deepseek --model deepseek-chat -m "hello"
  openmcp debug chat start --provider deepseek --model deepseek-chat -m "hello" --validate
  openmcp debug chat start --provider deepseek --model deepseek-chat --file ./messages.json
`;

gw(
  chatCommand
    .command('start')
    .description('Start an MCP-aware chat')
    .option('--client-id <id>', 'MCP session clientId; defaults to the current session')
    .requiredOption('--provider <id>', 'LLM provider id or name from settings')
    .requiredOption('--model <name>', 'LLM model name')
    .option('-m, --message <text>', 'Initial user message')
    .option('-f, --file <path>', 'Read input from a JSON file')
    .option('--validate', 'Evaluate the generated chat trace after the chat response')
    .addHelpText('after', CHAT_START_HELP)
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const clientId = await resolveClientIdWithGateway(options, bridge);
          const settingsRes = await bridge.commandRequest('setting/load', {});
          if (settingsRes.code !== 200) {
            printJson(settingsRes);
            process.exitCode = 1;
            return;
          }

          const settings = settingsRes.msg as any;
          const llmInfo = Array.isArray(settings?.LLM_INFO) ? settings.LLM_INFO : [];
          const lower = options.provider.toLowerCase();
          const provider = llmInfo.find(
            (p: any) => p.id?.toLowerCase() === lower || p.name?.toLowerCase() === lower
          );
          if (!provider) {
            console.error(`Provider "${options.provider}" was not found in settings.`);
            process.exitCode = 1;
            return;
          }
          if (!provider.userToken) {
            console.error(`Provider "${provider.id}" does not have an API key configured.`);
            process.exitCode = 1;
            return;
          }

          const input = loadUserInput(options);
          const llmConfig = {
            baseURL: provider.baseUrl,
            apiKey: provider.userToken,
            model: options.model,
            temperature: 0,
            useAnthropicProtocol: provider.useAnthropicProtocol || false
          };

          console.log(`Interactive test: ${provider.name} | ${options.model}`);
          console.log(`MCP session: ${clientId}`);
          console.log('');

          const agentRes = await bridge.commandRequest('debug-chat/run-agent', {
            clientId,
            input,
            llmConfig
          }, 600000);
          if (agentRes.code !== 200) {
            printJson(agentRes);
            process.exitCode = 1;
            return;
          }

          const trace = (agentRes.msg as { trace?: unknown })?.trace;
          if (!Array.isArray(trace) || trace.length === 0) {
            printJson({
              code: 500,
              msg: 'debug-chat/run-agent returned an empty trace',
              agent: agentRes
            });
            process.exitCode = 1;
            return;
          }

          const response = assistantResponseFromTrace(trace);
          if (!options.validate) {
            printJson({
              _id: agentRes._id,
              code: 200,
              msg: {
                input,
                response,
                trace
              }
            });
            return;
          }

          const validationBody = {
            messages: trace,
            testCases: [
              {
                id: 'debug-chat-smoke',
                name: 'Debug chat smoke',
                expectedCriteria: 'The assistant response should address the user message.'
              }
            ],
            evaluationMode: 'pass-fail',
            llmConfig
          };

          const res = await bridge.commandRequest('batch-validation/run', validationBody, 600000);
          const validationMsg = res.msg as { results?: unknown } | undefined;
          printJson({
            _id: res._id,
            code: res.code,
            msg: {
              input,
              response,
              trace,
              results: validationMsg?.results,
              validation: res.msg
            }
          });
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
