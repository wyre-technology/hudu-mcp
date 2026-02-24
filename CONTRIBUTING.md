# Contributing to hudu-mcp

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run in dev mode: `npm run dev`

## Environment Variables

- `HUDU_BASE_URL` - Your Hudu instance URL (required)
- `HUDU_API_KEY` - Your Hudu API key (required)
- `MCP_TRANSPORT` - Transport type: `stdio` (default) or `http`
- `MCP_HTTP_PORT` - HTTP port (default: 8080)
- `LOG_LEVEL` - Log level: error, warn, info, debug (default: info)

## Code Style

- TypeScript with strict mode
- ES modules with `.js` extensions in imports
- Async/await over Promise chains

## Pull Requests

1. Create a feature branch
2. Make your changes
3. Ensure `npm run build` passes
4. Submit a pull request
