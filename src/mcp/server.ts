import { createServer, IncomingMessage, ServerResponse, Server as HttpServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { HuduService } from '../services/hudu.service.js';
import { Logger } from '../utils/logger.js';
import { McpServerConfig } from '../types/mcp.js';
import { EnvironmentConfig, GatewayCredentials, parseCredentialsFromHeaders } from '../utils/config.js';
import { HuduResourceHandler } from '../handlers/resource.handler.js';
import { HuduToolHandler } from '../handlers/tool.handler.js';

export class HuduMcpServer {
  private server: Server;
  private huduService: HuduService;
  private resourceHandler: HuduResourceHandler;
  private toolHandler: HuduToolHandler;
  private logger: Logger;
  private envConfig: EnvironmentConfig | undefined;
  private httpServer?: HttpServer;
  private httpTransport?: StreamableHTTPServerTransport;

  constructor(config: McpServerConfig, logger: Logger, envConfig?: EnvironmentConfig) {
    this.logger = logger;
    this.envConfig = envConfig;

    this.server = new Server(
      { name: config.name, version: config.version },
      {
        capabilities: {
          resources: { subscribe: false, listChanged: true },
          tools: { listChanged: true }
        },
        instructions: this.getServerInstructions()
      }
    );

    this.huduService = new HuduService(config, logger);
    this.resourceHandler = new HuduResourceHandler(this.huduService, logger);
    this.toolHandler = new HuduToolHandler(this.huduService, logger);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.logger.info('Setting up MCP request handlers...');

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resources = await this.resourceHandler.listResources();
        return { resources };
      } catch (error) {
        this.logger.error('Failed to list resources:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const content = await this.resourceHandler.readResource(request.params.uri);
        return { contents: [content] };
      } catch (error) {
        this.logger.error(`Failed to read resource ${request.params.uri}:`, error);
        throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const tools = await this.toolHandler.listTools();
        return { tools };
      } catch (error) {
        this.logger.error('Failed to list tools:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const result = await this.toolHandler.callTool(request.params.name, request.params.arguments || {});
        return { content: result.content, isError: result.isError };
      } catch (error) {
        this.logger.error(`Failed to call tool ${request.params.name}:`, error);
        throw new McpError(ErrorCode.InternalError, `Failed to call tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    this.logger.info('MCP request handlers set up successfully');
  }

  async start(): Promise<void> {
    const transportType = this.envConfig?.transport?.type || 'stdio';
    this.logger.info(`Starting Hudu MCP Server with ${transportType} transport...`);

    this.server.onerror = (error) => this.logger.error('MCP Server error:', error);
    this.server.oninitialized = () => this.logger.info('MCP Server initialized and ready');

    if (transportType === 'http') {
      await this.startHttpTransport();
    } else {
      await this.startStdioTransport();
    }
  }

  private async startStdioTransport(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('Hudu MCP Server connected to stdio transport');
  }

  /**
   * Start with HTTP Streamable transport.
   * In gateway mode, credentials are extracted from request headers on each request.
   */
  private async startHttpTransport(): Promise<void> {
    const port = this.envConfig?.transport?.port || 8080;
    const host = this.envConfig?.transport?.host || '0.0.0.0';
    const isGatewayMode = this.envConfig?.auth?.mode === 'gateway';

    // Stateless mode: no session IDs. The gateway manages per-user sessions;
    // the backend just processes each request independently.  This allows
    // multiple clients (via the gateway) to hit the same server instance
    // without "Server already initialized" errors.
    this.httpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      // Health endpoint — no auth required
      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          transport: 'http',
          authMode: isGatewayMode ? 'gateway' : 'env',
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // MCP endpoint
      if (url.pathname === '/mcp') {
        // In gateway mode, extract credentials from headers before handling
        if (isGatewayMode) {
          const credentials = this.extractGatewayCredentials(req);
          if (!credentials.baseUrl || !credentials.apiKey) {
            this.logger.warn('Gateway mode: Missing required credentials in headers', {
              hasBaseUrl: !!credentials.baseUrl,
              hasApiKey: !!credentials.apiKey,
            });
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Missing credentials',
              message: 'Gateway mode requires X-Hudu-Base-URL and X-Hudu-API-Key headers',
              required: ['X-Hudu-Base-URL', 'X-Hudu-API-Key']
            }));
            return;
          }
          // Update service credentials for this request
          this.updateCredentials(credentials);
        }

        this.httpTransport!.handleRequest(req, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', endpoints: ['/mcp', '/health'] }));
    });

    await this.server.connect(this.httpTransport as unknown as Transport);

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(port, host, () => {
        this.logger.info(`Hudu MCP Server listening on http://${host}:${port}/mcp`);
        this.logger.info(`Health check available at http://${host}:${port}/health`);
        this.logger.info(`Authentication mode: ${isGatewayMode ? 'gateway (header-based)' : 'env (environment variables)'}`);
        resolve();
      });
    });
  }

  /**
   * Extract credentials from gateway-injected HTTP headers.
   */
  private extractGatewayCredentials(req: IncomingMessage): GatewayCredentials {
    const headers = req.headers as Record<string, string | string[] | undefined>;
    return parseCredentialsFromHeaders(headers);
  }

  /**
   * Update the Hudu service with new credentials from gateway headers.
   */
  private updateCredentials(credentials: GatewayCredentials): void {
    this.huduService.updateCredentials(credentials.baseUrl!, credentials.apiKey!);
    this.logger.debug('Updated Hudu credentials from gateway headers');
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Hudu MCP Server...');
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => err ? reject(err) : resolve());
      });
    }
    await this.server.close();
    this.logger.info('Hudu MCP Server stopped');
  }

  private getServerInstructions(): string {
    return `# Hudu MCP Server

This server provides access to Hudu IT documentation platform through the Model Context Protocol.

## Available Resources:
- **hudu://companies**, **hudu://companies/{id}** - Company data
- **hudu://assets**, **hudu://assets/{id}** - Asset data
- **hudu://articles**, **hudu://articles/{id}** - Knowledge base articles

## Available Tools (39 total):
- Companies: list, get, create, update, delete, archive, unarchive
- Assets: list, get, create, update, delete, archive
- Asset Layouts: list, get, create, update
- Asset Passwords: list, get, create, update, delete
- Articles: list, get, create, update, delete, archive
- Websites: list, get, create, update, delete
- Folders: list
- Procedures: list
- Activity Logs: list
- Relations: list
- Magic Dash: list
- Utility: test connection

## Authentication:
- HUDU_BASE_URL (required) - Your Hudu instance URL
- HUDU_API_KEY (required) - Your Hudu API key`;
  }
}
