# MCP Server Setup Guide

This guide explains how to configure the Open Legal Compliance MCP Server with MCP-compatible clients like Cursor IDE or Claude Desktop.

## What is MCP?

Model Context Protocol (MCP) is a standard that allows AI assistants to interact with external tools and data sources. This server provides legal compliance tools that can be used directly within your AI assistant.

## Prerequisites

Before configuring the MCP server, ensure you have:

1. ✅ Completed the [installation steps](README.md#installation) in the main README
2. ✅ Built the project with `npm run build`
3. ✅ Obtained your API keys and configured them in `.env`

## Configuration for Different Clients

### Option 1: Cursor IDE

Cursor IDE stores MCP configuration in `~/.cursor/mcp.json`.

#### Step 1: Locate or Create the Configuration File

```bash
# Check if the file exists
ls ~/.cursor/mcp.json

# If it doesn't exist, create it
mkdir -p ~/.cursor
echo '{"mcpServers":{}}' > ~/.cursor/mcp.json
```

#### Step 2: Add the Server Configuration

Edit `~/.cursor/mcp.json` and add the following configuration:

```json
{
  "mcpServers": {
    "open-legal-compliance-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/your/legal_compliance_app/dist/index.js"
      ],
      "env": {
        "GOVINFO_API_KEY": "your_govinfo_key_here",
        "COURTLISTENER_API_KEY": "your_courtlistener_key_here",
        "CONGRESS_GOV_API_KEY": "your_congress_key_here",
        "OPEN_STATES_API_KEY": "your_openstates_key_here",
        "CANLII_API_KEY": "your_canlii_key_here"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/your/legal_compliance_app` with the actual absolute path where you cloned the repository.

#### Step 3: Find Your Absolute Path

```bash
cd /path/to/legal_compliance_app
pwd
```

Copy the output and use it in the configuration above.

#### Step 4: Restart Cursor

After saving the configuration file, restart Cursor IDE for the changes to take effect.

### Option 2: Claude Desktop

Claude Desktop stores MCP configuration in a different location depending on your operating system.

#### macOS

Configuration file location: `~/Library/Application Support/Claude/claude_desktop_config.json`

```bash
# Create the directory if it doesn't exist
mkdir -p ~/Library/Application\ Support/Claude

# Edit the configuration file
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add this configuration:

```json
{
  "mcpServers": {
    "open-legal-compliance-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/your/legal_compliance_app/dist/index.js"
      ],
      "env": {
        "GOVINFO_API_KEY": "your_govinfo_key_here",
        "COURTLISTENER_API_KEY": "your_courtlistener_key_here",
        "CONGRESS_GOV_API_KEY": "your_congress_key_here",
        "OPEN_STATES_API_KEY": "your_openstates_key_here",
        "CANLII_API_KEY": "your_canlii_key_here"
      }
    }
  }
}
```

#### Windows

Configuration file location: `%APPDATA%\Claude\claude_desktop_config.json`

#### Linux

Configuration file location: `~/.config/Claude/claude_desktop_config.json`

## Configuration Examples

### Example 1: Minimal Configuration (GovInfo only)

If you only want to use US federal law features:

```json
{
  "mcpServers": {
    "open-legal-compliance-mcp": {
      "command": "node",
      "args": [
        "/Users/yourname/Projects/legal_compliance_app/dist/index.js"
      ],
      "env": {
        "GOVINFO_API_KEY": "your_govinfo_key_here"
      }
    }
  }
}
```

### Example 2: Full Configuration

For all features:

```json
{
  "mcpServers": {
    "open-legal-compliance-mcp": {
      "command": "node",
      "args": [
        "/Users/yourname/Projects/legal_compliance_app/dist/index.js"
      ],
      "env": {
        "GOVINFO_API_KEY": "S1mBBDIL0tVD1biUc9R6LCdqShnwLzhy6ttGzak4",
        "COURTLISTENER_API_KEY": "8b0d27afcc08f8d96cb5ec646ab9acd217bbf2c4",
        "CONGRESS_GOV_API_KEY": "6vsTatAhpbwSMdvXRy5rvchFn4Iz093EVaqurCfq",
        "OPEN_STATES_API_KEY": "c3cd8b76-0af0-41ee-86f3-f6283784d423",
        "CANLII_API_KEY": ""
      }
    }
  }
}
```

## Troubleshooting

### Error: "Cannot find module"

```
Error: Cannot find module '/path/to/legal-compliance-mcp.js'
```

**Solution**: 
1. Verify the path in your MCP config points to `dist/index.js` (not `.js`)
2. Ensure you've run `npm run build` in the project directory
3. Use an absolute path, not a relative path
4. Check that the file exists: `ls /path/to/your/legal_compliance_app/dist/index.js`

### Error: "GOVINFO_API_KEY environment variable is required"

**Solution**: Add your GovInfo API key to the `env` section of your MCP configuration.

### Server Not Appearing in Client

**Solution**:
1. Restart your MCP client (Cursor or Claude Desktop)
2. Check the MCP logs for errors
3. Verify your JSON syntax is valid (use a JSON validator)

### How to View MCP Logs

#### Cursor IDE

MCP logs are available in the Cursor IDE output panel:
1. Open Command Palette (Cmd+Shift+P or Ctrl+Shift+P)
2. Search for "MCP: Show Logs"
3. Look for errors related to `open-legal-compliance-mcp`

#### Claude Desktop

Logs are typically in:
- macOS: `~/Library/Logs/Claude/`
- Windows: `%APPDATA%\Claude\logs\`
- Linux: `~/.config/Claude/logs/`

## Verifying the Setup

Once configured, you should be able to use the following tools in your AI assistant:

- `search_us_code` - Search US Code
- `search_cfr` - Search Code of Federal Regulations
- `search_case_law` - Search US case law
- `search_eu_regulations` - Search EU regulations
- And many more (see [README.md](README.md#available-tools))

Try asking your AI assistant:
> "Search the US Code for privacy laws"

If the server is configured correctly, it will use the `search_us_code` tool to perform the search.

## Alternative: Using .env File

Instead of putting API keys directly in the MCP config, you can use the `.env` file in the project directory. The server will automatically load environment variables from `.env`.

**MCP Configuration (without API keys)**:
```json
{
  "mcpServers": {
    "open-legal-compliance-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/your/legal_compliance_app/dist/index.js"
      ]
    }
  }
}
```

**Note**: When using this approach, the server will read API keys from the `.env` file in the project directory. Make sure the `.env` file exists and contains your keys.

## Security Best Practices

1. ✅ Never commit your MCP configuration files with real API keys to version control
2. ✅ Use absolute paths in MCP configuration
3. ✅ Keep your API keys secure and rotate them periodically
4. ✅ The `.env` file in the project directory is gitignored by default

## Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review the MCP logs for error messages
3. Verify all prerequisites are met
4. Open an issue on [GitHub](https://github.com/TCoder920x/open-legal-compliance-mcp/issues)

## Additional Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Cursor IDE Documentation](https://docs.cursor.com/)
- [Claude Desktop Documentation](https://claude.ai/docs)
