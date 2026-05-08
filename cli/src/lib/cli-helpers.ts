import fs from 'fs';
import { createMessageBridge, type MessageBridge } from './message-bridge.js';
import { diagnoseResponse } from './error-diagnose.js';

export const DEFAULT_GATEWAY = 'ws://localhost:8282';

class RelaxedJsonObjectParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse(): unknown {
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.index !== this.input.length) {
      throw new Error('Unexpected trailing content');
    }
    return value;
  }

  private parseValue(): unknown {
    this.skipWhitespace();
    const ch = this.peek();
    if (ch === undefined) {
      throw new Error('Missing value');
    }
    if (ch === '{') return this.parseObject();
    if (ch === '[') return this.parseArray();
    if (ch === '"' || ch === "'") return this.parseQuotedString();
    return this.parseBareValue();
  }

  private parseObject(): Record<string, unknown> {
    this.expect('{');
    const result: Record<string, unknown> = {};
    this.skipWhitespace();
    if (this.peek() === '}') {
      this.index += 1;
      return result;
    }

    while (true) {
      const key = this.parseKey();
      this.skipWhitespace();
      this.expect(':');
      result[key] = this.parseValue();
      this.skipWhitespace();

      const ch = this.peek();
      if (ch === ',') {
        this.index += 1;
        this.skipWhitespace();
        continue;
      }
      if (ch === '}') {
        this.index += 1;
        return result;
      }
      throw new Error('Expected comma or closing brace');
    }
  }

  private parseArray(): unknown[] {
    this.expect('[');
    const result: unknown[] = [];
    this.skipWhitespace();
    if (this.peek() === ']') {
      this.index += 1;
      return result;
    }

    while (true) {
      result.push(this.parseValue());
      this.skipWhitespace();

      const ch = this.peek();
      if (ch === ',') {
        this.index += 1;
        continue;
      }
      if (ch === ']') {
        this.index += 1;
        return result;
      }
      throw new Error('Expected comma or closing bracket');
    }
  }

  private parseKey(): string {
    this.skipWhitespace();
    const ch = this.peek();
    if (ch === '"' || ch === "'") return this.parseQuotedString();

    const start = this.index;
    while (this.index < this.input.length && this.input[this.index] !== ':') {
      const current = this.input[this.index];
      if (current === '{' || current === '}' || current === '[' || current === ']' || current === ',') {
        break;
      }
      this.index += 1;
    }

    const key = this.input.slice(start, this.index).trim();
    if (!key) {
      throw new Error('Missing object key');
    }
    return key;
  }

  private parseQuotedString(): string {
    const quote = this.input[this.index];
    this.index += 1;
    let result = '';

    while (this.index < this.input.length) {
      const ch = this.input[this.index];
      this.index += 1;

      if (ch === quote) {
        return result;
      }

      if (ch !== '\\') {
        result += ch;
        continue;
      }

      if (this.index >= this.input.length) {
        throw new Error('Unfinished escape sequence');
      }
      const escaped = this.input[this.index];
      this.index += 1;
      switch (escaped) {
        case '"':
        case "'":
        case '\\':
        case '/':
          result += escaped;
          break;
        case 'b':
          result += '\b';
          break;
        case 'f':
          result += '\f';
          break;
        case 'n':
          result += '\n';
          break;
        case 'r':
          result += '\r';
          break;
        case 't':
          result += '\t';
          break;
        case 'u': {
          const hex = this.input.slice(this.index, this.index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw new Error('Invalid unicode escape');
          }
          result += String.fromCharCode(Number.parseInt(hex, 16));
          this.index += 4;
          break;
        }
        default:
          throw new Error('Invalid escape sequence');
      }
    }

    throw new Error('Unclosed string');
  }

  private parseBareValue(): unknown {
    const start = this.index;
    while (this.index < this.input.length && !',}]'.includes(this.input[this.index])) {
      this.index += 1;
    }

    const token = this.input.slice(start, this.index).trim();
    if (!token) {
      throw new Error('Missing value');
    }
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(token)) {
      return Number(token);
    }
    return token;
  }

  private skipWhitespace(): void {
    while (this.index < this.input.length && /\s/.test(this.input[this.index])) {
      this.index += 1;
    }
  }

  private expect(expected: string): void {
    if (this.input[this.index] !== expected) {
      throw new Error(`Expected ${expected}`);
    }
    this.index += 1;
  }

  private peek(): string | undefined {
    return this.input[this.index];
  }
}

function parseRelaxedJsonObject(raw: string): Record<string, unknown> | undefined {
  try {
    const value = new RelaxedJsonObjectParser(raw).parse();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Fall through to the strict, user-facing error below.
  }
  return undefined;
}

function assertPlainJsonObject(value: unknown, optionName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${optionName} must be a JSON object, for example: ${optionName} '{"message":"hi"}'`);
  }
  return value as Record<string, unknown>;
}

function invalidJsonError(optionName: string, raw: string): Error {
  return new Error([
    `Invalid JSON for ${optionName}`,
    `Received: ${raw}`,
    `Expected a JSON object, for example: ${optionName} '{"message":"hi"}'.`,
    `PowerShell tip: if quotes are stripped, try ${optionName} '{\\"message\\":\\"hi\\"}' or use a JSON file when the command supports --file.`,
  ].join('\n'));
}

export function parseJsonData(raw?: string, optionName = '--data'): Record<string, unknown> {
  if (!raw || raw.trim() === '') {
    return {};
  }
  const trimmed = raw.trim();
  try {
    return assertPlainJsonObject(JSON.parse(trimmed), optionName);
  } catch {
    const relaxed = parseRelaxedJsonObject(trimmed);
    if (relaxed) return relaxed;
    throw invalidJsonError(optionName, trimmed);
  }
}

export function readJsonFile(path: string): Record<string, unknown> {
  const text = fs.readFileSync(path, 'utf-8');
  return JSON.parse(text) as Record<string, unknown>;
}

export function writeJsonFile(path: string, value: unknown): void {
  fs.writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printResponse(
  command: string,
  response: { code: number; msg?: unknown; data?: unknown; _id?: string }
): void {
  printJson(response);
  if (response.code !== 200) {
    const tips = diagnoseResponse(command, response as any);
    for (const tip of tips) {
      console.error(`[diagnose] ${tip}`);
    }
  }
}

export async function withGateway<T>(
  gatewayUrl: string,
  fn: (bridge: MessageBridge) => Promise<T>
): Promise<T> {
  const bridge = await createMessageBridge(gatewayUrl);
  try {
    return await fn(bridge);
  } finally {
    await bridge.close();
  }
}
