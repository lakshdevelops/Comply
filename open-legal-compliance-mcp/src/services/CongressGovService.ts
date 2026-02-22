import { createHttpClient } from '../utils/httpClient.js';

export interface CongressBill {
    congress: number;
    number: string;
    originChamber: string;
    originChamberCode: string;
    title: string;
    type: string;
    updateDate: string;
    url: string;
    latestAction?: {
        actionDate: string;
        text: string;
    };
}

export interface CongressGovSearchResult {
    bills: CongressBill[];
    pagination: {
        count: number;
        next: string;
    };
}

export class CongressGovService {
    private client;
    private apiKey: string;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('Congress.gov API key is required');
        }
        this.apiKey = apiKey;
        this.client = createHttpClient('https://api.congress.gov/v3');
    }

    /**
     * Search bills in Congress.gov
     * @param query Search query (optional, filters by title/text if supported, otherwise lists bills)
     * @param congress Congress number (optional, defaults to current)
     */
    async searchBills(congress?: number): Promise<CongressGovSearchResult> {
        try {
            const endpoint = congress ? `/bill/${congress}` : '/bill';
            const response = await this.client.get(endpoint, {
                params: {
                    api_key: this.apiKey,
                    format: 'json',
                    limit: 20
                }
            });

            return response.data;
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('Invalid Congress.gov API key');
            }
            throw new Error(`Failed to search Congress.gov: ${error.message}`);
        }
    }

    /**
     * Get bill details
     * @param congress Congress number
     * @param type Bill type (e.g., hr, s)
     * @param number Bill number
     */
    async getBill(congress: number, type: string, number: string): Promise<any> {
        try {
            const response = await this.client.get(`/bill/${congress}/${type}/${number}`, {
                params: {
                    api_key: this.apiKey,
                    format: 'json'
                }
            });
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new Error(`Bill not found: ${congress}/${type}/${number}`);
            }
            throw new Error(`Failed to get bill details: ${error.message}`);
        }
    }
}
