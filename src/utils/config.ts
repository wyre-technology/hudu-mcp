import { McpServerConfig } from '../types/mcp.js';
import { LogLevel } from './logger.js';

export type TransportType = 'stdio' | 'http';

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
}

export function loadEnvironmentConfig(): EnvironmentConfig {
  const transportType = (process.env.MCP_TRANSPORT as TransportType) || 'stdio';
  if (transportType !== 'stdio' && transportType !== 'http') {
    throw new Error(`Invalid MCP_TRANSPORT value: "${transportType}". Must be "stdio" or "http".`);
  }

  return {
    hudu: {
      baseUrl: process.env.HUDU_BASE_URL,
      apiKey: process.env.HUDU_API_KEY,
    },
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
