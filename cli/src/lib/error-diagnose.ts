import { RestFulResponse } from './message-bridge.js';

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

export function diagnoseResponse(command: string, response: RestFulResponse): string[] {
  const advice: string[] = [];
  const msg = typeof response.msg === 'string' ? response.msg : JSON.stringify(response.msg);
  const code = response.code;

  if (code === 404 || includesAny(msg, ['command not found'])) {
    advice.push('The command may not exist in the running service. Check the command name and rebuild/restart gateway.');
  }
  if (code === 408 || includesAny(msg, ['timeout', 'timed out'])) {
    advice.push('The request timed out. Check the target service or increase the command timeout.');
  }
  if (code >= 500 || includesAny(msg, ['econnrefused', 'spawn', 'not found'])) {
    advice.push('Service execution failed. Check gateway, MCP process path, URL, command, and cwd.');
  }
  if (includesAny(msg, ['clientid', 'client id'])) {
    advice.push('Session is missing. Run `openmcp-cli mcp session list` or reconnect with `openmcp-cli mcp session connect`.');
  }
  if (advice.length === 0 && code !== 200) {
    advice.push(`Command \`${command}\` failed. Check request arguments and gateway logs.`);
  }
  return advice;
}

export function diagnoseThrownError(error: unknown): string[] {
  const text = error instanceof Error ? error.message : String(error);
  const advice: string[] = [];
  if (includesAny(text, ['gateway', 'ws://', 'econnrefused', 'websocket'])) {
    advice.push('Gateway is unreachable. Run `openmcp-cli gateway start` and check the `-g` address.');
  }
  if (includesAny(text, ['json'])) {
    advice.push('JSON parsing failed. Check `--data`, `--args`, or config file content.');
  }
  if (includesAny(text, ['timeout'])) {
    advice.push('The request timed out. Try again later or adjust the timeout.');
  }
  return advice;
}
