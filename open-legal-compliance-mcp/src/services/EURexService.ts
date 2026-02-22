import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

export interface EURegulationResult {
  celexNumber: string;
  title: string;
  type: string;
  date: string;
  text: string;
  url: string;
}

export class EURexService {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService();
  }

  /**
   * Search EU regulations by query
   * Supports GDPR, AI Act, MiCA, and other EU regulations
   */
  async searchRegulation(query: string, regulationId?: string): Promise<EURegulationResult[]> {
    let browser: Browser | null = null;
    try {
      const results: EURegulationResult[] = [];

      // Launch browser with stealthier args
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars'
        ]
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        locale: 'en-US',
        timezoneId: 'UTC'
      });

      const page = await context.newPage();

      if (regulationId) {
        // Direct lookup by CELEX number or regulation ID
        const result = await this.getRegulationById(page, regulationId);
        if (result) {
          results.push(result);
        }
      } else {
        // Search via EUR-Lex search API
        const searchUrl = this.buildSearchUrl(query);
        const fullSearchUrl = `https://eur-lex.europa.eu${searchUrl}`;

        console.log(`Navigating to search URL: ${fullSearchUrl}`);
        await page.goto(fullSearchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        // Get page content
        const content = await page.content();

        // Parse HTML response to extract regulation links
        const regulations = this.parseSearchResults(content);
        console.log(`Found ${regulations.length} potential regulations`);

        for (const reg of regulations.slice(0, 5)) { // Limit to 5 for performance
          console.log(`Fetching details for: ${reg.url}`);
          const detail = await this.getRegulationDetails(page, reg.url);
          if (detail) {
            results.push(detail);
          }
          // Small delay to be nice
          await page.waitForTimeout(1000);
        }
      }

      return results;
    } catch (error: any) {
      throw new Error(`Failed to search EU regulations: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Get regulation by CELEX number or regulation ID
   */
  async getRegulationById(page: any, regulationId: string): Promise<EURegulationResult | null> {
    try {
      // Common regulation IDs
      const knownRegulations: Record<string, string> = {
        'gdpr': '32016R0679',
        'ai-act': '32024R1689',
        'mica': '32023R1114',
      };

      const celex = knownRegulations[regulationId.toLowerCase()] || regulationId;
      const url = `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`;

      return await this.getRegulationDetails(page, url);
    } catch (error: any) {
      throw new Error(`Failed to get regulation by ID: ${error.message}`);
    }
  }

  /**
   * Build search URL for EUR-Lex
   */
  private buildSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    // Updated search URL to use the standard quick search format which is more reliable
    return `/search.html?scope=EURLEX&text=${encodedQuery}&lang=en&type=quick&qid=${Date.now()}`;
  }

  /**
   * Parse search results from HTML using cheerio
   */
  private parseSearchResults(html: string): Array<{ url: string; title: string }> {
    const $ = cheerio.load(html);
    const results: Array<{ url: string; title: string }> = [];

    // Parse EUR-Lex search results
    // Updated selector to be more specific to result links
    // The browser investigation showed the structure is <h2><a class="title" ...>
    const selectors = ['h2 a.title', '.SearchResult .title a', 'a.title'];

    let found = false;
    for (const selector of selectors) {
      if (found) break;
      $(selector).each((_, element) => {
        if (results.length >= 10) return false;
        found = true;

        let href = $(element).attr('href');
        const title = $(element).text().trim();

        if (href) {
          // Fix relative URLs that might start with ./ or just /
          if (!href.startsWith('http')) {
            // Remove leading dot if present
            if (href.startsWith('.')) {
              href = href.substring(1);
            }
            // Ensure leading slash
            if (!href.startsWith('/')) {
              href = '/' + href;
            }
            href = `https://eur-lex.europa.eu${href}`;
          }

          const url = href;

          // Filter out irrelevant links
          // REMOVED 'qid=' filter as it is present in valid result URLs
          if (!url.includes('summ=') && !url.includes('AUTO_')) {
            results.push({
              url,
              title: title || 'EU Regulation',
            });
          }
        }
      });
    }

    // Deduplicate
    return results.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
  }

  /**
   * Get detailed regulation information using Playwright
   */
  private async getRegulationDetails(page: any, url: string): Promise<EURegulationResult | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Check for CloudFront error title
      const pageTitle = await page.title();
      if (pageTitle.includes('ERROR: The request could not be satisfied') || pageTitle.includes('403 Forbidden')) {
        console.error(`Blocked by EUR-Lex protection: ${url}`);
        return null;
      }

      // Wait for content to load
      try {
        await page.waitForSelector('#document-content, .document-content, .tabContent, .text', { timeout: 5000 });
      } catch (e) {
        // Continue if selector not found
      }

      const content = await page.content();
      const $ = cheerio.load(content);

      // Extract metadata
      const title = $('title').text().trim() || $('h1').first().text().trim();

      // Extract CELEX number
      let celexNumber = 'Unknown';
      const urlMatch = url.match(/CELEX:(\d{4}[A-Z]\d{4})/i);
      if (urlMatch) {
        celexNumber = urlMatch[1];
      } else {
        const metaCelex = $('meta[property="eli:id_local"]').attr('content');
        if (metaCelex) celexNumber = metaCelex;
      }

      // Extract date
      let date = 'Unknown';
      const metaDate = $('meta[property="eli:date_document"]').attr('content');
      if (metaDate) {
        date = metaDate;
      } else {
        const dateText = $('.date, .publication-date, [class*="date"]').first().text().trim();
        const dateMatch = dateText.match(/(\d{2}\/\d{2}\/\d{4})/) || dateText.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) date = dateMatch[1];
      }

      // Extract regulation text
      const regulationText: string[] = [];

      // Try multiple selectors for text content
      // Added .text and #text for better coverage
      const selectors = ['p.oj-normal', 'div.tabContent p', '#document-content p', '.text p', '#text p'];

      for (const selector of selectors) {
        if (regulationText.length > 0) break;

        $(selector).each((_, element) => {
          const text = $(element).text().trim();
          if (text && text.length > 20 && !text.includes('cookie')) {
            regulationText.push(text);
          }
        });
      }

      const fullText = regulationText.join('\n\n').substring(0, 10000);

      return {
        celexNumber,
        title: title || 'EU Regulation',
        type: 'Regulation',
        date,
        text: fullText || 'Regulation text not available. Please visit the source URL for full text.',
        url,
      };
    } catch (error: any) {
      console.error(`Failed to fetch regulation details: ${error.message}`);
      return null;
    }
  }
}
