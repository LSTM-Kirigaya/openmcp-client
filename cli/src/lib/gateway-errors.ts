/**
 * Gateway WebSocket 不可达时的用户可读错误（中文）。
 */

const DEFAULT_PORT = 8282;

/** 是否像「默认本机 Gateway」（便于提示先启动 gateway start） */
function urlLooksLikeDefaultGateway(url: string): boolean {
  if (url.includes(`:${DEFAULT_PORT}`)) {
    return true;
  }
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    return local && u.port === String(DEFAULT_PORT);
  } catch {
    return false;
  }
}

/**
 * 构建「连不上 Gateway」时的完整说明（用于 throw 或打印）。
 */
export function buildGatewayUnreachableError(gatewayUrl: string, underlying?: string): Error {
  const lines: string[] = [
    `无法连接到 OpenMCP Gateway：${gatewayUrl}`,
    '',
    '常见原因：本机尚未启动 Gateway 进程，或地址/端口与 Gateway 实际监听不一致。'
  ];

  if (urlLooksLikeDefaultGateway(gatewayUrl)) {
    lines.push('');
    lines.push(`默认 WebSocket 为 ws://localhost:${DEFAULT_PORT}。请先启动 Gateway，例如：`);
    lines.push(`  yarn openmcp-cli gateway start`);
    lines.push(`  # 或前台运行： openmcp-cli gateway run -p ${DEFAULT_PORT}`);
  }

  lines.push('');
  lines.push('若 Gateway 已启动但使用了其它端口，请为子命令指定 -g，例如：');
  lines.push(`  openmcp-cli mcp connect --config-file ./mcp.json -g ws://127.0.0.1:9000`);

  if (underlying && underlying.trim()) {
    lines.push('');
    lines.push(`底层错误：${underlying}`);
  }

  return new Error(lines.join('\n'));
}
