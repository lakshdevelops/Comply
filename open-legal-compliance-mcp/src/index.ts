import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { GovInfoService } from './services/GovInfoService.js';
import { CourtListenerService } from './services/CourtListenerService.js';
import { EURexService } from './services/EURexService.js';
import { StateScraperService } from './services/StateScraperService.js';
import { CongressGovService } from './services/CongressGovService.js';
import { FederalRegisterService } from './services/FederalRegisterService.js';
import { SECEdgarService } from './services/SECEdgarService.js';
import { OpenStatesService } from './services/OpenStatesService.js';
import { UKLegislationService } from './services/UKLegislationService.js';
import { CanLIIService } from './services/CanLIIService.js';
import { FDAService } from './services/FDAService.js';
import { DataGovService } from './services/DataGovService.js';

dotenv.config();

const GOVINFO_API_KEY = process.env.GOVINFO_API_KEY;
const COURTLISTENER_API_KEY = process.env.COURTLISTENER_API_KEY;
const CONGRESS_GOV_API_KEY = process.env.CONGRESS_GOV_API_KEY;
const OPEN_STATES_API_KEY = process.env.OPEN_STATES_API_KEY;
const CANLII_API_KEY = process.env.CANLII_API_KEY;

if (!GOVINFO_API_KEY) {
  console.error('Error: GOVINFO_API_KEY environment variable is required');
  process.exit(1);
}

// Services requiring keys
const govInfoService = new GovInfoService(GOVINFO_API_KEY);
const courtListenerService = COURTLISTENER_API_KEY ? new CourtListenerService(COURTLISTENER_API_KEY) : null;
const congressGovService = CONGRESS_GOV_API_KEY ? new CongressGovService(CONGRESS_GOV_API_KEY) : null;
const openStatesService = OPEN_STATES_API_KEY ? new OpenStatesService(OPEN_STATES_API_KEY) : null;
const canliiService = CANLII_API_KEY ? new CanLIIService(CANLII_API_KEY) : null;

// Services NOT requiring keys
const euRexService = new EURexService();
const stateScraperService = new StateScraperService();
const federalRegisterService = new FederalRegisterService();
const secEdgarService = new SECEdgarService();
const ukLegislationService = new UKLegislationService();
const fdaService = new FDAService();
const dataGovService = new DataGovService();

const server = new Server(
  {
    name: 'legal-compliance-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_us_code',
        description: 'Search US Code (Federal Law) by query and optional title',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            title: {
              type: 'string',
              description: 'Specific title to search (e.g., "Title 15")',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_cfr',
        description: 'Search Code of Federal Regulations (CFR)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            title: {
              type: 'string',
              description: 'Specific title to search',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_case_law',
        description: 'Search US Case Law via CourtListener',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            court: {
              type: 'string',
              description: 'Court ID (e.g., "scotus", "ca9")',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_eu_regulations',
        description: 'Search EU Regulations (EUR-Lex)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query or CELEX number',
            },
            language: {
              type: 'string',
              description: 'Language code (default: en)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_state_law',
        description: 'Search State Law (CA, NY, IL)',
        inputSchema: {
          type: 'object',
          properties: {
            state: {
              type: 'string',
              description: 'State code (ca, ny, il)',
              enum: ['ca', 'ny', 'il'],
            },
            query: {
              type: 'string',
              description: 'Search query',
            },
          },
          required: ['state', 'query'],
        },
      },
      // New Tools
      {
        name: 'search_congress_bills',
        description: 'Search US Congress Bills',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            congress: { type: 'number', description: 'Congress number' },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_federal_register',
        description: 'Search Federal Register Documents',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            perPage: { type: 'number', description: 'Number of results' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_sec_filings',
        description: 'Get SEC Filings for a Company (by CIK)',
        inputSchema: {
          type: 'object',
          properties: {
            cik: { type: 'string', description: 'Central Index Key (10 digits)' },
          },
          required: ['cik'],
        },
      },
      {
        name: 'search_open_states',
        description: 'Search State Legislation (All 50 States)',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            jurisdiction: { type: 'string', description: 'State abbreviation (e.g., "ca")' },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_uk_legislation',
        description: 'Search UK Legislation',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_canlii_cases',
        description: 'Search Canadian Case Law (CanLII)',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            databaseId: { type: 'string', description: 'Database ID (default: csc-scc)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_fda_events',
        description: 'Search FDA Adverse Events (Drug/Device) or Food Enforcement',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['drug', 'device', 'food'], description: 'Type of search' },
            query: { type: 'string', description: 'Search query' },
          },
          required: ['type', 'query'],
        },
      },
      {
        name: 'search_data_gov',
        description: 'Search Data.gov Catalog',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case 'search_us_code': {
        const { query, title } = request.params.arguments as any;
        const results = await govInfoService.searchUSCode(query, title);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'search_cfr': {
        const { query, title } = request.params.arguments as any;
        const results = await govInfoService.searchCFR(query, title);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'search_case_law': {
        if (!courtListenerService) {
          throw new Error('CourtListener API key not configured');
        }
        const { query, court } = request.params.arguments as any;
        const results = await courtListenerService.searchCaseLaw(query, court);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'search_eu_regulations': {
        const { query, language } = request.params.arguments as any;
        const results = await euRexService.searchRegulation(query);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'search_state_law': {
        const { state, query } = request.params.arguments as any;
        const results = await stateScraperService.scrapeStateLaw(state, query);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      // New Tool Handlers
      case 'search_congress_bills': {
        if (!congressGovService) throw new Error('Congress.gov API key not configured');
        const { query, congress } = request.params.arguments as any;
        const results = await congressGovService.searchBills(congress);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'search_federal_register': {
        const { query, perPage } = request.params.arguments as any;
        const results = await federalRegisterService.searchDocuments(query, { perPage });
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'get_sec_filings': {
        const { cik } = request.params.arguments as any;
        const results = await secEdgarService.getCompanySubmissions(cik);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'search_open_states': {
        if (!openStatesService) throw new Error('Open States API key not configured');
        const { query, jurisdiction } = request.params.arguments as any;
        const results = await openStatesService.searchBills(query, jurisdiction);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'search_uk_legislation': {
        const { query } = request.params.arguments as any;
        const results = await ukLegislationService.searchLegislation(query);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'search_canlii_cases': {
        if (!canliiService) throw new Error('CanLII API key not configured');
        const { query, databaseId } = request.params.arguments as any;
        const results = await canliiService.searchCases(query, databaseId);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'search_fda_events': {
        const { type, query } = request.params.arguments as any;
        let results;
        if (type === 'drug') results = await fdaService.searchDrugEvents(query);
        else if (type === 'device') results = await fdaService.searchDeviceEvents(query);
        else if (type === 'food') results = await fdaService.searchFoodEnforcement(query);
        else throw new Error('Invalid FDA search type');
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'search_data_gov': {
        const { query } = request.params.arguments as any;
        const results = await dataGovService.searchPackages(query);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
  } catch (error: any) {
    console.error('Error executing tool:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
          }),
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
