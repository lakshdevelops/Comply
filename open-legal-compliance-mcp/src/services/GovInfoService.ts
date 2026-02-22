import { createHttpClient } from '../utils/httpClient.js';
import * as cheerio from 'cheerio';

export interface USCodeResult {
  title: string;
  section: string;
  text: string;
  url: string;
  lastModified?: string;
}

export interface CFRResult {
  title: string;
  part: string;
  section: string;
  text: string;
  url: string;
  lastModified?: string;
}

export class GovInfoService {
  private client;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GovInfo API key is required');
    }
    this.apiKey = apiKey;
    this.client = createHttpClient('https://api.govinfo.gov');
  }

  /**
   * Search US Code by query and optional title using GovInfo Search Service
   * Note: GovInfo Search Service does not properly index USCODE content.
   * Falls back to searching known relevant titles when search endpoint fails.
   */
  async searchUSCode(query: string, title?: string): Promise<USCodeResult[]> {
    try {
      const results: USCodeResult[] = [];
      
      // Build search query - if title specified, add it to the query
      let searchQuery = query;
      if (title) {
        const titleNum = title.replace(/[^0-9]/g, '');
        searchQuery = `${query} title:${titleNum}`;
      }

      // Try GovInfo Search Service (POST endpoint)
      // Note: This endpoint has known issues - USCODE collection is not properly indexed
      // The API returns results from other collections (CPD) even when USCODE is specified
      let searchAttempted = false;
      try {
        const searchResponse = await this.client.post('/search', {
          collection: 'USCODE',
          q: searchQuery,
          pageSize: 20,
          offsetMark: '*',
        }, {
          params: { 'api_key': this.apiKey },
      });

        searchAttempted = true;

        // Filter results to only USCODE collection (API may return mixed results)
        const uscodeResults = (searchResponse.data?.results || []).filter(
          (result: any) => result.collectionCode === 'USCODE'
        );

        // If we got results but none are USCODE, the search endpoint is broken - use fallback
        if (searchResponse.data?.results?.length > 0 && uscodeResults.length === 0) {
          // Search endpoint returned results but none are USCODE - known API limitation
          // Fall through to enhanced fallback
        } else {
          // Fetch full text for each matching granule
          for (const result of uscodeResults) {
            try {
              const packageId = result.packageId;
              const granuleId = result.granuleId;

              if (!packageId || !granuleId) continue;

              // Fetch granule summary for metadata
              const granuleResponse = await this.client.get(
                `/packages/${packageId}/granules/${granuleId}/summary`,
                {
                  params: { 'api_key': this.apiKey },
                }
              );

              // Extract title number from packageId (USCODE-2021-title15 -> Title 15)
              const titleMatch = packageId.match(/title(\d+)/);
              const titleNumber = titleMatch ? `Title ${titleMatch[1]}` : 'Unknown Title';

              // Get package summary for title name
              let titleName = titleNumber;
              try {
                const packageResponse = await this.client.get(`/packages/${packageId}/summary`, {
            params: { 'api_key': this.apiKey },
          });
                titleName = packageResponse.data.title || titleNumber;
              } catch {
                // Use title number if package fetch fails
              }

              // Fetch HTML content and extract text
              const granuleText = await this.fetchGranuleText(packageId, granuleId);

          results.push({
                title: titleName,
                section: granuleResponse.data.title || granuleId,
                text: granuleText,
                url: granuleResponse.data.detailsLink || result.resultLink || '',
                lastModified: granuleResponse.data.lastModified || result.lastModified,
              });

              // Limit to 20 results to respect rate limits
              if (results.length >= 20) break;
            } catch (granuleError) {
              // Skip granules that fail to fetch
              continue;
            }
          }
        }
      } catch (searchError) {
        // Search endpoint failed - will use fallback
        searchAttempted = true;
      }

      // If no results from search endpoint (either failed or returned wrong collection), use enhanced fallback
      if (results.length === 0) {
        return await this.searchUSCodeWithFallback(query, title);
      }

      return results;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid GovInfo API key');
      }
      // Final fallback
      return await this.searchUSCodeWithFallback(query, title);
    }
  }

  /**
   * Enhanced fallback: Search relevant US Code titles based on query
   * Intelligently selects titles to search based on query keywords
   */
  private async searchUSCodeWithFallback(query: string, title?: string): Promise<USCodeResult[]> {
    // If specific title provided, use title-specific search
    if (title) {
      return await this.searchUSCodeByTitle(query, title);
    }

    const results: USCodeResult[] = [];
    const queryLower = query.toLowerCase();

    // Map of all 54 US Code titles with keywords for intelligent selection
    const allTitles: Array<{ num: string; name: string; keywords: string[] }> = [
      { num: '1', name: 'GENERAL PROVISIONS', keywords: ['general', 'provisions'] },
      { num: '2', name: 'THE CONGRESS', keywords: ['congress', 'legislative'] },
      { num: '3', name: 'THE PRESIDENT', keywords: ['president', 'executive'] },
      { num: '4', name: 'FLAG AND SEAL, SEAT OF GOVERNMENT, AND THE STATES', keywords: ['flag', 'states'] },
      { num: '5', name: 'GOVERNMENT ORGANIZATION AND EMPLOYEES', keywords: ['government', 'employees', 'privacy', 'federal', 'agency'] },
      { num: '6', name: 'DOMESTIC SECURITY', keywords: ['security', 'homeland', 'terrorism'] },
      { num: '7', name: 'AGRICULTURE', keywords: ['agriculture', 'farming', 'food'] },
      { num: '8', name: 'ALIENS AND NATIONALITY', keywords: ['immigration', 'aliens', 'citizenship'] },
      { num: '9', name: 'ARBITRATION', keywords: ['arbitration', 'dispute'] },
      { num: '10', name: 'ARMED FORCES', keywords: ['military', 'defense', 'armed forces'] },
      { num: '11', name: 'BANKRUPTCY', keywords: ['bankruptcy', 'insolvency'] },
      { num: '12', name: 'BANKS AND BANKING', keywords: ['banking', 'banks', 'financial'] },
      { num: '13', name: 'CENSUS', keywords: ['census', 'population'] },
      { num: '14', name: 'COAST GUARD', keywords: ['coast guard', 'maritime'] },
      { num: '15', name: 'COMMERCE AND TRADE', keywords: ['commerce', 'trade', 'business', 'consumer', 'privacy', 'data', 'credit', 'financial', 'coppa', 'glba', 'fcra', 'artificial intelligence', 'ai', 'machine learning'] },
      { num: '16', name: 'CONSERVATION', keywords: ['conservation', 'environment'] },
      { num: '17', name: 'COPYRIGHTS', keywords: ['copyright', 'intellectual property', 'ip'] },
      { num: '18', name: 'CRIMES AND CRIMINAL PROCEDURE', keywords: ['crime', 'criminal', 'privacy', 'wiretap', 'ecpa', 'dppa'] },
      { num: '19', name: 'CUSTOMS DUTIES', keywords: ['customs', 'duties', 'tariff'] },
      { num: '20', name: 'EDUCATION', keywords: ['education', 'school', 'ferpa', 'student'] },
      { num: '21', name: 'FOOD AND DRUGS', keywords: ['food', 'drug', 'fda'] },
      { num: '22', name: 'FOREIGN RELATIONS AND INTERCOURSE', keywords: ['foreign', 'diplomatic'] },
      { num: '23', name: 'HIGHWAYS', keywords: ['highway', 'transportation'] },
      { num: '24', name: 'HOSPITALS AND ASYLUMS', keywords: ['hospital', 'asylum'] },
      { num: '25', name: 'INDIANS', keywords: ['indian', 'tribal', 'native'] },
      { num: '26', name: 'INTERNAL REVENUE CODE', keywords: ['tax', 'revenue', 'irs'] },
      { num: '27', name: 'INTOXICATING LIQUORS', keywords: ['alcohol', 'liquor'] },
      { num: '28', name: 'JUDICIARY AND JUDICIAL PROCEDURE', keywords: ['judiciary', 'court', 'judicial'] },
      { num: '29', name: 'LABOR', keywords: ['labor', 'employment', 'work'] },
      { num: '30', name: 'MINERAL LANDS AND MINING', keywords: ['mining', 'mineral'] },
      { num: '31', name: 'MONEY AND FINANCE', keywords: ['money', 'finance', 'treasury'] },
      { num: '32', name: 'NATIONAL GUARD', keywords: ['national guard', 'militia'] },
      { num: '33', name: 'NAVIGATION AND NAVIGABLE WATERS', keywords: ['navigation', 'water', 'maritime'] },
      { num: '34', name: 'NAVY', keywords: ['navy', 'naval'] },
      { num: '35', name: 'PATENTS', keywords: ['patent', 'invention'] },
      { num: '36', name: 'PATRIOTIC AND NATIONAL OBSERVANCES, CEREMONIES, AND ORGANIZATIONS', keywords: ['patriotic', 'observance'] },
      { num: '37', name: 'PAY AND ALLOWANCES OF THE UNIFORMED SERVICES', keywords: ['pay', 'military pay'] },
      { num: '38', name: 'VETERANS BENEFITS', keywords: ['veteran', 'benefits'] },
      { num: '39', name: 'POSTAL SERVICE', keywords: ['postal', 'mail'] },
      { num: '40', name: 'PUBLIC BUILDINGS, PROPERTY, AND WORKS', keywords: ['public building', 'property'] },
      { num: '41', name: 'PUBLIC CONTRACTS', keywords: ['contract', 'procurement'] },
      { num: '42', name: 'THE PUBLIC HEALTH AND WELFARE', keywords: ['health', 'welfare', 'hipaa', 'medical', 'privacy'] },
      { num: '43', name: 'PUBLIC LANDS', keywords: ['public land', 'land'] },
      { num: '44', name: 'PUBLIC PRINTING AND DOCUMENTS', keywords: ['printing', 'document'] },
      { num: '45', name: 'RAILROADS', keywords: ['railroad', 'rail'] },
      { num: '46', name: 'SHIPPING', keywords: ['shipping', 'vessel'] },
      { num: '47', name: 'TELECOMMUNICATIONS', keywords: ['telecommunications', 'communication', 'fcc', 'technology', 'artificial intelligence', 'ai'] },
      { num: '48', name: 'TERRITORIES AND INSULAR POSSESSIONS', keywords: ['territory', 'island'] },
      { num: '49', name: 'TRANSPORTATION', keywords: ['transportation', 'transit'] },
      { num: '50', name: 'WAR AND NATIONAL DEFENSE', keywords: ['war', 'defense', 'national security', 'artificial intelligence', 'ai', 'technology'] },
      { num: '51', name: 'NATIONAL AND COMMERCIAL SPACE PROGRAMS', keywords: ['space', 'nasa'] },
      { num: '52', name: 'VOTING AND ELECTIONS', keywords: ['voting', 'election'] },
      { num: '53', name: 'SMALL BUSINESS', keywords: ['small business', 'sba'] },
      { num: '54', name: 'NATIONAL PARK SERVICE AND RELATED PROGRAMS', keywords: ['park', 'national park'] },
    ];

    // Select relevant titles based on query keywords
    const relevantTitles = allTitles.filter(titleInfo => {
      // Check if query contains any keywords for this title
      return titleInfo.keywords.some(keyword => queryLower.includes(keyword)) ||
             titleInfo.name.toLowerCase().includes(queryLower);
    });

    // If no keyword matches found, explicitly indicate no relevant content
    if (relevantTitles.length === 0) {
      throw new Error('No relevant US Code titles found for the query. The search query does not match any known US Code title keywords or content areas.');
    }

    // Search through relevant titles (limit to top 5 to avoid excessive API calls)
    const titlesToSearch = relevantTitles.slice(0, 5);
    
    for (const titleInfo of titlesToSearch) {
      try {
        const titleResults = await this.searchUSCodeByTitle(query, `Title ${titleInfo.num}`);
        results.push(...titleResults);

        if (results.length >= 20) break;
      } catch (error) {
        // Skip titles that fail, continue with others
        continue;
      }
    }

    return results;
  }

  /**
   * Fallback: Search specific US Code title by querying its granules
   */
  private async searchUSCodeByTitle(query: string, title: string): Promise<USCodeResult[]> {
    const results: USCodeResult[] = [];
    const titleNum = title.replace(/[^0-9]/g, '');
    const packageId = `USCODE-2021-title${titleNum}`;

    try {
      const packageResponse = await this.client.get(`/packages/${packageId}/summary`, {
        params: { 'api_key': this.apiKey },
      });

      const granulesResponse = await this.client.get(`/packages/${packageId}/granules`, {
        params: {
          'api_key': this.apiKey,
          'offsetMark': '*',
          'pageSize': '100',
        },
      });

      if (granulesResponse.data?.granules) {
        const queryLower = query.toLowerCase();
        // First pass: check granule titles to filter candidates
        const candidateGranules = granulesResponse.data.granules.filter((granule: any) => {
          const granuleTitle = granule.title || granule.granuleId || '';
          return granuleTitle.toLowerCase().includes(queryLower);
        });

        // If no title matches, check first 20 granules by fetching summaries
        const granulesToCheck = candidateGranules.length > 0 
          ? candidateGranules.slice(0, 20)
          : granulesResponse.data.granules.slice(0, 20);

        for (const granule of granulesToCheck) {
          try {
            const granuleResponse = await this.client.get(
              `/packages/${packageId}/granules/${granule.granuleId}/summary`,
              { params: { 'api_key': this.apiKey } }
            );

            const granuleTitle = granuleResponse.data.title || granule.granuleId;
            
            // Only fetch HTML if title matches or we haven't found many results yet
            let granuleText = '';
            if (granuleTitle.toLowerCase().includes(queryLower) || results.length < 5) {
              granuleText = await this.fetchGranuleText(packageId, granule.granuleId);
            } else {
              // Skip HTML fetch for non-matching titles if we already have results
              continue;
            }
            
            if (
              granuleText.toLowerCase().includes(queryLower) ||
              granuleTitle.toLowerCase().includes(queryLower)
            ) {
              results.push({
                title: packageResponse.data.title || 'Unknown',
                section: granuleTitle,
                text: granuleText || 'Text content not available',
                url: granuleResponse.data.detailsLink || packageResponse.data.detailsLink || '',
                lastModified: granuleResponse.data.lastModified || packageResponse.data.lastModified,
              });

              if (results.length >= 20) break;
            }
          } catch {
            continue;
          }
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Title ${title} not found in US Code`);
      }
      throw error;
    }

    return results;
  }

  /**
   * Search Code of Federal Regulations using GovInfo Search Service
   * Performs full-text search across all CFR titles
   */
  async searchCFR(query: string, title?: string): Promise<CFRResult[]> {
    try {
      const results: CFRResult[] = [];

      // Build search query - if title specified, add it to the query
      let searchQuery = query;
      if (title) {
        const titleNum = title.replace(/[^0-9]/g, '');
        searchQuery = `${query} title:${titleNum}`;
      }

      // Use GovInfo Search Service (POST endpoint)
      const searchResponse = await this.client.post(
        '/search',
        {
          collection: 'CFR',
          q: searchQuery,
          pageSize: 20,
          offsetMark: '*',
        },
        {
          params: { 'api_key': this.apiKey },
        }
      );

      // Filter results to only CFR collection
      const cfrResults = (searchResponse.data?.results || []).filter(
        (result: any) => result.collectionCode === 'CFR'
      );

      // Fetch full text for each matching granule
      for (const result of cfrResults) {
        try {
          const packageId = result.packageId;
          const granuleId = result.granuleId;

          if (!packageId || !granuleId) continue;

          // Fetch granule summary for full text
          const granuleResponse = await this.client.get(
            `/packages/${packageId}/granules/${granuleId}/summary`,
            {
              params: { 'api_key': this.apiKey },
            }
          );

          // Extract part number from packageId (CFR-2024-title45-part160 -> 160)
          const partMatch = packageId.match(/part(\d+)/);
          const part = partMatch ? partMatch[1] : '';

          // Get package summary for title name
          let titleName = 'Unknown';
          try {
            const packageResponse = await this.client.get(`/packages/${packageId}/summary`, {
            params: { 'api_key': this.apiKey },
          });
            titleName = packageResponse.data.title || 'Unknown';
          } catch {
            // Use default if package fetch fails
          }

          const granuleText = this.extractText(granuleResponse.data);

          results.push({
            title: titleName,
            part: part,
            section: granuleResponse.data.title || granuleId,
            text: granuleText,
            url: granuleResponse.data.detailsLink || result.resultLink || '',
            lastModified: granuleResponse.data.lastModified || result.lastModified,
          });

          // Limit to 20 results to respect rate limits
          if (results.length >= 20) break;
        } catch (granuleError) {
          // Skip granules that fail to fetch
          continue;
        }
      }

      return results;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid GovInfo API key');
      }
      throw new Error(`Failed to search CFR: ${error.message}`);
    }
  }

  /**
   * Fetch HTML content from granule and extract text
   */
  private async fetchGranuleText(packageId: string, granuleId: string): Promise<string> {
    try {
      const htmlResponse = await this.client.get(
        `/packages/${packageId}/granules/${granuleId}/htm`,
        {
          params: { 'api_key': this.apiKey },
          responseType: 'text',
        }
      );

      const $ = cheerio.load(htmlResponse.data);
      
      // Remove script, style, and other non-content elements
      $('script, style, noscript, .analysis, .note-head, .miscellaneous-note').remove();
      
      // Extract text from body
      const text = $('body').text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limit to 5000 characters
      
      return text || 'Text content not available';
    } catch (error) {
      // Fallback to summary if HTML fetch fails
      try {
        const summaryResponse = await this.client.get(
          `/packages/${packageId}/granules/${granuleId}/summary`,
          { params: { 'api_key': this.apiKey } }
        );
        return this.extractText(summaryResponse.data);
      } catch {
        return 'Text content not available';
      }
    }
  }

  /**
   * Extract text content from GovInfo response
   */
  private extractText(data: any): string {
    if (data.text) return data.text;
    if (data.summary) return data.summary;
    if (data.description) return data.description;
    return 'Text content not available';
  }
}

