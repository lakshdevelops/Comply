import { createHttpClient } from '../utils/httpClient.js';

export interface FDAResult {
    meta: {
        disclaimer: string;
        terms: string;
        license: string;
        last_updated: string;
        results: {
            skip: number;
            limit: number;
            total: number;
        };
    };
    results: any[];
}

export class FDAService {
    private client;

    constructor() {
        this.client = createHttpClient('https://api.fda.gov');
    }

    /**
     * Search FDA Drug Adverse Events
     * @param query Search query (Lucene syntax)
     * @param limit Number of results (default 10)
     */
    async searchDrugEvents(query: string, limit = 10): Promise<FDAResult> {
        return this.searchEndpoint('/drug/event.json', query, limit);
    }

    /**
     * Search FDA Medical Device Adverse Events
     * @param query Search query (Lucene syntax)
     * @param limit Number of results (default 10)
     */
    async searchDeviceEvents(query: string, limit = 10): Promise<FDAResult> {
        return this.searchEndpoint('/device/event.json', query, limit);
    }

    /**
     * Search FDA Food Enforcement Reports
     * @param query Search query (Lucene syntax)
     * @param limit Number of results (default 10)
     */
    async searchFoodEnforcement(query: string, limit = 10): Promise<FDAResult> {
        return this.searchEndpoint('/food/enforcement.json', query, limit);
    }

    private async searchEndpoint(endpoint: string, query: string, limit: number): Promise<FDAResult> {
        try {
            const response = await this.client.get(endpoint, {
                params: {
                    search: query,
                    limit: limit
                }
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to search FDA API: ${error.message}`);
        }
    }
}
