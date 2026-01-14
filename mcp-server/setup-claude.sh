#!/bin/bash

# Setup script for Claude Desktop MCP integration

CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
MCP_SERVER_PATH="/Users/ethanlung/Documents/projects/Vibe-Reviews/mcp-server/dist/index.js"

echo "🍽️  Setting up Claude Desktop MCP integration..."
echo ""

# Check if Claude Desktop directory exists
if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    echo "⚠️  Claude Desktop config directory not found!"
    echo "   Please run Claude Desktop at least once first."
    echo ""
    exit 1
fi

# Check if config file exists
if [ ! -f "$CLAUDE_CONFIG_FILE" ]; then
    echo "📝 Creating new config file..."
    cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "vibe-search": {
      "command": "node",
      "args": [
        "$MCP_SERVER_PATH"
      ],
      "env": {
        "OPENAI_API_KEY": "$(grep OPENAI_API_KEY .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' || echo 'YOUR_OPENAI_API_KEY_HERE')",
        "PINECONE_API_KEY": "$(grep PINECONE_API_KEY .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' || echo 'YOUR_PINECONE_API_KEY_HERE')",
        "PINECONE_INDEX_NAME": "vibe-search"
      }
    }
  }
}
EOF
else
    echo "📝 Config file exists. Please edit it manually to add the MCP server."
    echo ""
    echo "Add this to the mcpServers section:"
    echo ""
    cat << EOF
    "vibe-search": {
      "command": "node",
      "args": [
        "$MCP_SERVER_PATH"
      ],
      "env": {
        "OPENAI_API_KEY": "YOUR_KEY_HERE",
        "PINECONE_API_KEY": "YOUR_KEY_HERE",
        "PINECONE_INDEX_NAME": "vibe-search"
      }
    }
EOF
fi

echo ""
echo "✅ Configuration file location:"
echo "   $CLAUDE_CONFIG_FILE"
echo ""
echo "📋 Next steps:"
echo "   1. Edit the config file to add your API keys"
echo "   2. Restart Claude Desktop"
echo "   3. The tools should appear in Claude!"
echo ""
