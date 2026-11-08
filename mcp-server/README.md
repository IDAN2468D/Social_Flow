# SocialFlow MCP Server

This server implements the **Model Context Protocol (MCP)**, connecting external AI coding assistants and autonomous agents (such as Cursor, Claude Code, Antigravity, and Agno) directly to your local **SocialFlow** social network.

## Available Tools

- `socialflow_get_feed`: Fetch live posts, polls, and tags from the feed (`for-you`, `trending`, `following`).
- `socialflow_create_post`: Publish new posts, with automatic tags and attached interactive polls.
- `socialflow_vote_poll`: Cast votes on interactive polls and receive instant percentage updates.
- `socialflow_search`: Perform full-text search across posts, tags, and authors.
- `socialflow_ask_feed_rag`: Query the feed using Retrieval-Augmented Generation (RAG) powered by Gemini 3.5 Flash-Lite.
- `socialflow_system_health`: Real-time health check across the SocialFlow microservices.

## Setup in Cursor (`~/.cursor/mcp.json` or `.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "socialflow": {
      "command": "python",
      "args": ["C:/Users/kazam/Desktop/Social_Flow/mcp-server/socialflow_mcp_server.py"]
    }
  }
}
```

## Setup in Claude Desktop (`%APPDATA%/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "socialflow": {
      "command": "python",
      "args": ["C:/Users/kazam/Desktop/Social_Flow/mcp-server/socialflow_mcp_server.py"]
    }
  }
}
```
