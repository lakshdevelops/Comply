# Open Legal Compliance MCP Server

A Model Context Protocol (MCP) server that provides legal compliance analysis using free/open government APIs. This server enables AI assistants to search and analyze legal documents from multiple jurisdictions including US federal law, state law, case law, EU regulations, and more.

**📖 Quick Links**:
- [Installation Guide](#installation) - Get started in 3 steps
- [MCP Setup Guide](MCP_SETUP.md) - Configure with Cursor IDE or Claude Desktop
- [API Key Setup](#api-key-setup) - Get your free API keys
- [Available Tools](#available-tools) - See what this server can do

## Features

- **US Federal Law**: Search United States Code (USC) and Code of Federal Regulations (CFR) via GovInfo API
- **US Case Law**: Search federal and state court decisions via CourtListener API
- **EU Regulations**: Search EU regulations (GDPR, AI Act, etc.) via EUR-Lex scraping
- **State Law**: Scrape state codes for CA, NY, and IL
- **Congress Bills**: Search US Congress bills and legislation via Congress.gov API
- **Federal Register**: Search daily federal government publications
- **SEC Filings**: Access corporate financial filings via SEC EDGAR
- **Open States**: Search legislation across all 50 US states
- **UK Legislation**: Search United Kingdom Acts and Statutory Instruments
- **Canadian Law**: Search Canadian case law via CanLII
- **FDA Data**: Search drug/device adverse events and food enforcement reports
- **Data.gov**: Discover US government open datasets

## Prerequisites

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **API Keys** (see detailed setup instructions below)

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/TCoder920x/open-legal-compliance-mcp.git
cd open-legal-compliance-mcp
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- `@modelcontextprotocol/sdk` - MCP SDK
- `axios` - HTTP client
- `cheerio` - HTML parsing
- `playwright` - Web scraping
- `pdf-parse` - PDF parsing
- And other dependencies

### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## API Key Setup

The following API keys are required or optional depending on which features you want to use:

### Required API Keys

#### 1. GovInfo API Key (REQUIRED)

**Why**: Required for US Code and CFR searches. The server will not start without this key.

**Steps to obtain**:
1. Visit [https://api.govinfo.gov/](https://api.govinfo.gov/)
2. Click "Sign Up" or "Get API Key"
3. Fill out the registration form (free registration)
4. Verify your email address
5. Log in and navigate to your API key dashboard
6. Copy your API key

**Registration Link**: [https://api.govinfo.gov/](https://api.govinfo.gov/)

### Optional API Keys

#### 2. CourtListener API Key (Optional)

**Why**: Enables US case law searches. Without this key, case law features will be unavailable.

**Steps to obtain**:
1. Visit [https://www.courtlistener.com/api/](https://www.courtlistener.com/api/)
2. Click "Register for an API Key" or "Sign Up"
3. Create a free account (Free Law Project)
4. After registration, go to your account settings
5. Navigate to "API" section
6. Generate or copy your API token

**Registration Link**: [https://www.courtlistener.com/api/](https://www.courtlistener.com/api/)

#### 3. Congress.gov API Key (Optional)

**Why**: Enables searching US Congress bills and legislation.

**Steps to obtain**:
1. Visit [https://api.congress.gov/](https://api.congress.gov/)
2. Click "Get API Key" or "Sign Up"
3. Fill out the registration form
4. Verify your email
5. Log in and access your API key from the dashboard

**Registration Link**: [https://api.congress.gov/](https://api.congress.gov/)

#### 4. Open States API Key (Optional)

**Why**: Enables searching legislation across all 50 US states.

**Steps to obtain**:
1. Visit [https://openstates.org/](https://openstates.org/)
2. Click "Get API Key" or navigate to API documentation
3. Sign up for a free account
4. Access your API key from your account dashboard

**Registration Link**: [https://openstates.org/](https://openstates.org/)

#### 5. CanLII API Key (Optional)

**Why**: Enables searching Canadian case law.

**Steps to obtain**:
1. Visit [https://www.canlii.org/en/api/](https://www.canlii.org/en/api/)
2. Review the API documentation
3. Register for API access (if required)
4. Obtain your API key from your account

**Registration Link**: [https://www.canlii.org/en/api/](https://www.canlii.org/en/api/)

**Note**: Some services like EUR-Lex, SEC EDGAR, and UK Legislation do not require API keys and work without registration.

## Configuration

### Option 1: Environment Variables (Recommended)

Create a `.env` file in the project root directory:

```bash
touch .env
```

Add your API keys to the `.env` file:

```env
GOVINFO_API_KEY=your_govinfo_key_here
COURTLISTENER_API_KEY=your_courtlistener_key_here
CONGRESS_GOV_API_KEY=your_congress_key_here
OPEN_STATES_API_KEY=your_openstates_key_here
CANLII_API_KEY=your_canlii_key_here
```

**Important**: The `.env` file is already in `.gitignore` and will not be committed to version control.

### Option 2: MCP Client Configuration (Cursor IDE / Claude Desktop)

If you're using this as an MCP server with a client like Cursor IDE or Claude Desktop, you need to configure your MCP client to point to this server.

**📖 See the complete MCP setup guide**: [MCP_SETUP.md](MCP_SETUP.md)

**Quick Start for Cursor IDE**:

1. Find your absolute path:
   ```bash
   cd /path/to/open-legal-compliance-mcp
   pwd
   ```

2. Edit `~/.cursor/mcp.json` and add:
   ```json
   {
     "mcpServers": {
       "open-legal-compliance-mcp": {
         "command": "node",
         "args": [
           "/absolute/path/from/step1/dist/index.js"
         ],
         "env": {
           "GOVINFO_API_KEY": "your_actual_key_here",
           "COURTLISTENER_API_KEY": "your_actual_key_here",
           "CONGRESS_GOV_API_KEY": "your_actual_key_here",
           "OPEN_STATES_API_KEY": "your_actual_key_here",
           "CANLII_API_KEY": "your_actual_key_here"
         }
       }
     }
   }
   ```

3. Restart Cursor IDE

**For Claude Desktop and detailed troubleshooting**, see [MCP_SETUP.md](MCP_SETUP.md).

## Running the Server

### Development Mode

For development with auto-rebuild on file changes:

```bash
npm run dev
```

### Production Mode

1. Build the project (if not already built):
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

The server will start and listen for MCP protocol messages via stdio.

## Usage

### As an MCP Server

This server is designed to work with MCP-compatible clients such as:
- Claude Desktop
- Cursor IDE
- Other MCP-compatible applications

Configure your MCP client to use this server by pointing to the compiled `dist/index.js` file and providing the necessary environment variables or configuration.

### Available Tools

Once connected, the following tools are available:

#### Federal Law
- `search_us_code`: Search US Code by query and optional title
- `search_cfr`: Search Code of Federal Regulations
- `search_federal_register`: Search Federal Register documents
- `search_congress_bills`: Search US Congress bills

#### Case Law
- `search_case_law`: Search US case law via CourtListener
- `search_canlii_cases`: Search Canadian case law via CanLII

#### State Law
- `search_state_law`: Scrape specific state codes (CA, NY, IL)
- `search_open_states`: Search legislation across all 50 states

#### International Law
- `search_eu_regulations`: Search EU regulations (EUR-Lex)
- `search_uk_legislation`: Search UK legislation

#### Regulatory & Corporate
- `get_sec_filings`: Get SEC filings for a company
- `search_fda_events`: Search FDA adverse events and enforcement reports
- `search_data_gov`: Search Data.gov catalog

## Project Structure

```
legal-compliance-mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── services/             # Service classes for each data source
│   │   ├── GovInfoService.ts
│   │   ├── CourtListenerService.ts
│   │   ├── EURexService.ts
│   │   └── ...
│   └── utils/
│       └── httpClient.ts     # Centralized HTTP client
├── dist/                     # Compiled JavaScript (generated)
├── mcp/
│   └── antigravity_config.json.example  # Example MCP config
├── .env                      # Your API keys (not in git)
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Server won't start

- **Error**: "GOVINFO_API_KEY environment variable is required"
  - **Solution**: Ensure you've set `GOVINFO_API_KEY` in your `.env` file or MCP config

### API requests failing

- **Check**: Verify your API keys are correct and not expired
- **Check**: Some APIs have rate limits - wait a moment and try again
- **Check**: Ensure you have internet connectivity

### Build errors

- **Error**: TypeScript compilation errors
  - **Solution**: Run `npm install` to ensure all dependencies are installed
  - **Solution**: Check that you're using Node.js v16 or higher

### MCP client connection issues

- **Check**: Verify the path to `dist/index.js` in your MCP config is correct
- **Check**: Ensure the project has been built (`npm run build`)
- **Check**: Verify all required environment variables are set in your MCP config

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

TCoder920

## Support

For issues, questions, or contributions, please open an issue on the [GitHub repository](https://github.com/TCoder920x/open-legal-compliance-mcp).
