import { createHttpClient } from '../utils/httpClient.js';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { chromium, Browser, Page } from 'playwright';

export interface StateCodeResult {
  state: string;
  section: string;
  title: string;
  text: string;
  url: string;
  lastUpdated?: string;
}

export class StateScraperService {
  private client;
  private turndown: TurndownService;

  constructor() {
    this.client = createHttpClient();
    this.turndown = new TurndownService();
  }

  /**
   * Unified scraper method for supported states
   */
  async scrapeStateLaw(state: string, query: string): Promise<StateCodeResult[]> {
    switch (state.toLowerCase()) {
      case 'ca':
        return this.scrapeCalifornia(query);
      case 'ny':
        return this.scrapeNewYork(query);
      case 'il':
        return this.scrapeIllinois(query);
      default:
        throw new Error(`State ${state} not supported. Supported states: CA, NY, IL`);
    }
  }

  /**
   * Scrape state code for California (CCPA/CPRA)
   * Note: California uses JSF (JavaServer Faces) which makes scraping difficult.
   * For CCPA, direct links to known sections are provided.
   */
  async scrapeCalifornia(keyword: string): Promise<StateCodeResult[]> {
    try {
      const results: StateCodeResult[] = [];
      const keywordLower = keyword.toLowerCase();

      // Known CCPA/CPRA sections - provide direct links
      if (keywordLower.includes('ccpa') || keywordLower.includes('cpra') || keywordLower.includes('privacy')) {
        // CCPA is in Civil Code Division 3, Part 4, Title 1.81.5
        const ccpaSections = [
          {
            section: '1798.100',
            title: 'Right to Know What Personal Information is Being Collected',
            url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.100',
          },
          {
            section: '1798.105',
            title: 'Right to Delete Personal Information',
            url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.105',
          },
          {
            section: '1798.110',
            title: 'Right to Know What Personal Information is Sold or Disclosed',
            url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.110',
          },
          {
            section: '1798.115',
            title: 'Right to Opt-Out of Sale of Personal Information',
            url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.115',
          },
          {
            section: '1798.120',
            title: 'Right to Non-Discrimination',
            url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.120',
          },
        ];

        for (const section of ccpaSections) {
          try {
            const response = await this.client.get(section.url, {
              headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (compatible; Legal-Compliance-MCP/1.0)',
              },
            });

            const $ = cheerio.load(response.data);
            // Extract text from the code section
            const text = $('.codeSection, .sectionText, #sectionText').text().trim() ||
              $('div:contains("' + section.section + '")').text().trim() ||
              'Section text available at source URL';

            results.push({
              state: 'CA',
              section: section.section,
              title: section.title,
              text: text.substring(0, 2000),
              url: section.url,
            });
          } catch (sectionError) {
            // Continue with other sections if one fails
            results.push({
              state: 'CA',
              section: section.section,
              title: section.title,
              text: 'Content available at source URL',
              url: section.url,
            });
          }
        }

        if (results.length > 0) {
          return results;
        }
      }

      // Fallback: try general search
      const searchUrl = `https://leginfo.legislature.ca.gov/faces/codes.xhtml`;
      const response = await this.client.get(searchUrl, {
        params: {
          'search': keyword,
        },
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (compatible; Legal-Compliance-MCP/1.0)',
        },
      });

      const $ = cheerio.load(response.data);

      // Try multiple selectors for search results
      $('.search-result, .code-section, table tr, .result-item').each((_, element) => {
        const title = $(element).find('h3, .title, a').first().text().trim();
        const link = $(element).find('a').attr('href');
        const text = $(element).find('.text, .content, td').text().trim();

        if (title && link && title.toLowerCase().includes(keywordLower)) {
          const fullUrl = link.startsWith('http')
            ? link
            : `https://leginfo.legislature.ca.gov${link}`;

          results.push({
            state: 'CA',
            section: this.extractSection(title),
            title,
            text: text.substring(0, 1000) || 'Content available at source',
            url: fullUrl,
          });
        }
      });

      if (results.length === 0) {
        throw new Error(
          'No results found. California Legislative Information uses dynamic content (JSF) ' +
          'which makes automated scraping difficult. Please visit ' +
          'https://leginfo.legislature.ca.gov/faces/codes.xhtml and search manually.'
        );
      }

      return results;
    } catch (error: any) {
      if (error.message.includes('Manual verification') || error.message.includes('California')) {
        throw error;
      }
      throw new Error(
        `California scraper failed: ${error.message}. ` +
        'California uses dynamic content which may require manual verification. ' +
        'Visit https://leginfo.legislature.ca.gov/faces/codes.xhtml for direct access.'
      );
    }
  }

  /**
   * Scrape state code for New York (Financial Regulations)
   * Uses Playwright to handle JavaScript-rendered content
   * Note: NY Senate website uses Drupal Views which loads results via AJAX
   */
  async scrapeNewYork(keyword: string): Promise<StateCodeResult[]> {
    let browser: Browser | null = null;
    try {
      const results: StateCodeResult[] = [];
      const keywordLower = keyword.toLowerCase();

      // Launch browser with options suitable for server environments
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();

      // Navigate to Consolidated Laws search page
      const searchUrl = `https://www.nysenate.gov/legislation/laws/CONSOLIDATED`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Handle search toggle for "Search OpenLegislation Statutes"
      // The form is #nys-openleg-search-form and the toggle is the H3 title
      const formSelector = 'form#nys-openleg-search-form';
      const toggleSelector = `${formSelector} h3.search-title`;

      try {
        const toggle = await page.locator(toggleSelector).first();
        if (await toggle.isVisible()) {
          await toggle.click();
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log('Toggle interaction failed, checking if input is already visible');
      }

      // Fill and submit form
      try {
        const inputSelector = 'input#edit-search-term';
        const inputLocator = page.locator(inputSelector);

        await inputLocator.waitFor({ state: 'visible', timeout: 10000 });
        await inputLocator.fill(keyword);

        // Submit by pressing Enter or clicking submit button
        const submitButton = page.locator(`${formSelector} button[type="submit"]`);

        // Setup navigation wait
        // The URL changes to /legislation/laws/search?term=keyword or similar
        const navigationPromise = page.waitForURL(/\/legislation\/laws\/search/, { timeout: 30000 });

        if (await submitButton.isVisible()) {
          await submitButton.click();
        } else {
          await inputLocator.press('Enter');
        }

        // Wait for navigation to complete
        await navigationPromise;
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
      } catch (e: any) {
        // Fallback: try direct navigation if form interaction fails
        console.log(`Form interaction failed: ${e.message}, trying direct navigation`);
        await page.goto(`https://www.nysenate.gov/legislation/laws/search?search_term=${encodeURIComponent(keyword)}`, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
      }

      // Extract search results
      const resultElements = await page.evaluate(({ keyword }) => {
        const results: Array<{ title: string, link: string, text: string }> = [];
        const keywordLower = keyword.toLowerCase();

        // Find all links in the main content area that point to law sections
        const mainContent = document.querySelector('main') || document.body;
        const allLinks = Array.from(mainContent.querySelectorAll('a')) as HTMLAnchorElement[];

        for (const link of allLinks) {
          const href = link.getAttribute('href') || '';
          const linkText = link.textContent?.trim() || '';

          // Skip navigation, search, and consolidated links
          if (!href ||
            href.includes('/CONSOLIDATED') ||
            href.includes('/all') ||
            (href.includes('/search') && !href.match(/\/laws\/[A-Z]{3,}\//)) ||
            href === '#' ||
            !href.match(/\/laws\/[A-Z]{3,}\//)) {
            continue;
          }

          // Check if link text contains the keyword or looks like a law section result
          // Results are formatted like "MDW SECTION 179 Privacy 1 instance"
          if (linkText.toLowerCase().includes(keywordLower) ||
            linkText.match(/^[A-Z]{3,}\s+(SECTION|ARTICLE)\s+/i)) {

            // Extract section/article info from link text
            const sectionMatch = linkText.match(/([A-Z]{3,})\s+(SECTION|ARTICLE)\s+([^\s]+)/i);
            const section = sectionMatch ? `${sectionMatch[1]} ${sectionMatch[2]} ${sectionMatch[3]}` : linkText;

            results.push({
              title: linkText,
              link: href,
              text: section
            });
          }
        }

        // Remove duplicates
        const unique = results.filter((item, index, self) =>
          index === self.findIndex(t => t.link === item.link)
        );

        return unique.slice(0, 5);
      }, { keyword });

      // Process results
      // Process results and extract full text
      console.error(`[NY Scraper] Found ${resultElements.length} potential results. Extracting content...`);

      for (const item of resultElements) {
        const fullUrl = item.link.startsWith('http')
          ? item.link
          : `https://www.nysenate.gov${item.link}`;

        let fullText = item.text;
        try {
          console.error(`[NY Scraper] Navigating to: ${fullUrl}`);
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

          // Wait for the main content to load
          // The content is usually in a div with class 'law-section' or similar, or just inside 'main'
          await page.waitForSelector('main, article, .law-section', { timeout: 10000 }).catch(() => { });

          // Extract text content
          const extractedText = await page.evaluate(() => {
            // Try specific selectors for law content first
            // The content is often in a div with class 'law-section' or 'node__content'
            // But sometimes it's just in 'main' or 'article'

            // First, try to find the specific law content container
            let contentArea = document.querySelector('.law-section') ||
              document.querySelector('.node__content') ||
              document.querySelector('article.node--type-law-section');

            // If not found, try to find the main content area but exclude the search form
            if (!contentArea) {
              const main = document.querySelector('main');
              if (main) {
                contentArea = main;
              }
            }

            if (!contentArea) return document.body.innerText;

            // Clone to avoid modifying the page
            const clone = contentArea.cloneNode(true) as HTMLElement;

            // Remove navigation, sidebars, scripts, styles, and search forms
            const toRemove = clone.querySelectorAll('nav, .sidebar, script, style, .field--name-field-law-section-source, .c-tools, form, .c-site-search, .search-title, .breadcrumb');
            toRemove.forEach(el => el.remove());

            // Also remove the "previous/next" navigation links often found at top/bottom
            const navLinks = clone.querySelectorAll('.law-section-nav, .prev-next');
            navLinks.forEach(el => el.remove());

            return clone.innerText.trim();
          });

          if (extractedText && extractedText.length > 100) {
            fullText = extractedText;
          }
        } catch (navError: any) {
          console.error(`[NY Scraper] Failed to extract text from ${fullUrl}: ${navError.message}`);
          // Fallback to existing text if navigation fails
        }

        results.push({
          state: 'NY',
          section: this.extractSection(item.title),
          title: item.title,
          text: fullText.substring(0, 5000), // Limit to 5000 chars
          url: fullUrl,
        });

        // Small delay to be nice to the server
        await page.waitForTimeout(500);
      }

      if (results.length === 0) {
        throw new Error(
          'No results found. New York Senate website structure may have changed. ' +
          'Please visit https://www.nysenate.gov/legislation/laws/CONSOLIDATED and search manually.'
        );
      }

      return results;
    } catch (error: any) {
      if (error.message.includes('Manual verification') || error.message.includes('New York')) {
        throw error;
      }
      throw new Error(
        `New York scraper failed: ${error.message}. ` +
        'Website structure may have changed. ' +
        'Visit https://www.nysenate.gov/legislation/laws/CONSOLIDATED for direct access.'
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Scrape state code for Illinois (BIPA/Biometrics)
   */
  /**
   * Scrape state code for Illinois (BIPA/Biometrics)
   * Refactored to use Playwright for better reliability
   */
  async scrapeIllinois(keyword: string): Promise<StateCodeResult[]> {
    let browser: Browser | null = null;
    try {
      const results: StateCodeResult[] = [];
      const keywordLower = keyword.toLowerCase();

      // Launch browser
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();

      // Illinois General Assembly search - BIPA is in 740 ILCS 14
      if (keywordLower.includes('bipa') || keywordLower.includes('biometric')) {
        const bipaUrl = 'https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004&ChapterID=57';
        try {
          await page.goto(bipaUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

          // Wait for content
          await page.waitForSelector('body', { timeout: 5000 });

          const text = await page.evaluate(() => document.body.innerText);

          results.push({
            state: 'IL',
            section: '740 ILCS 14',
            title: 'Biometric Information Privacy Act',
            text: text.substring(0, 2000),
            url: bipaUrl,
          });

          if (results.length > 0) {
            return results;
          }
        } catch (bipaError) {
          console.log('BIPA direct lookup failed, falling back to search');
        }
      }

      // General search via Google Site Search on ilga.gov as their internal search is flaky
      // Or try navigating the ILCS listing directly if possible.
      // For now, let's try the main ILCS listing page which is more stable
      const searchUrl = `https://www.ilga.gov/legislation/ilcs/ilcs.asp`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // If we are looking for privacy, we might want to check specific chapters
      // But for a general scraper, we'll try to find links matching the keyword
      // This is a simplified approach as ILGA structure is complex

      const links = await page.evaluate((keyword) => {
        const items: Array<{ title: string, url: string }> = [];
        const anchors = Array.from(document.querySelectorAll('a'));

        for (const a of anchors) {
          if (a.textContent?.toLowerCase().includes(keyword) ||
            a.getAttribute('href')?.toLowerCase().includes(keyword)) {
            items.push({
              title: a.textContent?.trim() || 'Unknown Title',
              url: a.href
            });
          }
        }
        return items.slice(0, 5);
      }, keywordLower);

      for (const link of links) {
        results.push({
          state: 'IL',
          section: 'Unknown',
          title: link.title,
          text: 'Content available at source URL',
          url: link.url,
        });
      }

      if (results.length === 0) {
        // Fallback result to point user to the site if scraping fails
        results.push({
          state: 'IL',
          section: 'Search',
          title: `Search Results for "${keyword}"`,
          text: `Automated scraping yielded no direct results. Please visit the Illinois General Assembly website directly.`,
          url: `https://www.ilga.gov/search/search.asp?search_text=${encodeURIComponent(keyword)}`
        });
      }

      return results;
    } catch (error: any) {
      console.error(`Illinois scraper failed: ${error.message}`);
      // Return a helpful error result instead of throwing, to allow other states to succeed
      return [{
        state: 'IL',
        section: 'Error',
        title: 'Scraping Error',
        text: `Failed to scrape Illinois site: ${error.message}. Please verify manually.`,
        url: 'https://www.ilga.gov/legislation/ilcs/ilcs.asp'
      }];
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Extract section number from title
   */
  private extractSection(title: string): string {
    const sectionMatch = title.match(/(?:Section|§|§§)\s*(\d+[A-Z]?\.?\d*)/i);
    return sectionMatch ? sectionMatch[1] : 'Unknown';
  }
}
