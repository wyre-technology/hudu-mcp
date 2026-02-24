export interface McpServerConfig {
  name: string;
  version: string;
  hudu: {
    baseUrl?: string;
    apiKey?: string;
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
  isError?: boolean;
}
