import { McpServerConfig } from '../types/mcp.js';
import { LogLevel } from './logger.js';

export type TransportType = 'stdio' | 'http';
export type AuthMode = 'env' | 'gateway';

/**
 * Gateway credentials extracted from HTTP request headers.
 * The MCP Gateway injects credentials via these headers:
 * - X-Hudu-Base-URL: The user's Hudu instance URL
 * - X-Hudu-API-Key: The user's Hudu API key
 */
export interface GatewayCredentials {
  baseUrl: string | undefined;
  apiKey: string | undefined;
}

export interface EnvironmentConfig {
  hudu: {
    baseUrl?: string;
    apiKey?: string;
  };
  server: {
    name: string;
    version: string;
  };
  transport: {
    type: TransportType;
    port: number;
    host: string;
  };
  logging: {
    level: LogLevel;
    format: 'json' | 'simple';
  };
  auth: {
    mode: AuthMode;
  };
}

/**
 * Parse credentials from HTTP request headers (for per-request credential handling).
 * Node.js lowercases all incoming header names, so we read lowercase keys.
 */
export function parseCredentialsFromHeaders(
  headers: Record<string, string | string[] | undefined>
): GatewayCredentials {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    baseUrl: getHeader('x-hudu-base-url'),
    apiKey: getHeader('x-hudu-api-key'),
  };
}

export function loadEnvironmentConfig(): EnvironmentConfig {
  const transportType = (process.env.MCP_TRANSPORT as TransportType) || 'stdio';
  if (transportType !== 'stdio' && transportType !== 'http') {
    throw new Error(`Invalid MCP_TRANSPORT value: "${transportType}". Must be "stdio" or "http".`);
  }

  const authMode = (process.env.AUTH_MODE as AuthMode) || 'env';

  const huduConfig: { baseUrl?: string; apiKey?: string } = {};

  if (authMode === 'gateway') {
    // In gateway mode, credentials arrive per-request via HTTP headers.
    // Env vars are not required at startup.
  } else {
    huduConfig.baseUrl = process.env.HUDU_BASE_URL;
    huduConfig.apiKey = process.env.HUDU_API_KEY;
  }

  return {
    hudu: huduConfig,
    server: {
      name: process.env.MCP_SERVER_NAME || 'hudu-mcp',
      version: process.env.MCP_SERVER_VERSION || '1.0.0'
    },
    transport: {
      type: transportType,
      port: parseInt(process.env.MCP_HTTP_PORT || '8080', 10),
      host: process.env.MCP_HTTP_HOST || '0.0.0.0'
    },
    logging: {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      format: (process.env.LOG_FORMAT as 'json' | 'simple') || 'simple'
    },
    auth: {
      mode: authMode
    }
  };
}

export function mergeWithMcpConfig(envConfig: EnvironmentConfig): McpServerConfig {
  return {
    name: envConfig.server.name,
    version: envConfig.server.version,
    hudu: {
      baseUrl: envConfig.hudu.baseUrl,
      apiKey: envConfig.hudu.apiKey,
    }
  };
}
