# 1.0.0 (2026-02-24)


### Bug Fixes

* add semantic-release branch configuration ([0ba664a](https://github.com/wyre-technology/hudu-mcp/commit/0ba664ad48ef42f1c2abd2b066a3f25ae9df4912))


### Features

* initial hudu-mcp server with 39 tools ([9951ad6](https://github.com/wyre-technology/hudu-mcp/commit/9951ad606c5f7a35c76bcb38b3c3af2f341f349f))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Gateway authentication mode (`AUTH_MODE=gateway`) for MCP Gateway integration at mcp.wyretechnology.com
- Per-request credential extraction from `X-Hudu-Base-URL` and `X-Hudu-API-Key` HTTP headers
- `parseCredentialsFromHeaders()` utility for header-based credential parsing
- `HuduService.updateCredentials()` method for runtime client reinitialization
- Dockerfile with multi-stage build (node:22-alpine), non-root `hudu` user, and health check
- Docker build and push job in CI workflow (GHCR, multi-platform linux/amd64 + linux/arm64)
- Auth mode reporting in `/health` endpoint response

## [1.0.0] - 2026-02-23

### Added

- Initial release of Hudu MCP server
- 39 tools covering Companies, Assets, Asset Layouts, Asset Passwords, Articles, Websites, Folders, Procedures, Activity Logs, Relations, and Magic Dash
- MCP resources for companies, assets, and articles
- Dual transport support: stdio (default) and HTTP Streamable
- Lazy SDK initialization on first tool call
- Winston logger with all output to stderr
- Connection test tool
