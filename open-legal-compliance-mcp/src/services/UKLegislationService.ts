import { createHttpClient } from '../utils/httpClient.js';
import * as cheerio from 'cheerio';

export interface UKLegislationResult {
    id: string;
    title: string;
    type: string;
    year: number;
    number: number;
    url: string;
    content?: string;
}

export class UKLegislationService {
    private client;

    constructor() {
        this.client = createHttpClient('https://www.legislation.gov.uk');
    }

    /**
     * Search UK Legislation
     * @param query Search keywords
     */
    async searchLegislation(query: string): Promise<UKLegislationResult[]> {
        try {
            // Use the Atom feed endpoint for search
            const response = await this.client.get('/all/data.feed', {
                params: {
                    title: query
                },
                headers: {
                    'Accept': 'application/atom+xml'
                }
            });

            // Parse Atom XML using cheerio
            const $ = cheerio.load(response.data, { xmlMode: true });
            const results: UKLegislationResult[] = [];

            $('entry').each((_, element) => {
                const entry = $(element);
                const id = entry.find('id').text();
                const title = entry.find('title').text();
                const summary = entry.find('summary').text();

                // Find the self link or alternate link
                const link = entry.find('link[rel="self"]').attr('href') ||
                    entry.find('link[rel="alternate"]').attr('href') || '';

                // Extract year and number from ID or link if possible
                // ID format: http://www.legislation.gov.uk/id/ukpga/1998/29
                let year = 0;
                let number = 0;
                let type = 'legislation';

                const idMatch = id.match(/\/id\/([a-z]+)\/(\d{4})\/(\d+)/);
                if (idMatch) {
                    type = idMatch[1];
                    year = parseInt(idMatch[2], 10);
                    number = parseInt(idMatch[3], 10);
                }

                results.push({
                    id,
                    title,
                    type,
                    year,
                    number,
                    url: link,
                    content: summary
                });
            });

            return results;

        } catch (error: any) {
            throw new Error(`Failed to search UK legislation: ${error.message}`);
        }
    }

    /**
     * Get specific legislation content
     * @param type Type (e.g., 'ukpga')
     * @param year Year
     * @param number Number
     */
    async getLegislation(type: string, year: number, number: number): Promise<any> {
        try {
            // For specific items, data.json often works
            const response = await this.client.get(`/${type}/${year}/${number}/data.json`);
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new Error(`Legislation not found: ${type}/${year}/${number}`);
            }
            throw new Error(`Failed to get legislation: ${error.message}`);
        }
    }
}
