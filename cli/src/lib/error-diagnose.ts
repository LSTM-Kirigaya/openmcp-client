import { RestFulResponse } from './message-bridge.js';

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

export function diagnoseResponse(command: string, response: RestFulResponse): string[] {
  const advice: string[] = [];
  const msg = typeof response.msg === 'string' ? response.msg : JSON.stringify(response.msg);
  const code = response.code;

  if (code === 401 || includesAny(msg, ['unauthorized', 'token', '未登录', 'login'])) {
    advice.push('认证可能失效：先执行 `openmcp-cli cloud auth status`，必要时执行 `openmcp-cli cloud auth refresh` 或重新登录。');
  }
  if (code === 404 || includesAny(msg, ['command not found'])) {
    advice.push('命令名可能不存在：检查命令字符串与 service 是否一致，或升级到匹配版本。');
  }
  if (code === 408 || includesAny(msg, ['timeout', 'timed out'])) {
    advice.push('请求超时：检查网络/目标服务状态，或提高调用超时时间。');
  }
  if (code >= 500 || includesAny(msg, ['econnrefused', '连接', 'spawn', 'not found'])) {
    advice.push('服务端执行失败：确认 Gateway 已启动、MCP 进程可执行文件存在、连接参数（url/command/cwd）正确。');
  }
  if (includesAny(msg, ['clientid', 'client id', '尚未连接'])) {
    advice.push(`会话异常：先执行 \`openmcp-cli mcp sessions list\` 或重新 \`openmcp-cli mcp connect\`。`);
  }
  if (advice.length === 0 && code !== 200) {
    advice.push(`命令 \`${command}\` 执行失败，请检查请求参数和网关日志。`);
  }
  return advice;
}

export function diagnoseThrownError(error: unknown): string[] {
  const text = error instanceof Error ? error.message : String(error);
  const advice: string[] = [];
  if (includesAny(text, ['gateway', 'ws://', 'econnrefused', 'websocket'])) {
    advice.push('网关不可达：请先执行 `openmcp-cli gateway start`，并确认 `-g` 地址正确。');
  }
  if (includesAny(text, ['json'])) {
    advice.push('JSON 解析失败：请检查 `--data` / `--args` / 配置文件内容格式。');
  }
  if (includesAny(text, ['timeout'])) {
    advice.push('网络或下游调用超时：稍后重试，或调整超时时间。');
  }
  return advice;
}
