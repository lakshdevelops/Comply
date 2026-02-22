import { createHttpClient } from '../utils/httpClient.js';

export interface CaseLawResult {
  id: number;
  title: string;
  court: string;
  dateFiled: string;
  citation: string;
  summary: string;
  url: string;
  precedentialStatus?: string;
}

export class CourtListenerService {
  private client;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
    // CourtListener requires V4 API for new users (V3 is deprecated)
    this.client = createHttpClient('https://www.courtlistener.com/api/rest/v4');
  }

  /**
   * Search case law by query and optional court filter
   * Respects rate limits - uses on-demand search only
   * Requires CourtListener API key (free registration at https://www.courtlistener.com/api/)
   */
  async searchCaseLaw(query: string, court?: string): Promise<CaseLawResult[]> {
    try {
      if (!this.apiKey) {
        throw new Error(
          'CourtListener API key is required. ' +
          'Get a free API key at https://www.courtlistener.com/api/ ' +
          'and set COURTLISTENER_API_KEY environment variable.'
        );
      }

      // V4 API uses 'q' parameter instead of 'search'
      const params: Record<string, string> = {
        'q': query,
        'ordering': '-date_filed',
        'page_size': '10', // Limit to respect rate limits
      };

      if (court) {
        params['court'] = court;
      }

      const headers: Record<string, string> = {
        'Authorization': `Token ${this.apiKey}`,
      };

      const response = await this.client.get('/search/', {
        params,
        headers,
      });

      const results: CaseLawResult[] = [];

      if (response.data?.results) {
        for (const caseData of response.data.results) {
          // V4 API response structure
          const opinion = caseData.opinions?.[0] || {};
          const snippet = opinion.snippet || '';
          
          results.push({
            id: caseData.cluster_id || caseData.id || 0,
            title: caseData.caseName || caseData.case_name || 'Unknown Case',
            court: caseData.court || 'Unknown Court',
            dateFiled: caseData.dateFiled || caseData.date_filed || '',
            citation: this.formatCitation(caseData),
            summary: snippet.substring(0, 500) || caseData.snippet || 'No summary available',
            url: `https://www.courtlistener.com${caseData.absolute_url || ''}`,
            precedentialStatus: caseData.status || caseData.precedential_status || 'Unknown',
          });
        }
      }

      return results;
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error(
          'CourtListener API authentication failed. ' +
          'Please verify your API key is correct. ' +
          'Get a free API key at https://www.courtlistener.com/api/'
        );
      }
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please wait before making another request.');
      }
      throw new Error(`Failed to search case law: ${error.message}`);
    }
  }

  /**
   * Format citation from case data
   * V4 API uses 'citation' array and 'citeCount' field
   */
  private formatCitation(caseData: any): string {
    // V4 API: citation is an array, citeCount is the count
    if (caseData.citation && Array.isArray(caseData.citation) && caseData.citation.length > 0) {
      return caseData.citation.join(', ');
    }
    if (caseData.citation && typeof caseData.citation === 'string') {
      return caseData.citation;
    }
    if (caseData.citeCount > 0) {
      return `${caseData.citeCount} citations`;
    }
    if (caseData.citation_count > 0) {
      return `${caseData.citation_count} citations`;
    }
    return 'No citation available';
  }
}

