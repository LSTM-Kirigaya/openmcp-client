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
    `Unable to connect to OpenMCP Gateway: ${gatewayUrl}`,
    '',
    'Common causes: Gateway process is not running locally, or the address/port does not match what Gateway is actually listening on.'
  ];

  if (urlLooksLikeDefaultGateway(gatewayUrl)) {
    lines.push('');
    lines.push(`Default WebSocket is ws://localhost:${DEFAULT_PORT}. Please start Gateway first:`);
    lines.push(`  openmcp gateway start`);
    lines.push(`  # Or run in foreground to view logs: openmcp gateway run -p ${DEFAULT_PORT}`);
    lines.push('');
    lines.push('If "openmcp" is not recognized, please install or reinstall the CLI:');
    lines.push('  npm install -g @agent-ruler/openmcp');
  }

  lines.push('');
  lines.push('If Gateway is already running on a different port, specify -g for subcommands, e.g.:');
  lines.push(`  openmcp mcp server list -g ws://127.0.0.1:9000`);

  if (underlying && underlying.trim()) {
    lines.push('');
    lines.push(`Underlying error: ${underlying}`);
  }

  lines.push('');
  lines.push('If the issue persists, please copy the full error report (including stack trace, Node.js version, and executed command) and send it to the OpenMCP maintainers.');

  return new Error(lines.join('\n'));
}
