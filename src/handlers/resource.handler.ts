import { HuduService } from '../services/hudu.service.js';
import { Logger } from '../utils/logger.js';

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
}

export class HuduResourceHandler {
  private huduService: HuduService;
  private logger: Logger;

  constructor(huduService: HuduService, logger: Logger) {
    this.huduService = huduService;
    this.logger = logger;
  }

  async listResources(): Promise<McpResource[]> {
    return [
      { uri: 'hudu://companies', name: 'All Companies', description: 'List of all companies in Hudu', mimeType: 'application/json' },
      { uri: 'hudu://companies/{id}', name: 'Company by ID', description: 'Get specific company details by ID', mimeType: 'application/json' },
      { uri: 'hudu://assets', name: 'All Assets', description: 'List of all assets in Hudu', mimeType: 'application/json' },
      { uri: 'hudu://assets/{id}', name: 'Asset by ID', description: 'Get specific asset details by ID', mimeType: 'application/json' },
      { uri: 'hudu://articles', name: 'All Articles', description: 'List of all knowledge base articles in Hudu', mimeType: 'application/json' },
      { uri: 'hudu://articles/{id}', name: 'Article by ID', description: 'Get specific article details by ID', mimeType: 'application/json' },
    ];
  }

  async readResource(uri: string): Promise<McpResourceContent> {
    this.logger.debug(`Reading resource: ${uri}`);
    const { resourceType, resourceId } = this.parseUri(uri);

    let data: any;
    let description: string;

    switch (resourceType) {
      case 'companies':
        if (resourceId) {
          data = await this.huduService.getCompany(parseInt(resourceId, 10));
          description = `Company: ${data?.name || 'Unknown'}`;
        } else {
          data = await this.huduService.listCompanies({ page_size: 100 });
          description = `List of ${Array.isArray(data) ? data.length : 0} companies`;
        }
        break;
      case 'assets':
        if (resourceId) {
          data = await this.huduService.getAsset(parseInt(resourceId, 10));
          description = `Asset: ${data?.name || 'Unknown'}`;
        } else {
          data = await this.huduService.listAssets({ page_size: 100 });
          description = `List of ${Array.isArray(data) ? data.length : 0} assets`;
        }
        break;
      case 'articles':
        if (resourceId) {
          data = await this.huduService.getArticle(parseInt(resourceId, 10));
          description = `Article: ${data?.name || 'Unknown'}`;
        } else {
          data = await this.huduService.listArticles({ page_size: 100 });
          description = `List of ${Array.isArray(data) ? data.length : 0} articles`;
        }
        break;
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        description, uri, data,
        metadata: {
          timestamp: new Date().toISOString(),
          resourceType,
          resourceId: resourceId || null,
          count: Array.isArray(data) ? data.length : 1
        }
      }, null, 2)
    };
  }

  private parseUri(uri: string): { resourceType: string; resourceId?: string } {
    const match = uri.match(/^hudu:\/\/([^/]+)(?:\/(.+))?$/);
    if (!match) throw new Error(`Invalid Hudu URI format: ${uri}`);
    const [, resourceType, resourceId] = match;
    if (resourceId === '{id}') throw new Error(`Template URI not supported for reading: ${uri}. Please provide a specific ID.`);
    return { resourceType, resourceId };
  }
}
