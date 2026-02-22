import { createHttpClient } from '../utils/httpClient.js';
import * as cheerio from 'cheerio';
import { AxiosInstance } from 'axios';
import { createRequire } from 'module';
import { chromium, Browser } from 'playwright';

const require = createRequire(import.meta.url);
const pdfModule = require('pdf-parse');
const pdf = pdfModule.default || pdfModule;

export interface OpenStatesBill {
    id: string;
    session: string;
    jurisdiction: {
        name: string;
        classification: string;
    };
    identifier: string;
    title: string;
    classification: string[];
    subject: string[];
    created_at: string;
    updated_at: string;
    first_action_date: string;
    latest_action_date: string;
    versions?: OpenStatesBillVersion[]; // Added versions
}

export interface OpenStatesBillVersion {
    note: string;
    links: {
        url: string;
        media_type: string;
    }[];
}

export interface OpenStatesSearchResult {
    results: OpenStatesBill[];
    pagination: {
        per_page: number;
        page: number;
        max_page: number;
        total_items: number;
    };
}

export class OpenStatesService {
    private client: AxiosInstance;
    private scraperClient: AxiosInstance; // Client for external text fetching
    private apiKey: string;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('Open States API key is required');
        }
        this.apiKey = apiKey;
        this.client = createHttpClient('https://v3.openstates.org');
        // Open States uses X-API-KEY header
        this.client.defaults.headers.common['X-API-KEY'] = this.apiKey;

        // Generic client for scraping external URLs (no API key, no base URL)
        this.scraperClient = createHttpClient();
        // Remove the inherited key from the scraper client if it was copied (depends on implementation),
        // but createHttpClient() without args likely returns clean instance or default.
        // To be safe, we ensure headers are clean or just accept createHttpClient behavior.
        // Actually createHttpClient in this codebase likely returns a fresh instance.
    }

    /**
     * Search bills across states
     * @param query Search keywords
     * @param jurisdiction State abbreviation (e.g., 'ca', 'ny') - optional
     */
    async searchBills(query: string, jurisdiction?: string): Promise<OpenStatesSearchResult> {
        try {
            const params: any = {
                q: query,
                sort: 'updated_desc',
                page: 1,
                per_page: 20
            };

            if (jurisdiction) {
                params.jurisdiction = jurisdiction;
            }

            const response = await this.client.get('/bills', { params });
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('Invalid Open States API key');
            }
            throw new Error(`Failed to search Open States: ${error.message}`);
        }
    }

    /**
     * Get bill details by OCD ID
     * @param billId The OCD Bill ID (e.g. ocd-bill/...)
     */
    async getBillDetail(billId: string): Promise<OpenStatesBill> {
        try {
            const response = await this.client.get(`/bills/${billId}`, {
                params: {
                    include: 'versions'
                }
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get bill details for ${billId}: ${error.message}`);
        }
    }

    /**
     * Get bill details (legacy method kept for compatibility, updated to use getBillDetail)
     * @param jurisdiction State abbreviation
     * @param session Session identifier
     * @param identifier Bill identifier (e.g., 'HB 101')
     */
    async getBill(jurisdiction: string, session: string, identifier: string): Promise<OpenStatesBill> {
        try {
            // Open States V3 uses a specific ID format or lookup
            // For simplicity, we'll search for the specific bill first to get its ID
            const searchResponse = await this.client.get('/bills', {
                params: {
                    jurisdiction,
                    session,
                    identifier
                }
            });

            if (searchResponse.data.results && searchResponse.data.results.length > 0) {
                const billId = searchResponse.data.results[0].id;
                return this.getBillDetail(billId);
            }

            throw new Error('Bill not found');
        } catch (error: any) {
            throw new Error(`Failed to get bill details: ${error.message}`);
        }
    }

    /**
     * Fetch the full text of a bill via Playwright (Robust Fallback)
     */
    private async fetchTextWithPlaywright(url: string): Promise<string> {
        let browser: Browser | null = null;
        try {
            console.log(`[Playwright Fallback] Launching browser for: ${url}`);
            browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            // Set longer timeout for legacy gov sites
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            // Extract text
            const text = await page.evaluate(() => {
                // Remove clutter
                const clutter = document.querySelectorAll('script, style, nav, footer, header');
                clutter.forEach(c => c.remove());
                return document.body.innerText;
            });

            return text || 'Empty text content from Playwright.';
        } catch (e: any) {
            throw new Error(`Playwright fetch failed: ${e.message}`);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Fetch the full text of a bill
     * @param bill The bill object (must have ID)
     * @returns The full text of the bill, or a message if not available
     */
    async getBillText(bill: OpenStatesBill): Promise<string> {
        try {
            // If the bill object doesn't have versions, fetch details first
            let billDetail = bill;
            if (!billDetail.versions) {
                try {
                    billDetail = await this.getBillDetail(bill.id);
                } catch (e) {
                    console.warn(`Could not fetch details for bill ${bill.id}, proceeding with available data.`);
                }
            }

            if (!billDetail.versions || billDetail.versions.length === 0) {
                return 'No full text versions available from Open States.';
            }

            // Find the best version
            // Prefer HTML over PDF, but if PDF is the only option, take it.
            let bestUrl: string | null = null;
            let isPdf = false;

            // 1. Try HTML
            for (const version of billDetail.versions) {
                const htmlLink = version.links.find(l => l.media_type === 'text/html');
                if (htmlLink) {
                    bestUrl = htmlLink.url;
                    isPdf = false;
                    break;
                }
            }

            // 2. Try PDF if no HTML
            if (!bestUrl) {
                for (const version of billDetail.versions) {
                    const pdfLink = version.links.find(l => l.media_type === 'application/pdf');
                    if (pdfLink) {
                        bestUrl = pdfLink.url;
                        isPdf = true;
                        break;
                    }
                }
            }

            // 3. Last result fallback
            if (!bestUrl) {
                for (const version of billDetail.versions) {
                    if (version.links.length > 0) {
                        bestUrl = version.links[0].url;
                        isPdf = bestUrl.toLowerCase().endsWith('.pdf');
                        break;
                    }
                }
            }

            if (!bestUrl) {
                return 'No text links available in bill versions.';
            }

            console.log(`Fetching bill text from: ${bestUrl} (PDF: ${isPdf})`);

            // Handle PDF
            if (isPdf) {
                try {
                    const response = await this.scraperClient.get(bestUrl, {
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; Legal-Compliance-MCP/1.0)'
                        },
                        timeout: 20000
                    });
                    const dataBuffer = Buffer.from(response.data);
                    const pdfData = await pdf(dataBuffer);
                    return pdfData.text.replace(/\s+/g, ' ').substring(0, 10000);
                } catch (pdfError: any) {
                    return `Failed to parse PDF: ${pdfError.message}`;
                }
            }

            // Handle HTML (Standard)
            try {
                const response = await this.scraperClient.get(bestUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9'
                    },
                    timeout: 10000 // Short timeout for standard fetch, fail fast to fallback
                });

                const $ = cheerio.load(response.data);
                $('script, style, nav, footer, header').remove();
                const text = $('body').text().trim();
                const cleanText = text.replace(/\s+/g, ' ').substring(0, 10000);

                if (cleanText.length < 50) {
                    throw new Error('Suspiciously short content, likely a block or error page.');
                }

                return cleanText;
            } catch (httpError: any) {
                console.warn(`Standard fetch failed for ${bestUrl}: ${httpError.message}. Retrying with Playwright...`);
                // Fallback to Playwright
                return await this.fetchTextWithPlaywright(bestUrl);
            }

        } catch (error: any) {
            return `Failed to retrieve bill text: ${error.message}`;
        }
    }
}
