export type ConnectionType = 'STDIO' | 'SSE' | 'STREAMABLE_HTTP';
export type ConnectPayload = Record<string, unknown>;
export type McpServerEntry = Record<string, unknown>;

export interface ConfigValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function normalizeConnectionType(type?: string): ConnectionType | undefined {
  if (!type) return undefined;
  const normalized = type.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (normalized === 'STDIO') return 'STDIO';
  if (normalized === 'SSE') return 'SSE';
  if (normalized === 'STREAMABLE_HTTP' || normalized === 'STREAMABLEHTTP' || normalized === 'HTTP') {
    return 'STREAMABLE_HTTP';
  }
  return undefined;
}

export function resolveConnectionTypeFromServer(server: McpServerEntry): ConnectionType {
  const rawType = typeof server.type === 'string' ? server.type : typeof server.transport === 'string' ? server.transport : '';
  const normalized = normalizeConnectionType(rawType);
  if (normalized) return normalized;

  if (typeof server.command === 'string' && server.command.trim() !== '') {
    return 'STDIO';
  }
  if (typeof server.url === 'string' && server.url.trim() !== '') {
    return 'SSE';
  }
  return 'STDIO';
}

export function mapMcpServerToPayload(server: McpServerEntry): ConnectPayload {
  const payload: ConnectPayload = {
    connectionType: resolveConnectionTypeFromServer(server)
  };
  if (typeof server.command === 'string') payload.command = server.command;
  if (Array.isArray(server.args)) payload.args = server.args;
  if (typeof server.url === 'string') payload.url = server.url;
  if (typeof server.cwd === 'string') payload.cwd = server.cwd;
  if (isPlainObject(server.env)) payload.env = server.env;
  return payload;
}

export function resolvePayloadFromConfig(config: ConnectPayload, serverName?: string): ConnectPayload {
  const mcpServers = config.mcpServers;
  if (isPlainObject(mcpServers)) {
    const servers = mcpServers as Record<string, McpServerEntry>;
    const names = Object.keys(servers);
    if (names.length === 0) {
      throw new Error('配置文件为 mcpServers 格式，但未包含任何 server。');
    }

    let pickedName = serverName;
    if (!pickedName) {
      if (names.length === 1) {
        pickedName = names[0];
      } else {
        throw new Error(`检测到 mcpServers 聚合配置，包含多个 server。请使用 --mcp-server 指定目标。\n可选值: ${names.join(', ')}`);
      }
    }

    const server = servers[pickedName];
    if (!server) {
      throw new Error(`未找到 mcpServer "${pickedName}"。\n可选值: ${names.join(', ')}`);
    }
    return mapMcpServerToPayload(server);
  }

  if (serverName) {
    throw new Error('当前配置文件是扁平 McpOptions 格式，不支持 --mcp-server。');
  }

  const normalized = normalizeConnectionType(config.connectionType as string | undefined);
  const payload = { ...config };
  if (normalized) payload.connectionType = normalized;
  return payload;
}

function validatePayload(payload: ConnectPayload, prefix: string): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const type = normalizeConnectionType(payload.connectionType as string | undefined);
  if (!type) {
    errors.push(`${prefix} 缺少或无效 connectionType（STDIO/SSE/STREAMABLE_HTTP/http）`);
  }
  if (type === 'STDIO') {
    if (typeof payload.command !== 'string' || payload.command.trim() === '') {
      errors.push(`${prefix} STDIO 需要 command`);
    }
    if (payload.args !== undefined && !Array.isArray(payload.args)) {
      errors.push(`${prefix} args 必须是数组`);
    }
  }
  if (type === 'SSE' || type === 'STREAMABLE_HTTP') {
    if (typeof payload.url !== 'string' || payload.url.trim() === '') {
      errors.push(`${prefix} ${type} 需要 url`);
    }
  }
  if (payload.env !== undefined && !isPlainObject(payload.env)) {
    errors.push(`${prefix} env 必须是对象`);
  }
  if (!type && !payload.command && !payload.url) {
    warnings.push(`${prefix} 无法推断连接方式，建议显式写 connectionType`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateConfig(config: ConnectPayload): ConfigValidationResult {
  if (!isPlainObject(config)) {
    return {
      ok: false,
      errors: ['配置文件根节点必须是 JSON 对象'],
      warnings: []
    };
  }

  const mcpServers = config.mcpServers;
  if (isPlainObject(mcpServers)) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const entries = Object.entries(mcpServers);
    if (entries.length === 0) {
      errors.push('mcpServers 不能为空对象');
    }
    for (const [name, server] of entries) {
      if (!isPlainObject(server)) {
        errors.push(`mcpServers.${name} 必须是对象`);
        continue;
      }
      const r = validatePayload(mapMcpServerToPayload(server), `mcpServers.${name}`);
      errors.push(...r.errors);
      warnings.push(...r.warnings);
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  return validatePayload(config, 'root');
}

export function buildTemplate(kind: 'stdio' | 'sse' | 'http'): ConnectPayload {
  if (kind === 'stdio') {
    return {
      connectionType: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      cwd: '.'
    };
  }
  if (kind === 'sse') {
    return {
      connectionType: 'SSE',
      url: 'http://127.0.0.1:3000/sse'
    };
  }
  return {
    connectionType: 'STREAMABLE_HTTP',
    url: 'http://127.0.0.1:8080/mcp'
  };
}

export function payloadToMcpServer(payload: ConnectPayload): McpServerEntry {
  const out: McpServerEntry = {};
  const type = normalizeConnectionType(payload.connectionType as string | undefined);
  if (type === 'STDIO') out.type = 'stdio';
  if (type === 'SSE') out.type = 'sse';
  if (type === 'STREAMABLE_HTTP') out.type = 'http';
  if (typeof payload.command === 'string') out.command = payload.command;
  if (Array.isArray(payload.args)) out.args = payload.args;
  if (typeof payload.url === 'string') out.url = payload.url;
  if (typeof payload.cwd === 'string') out.cwd = payload.cwd;
  if (isPlainObject(payload.env)) out.env = payload.env;
  return out;
}

export function previewMergedEnv(payload: ConnectPayload): {
  env: Record<string, string>;
  injectedKeys: string[];
} {
  const fileEnv = isPlainObject(payload.env) ? payload.env : {};
  const env = { ...process.env } as Record<string, string>;
  const injectedKeys: string[] = [];
  for (const [key, value] of Object.entries(fileEnv)) {
    const safeValue = typeof value === 'string' ? value : String(value);
    env[key] = safeValue;
    injectedKeys.push(key);
  }
  return { env, injectedKeys };
}
