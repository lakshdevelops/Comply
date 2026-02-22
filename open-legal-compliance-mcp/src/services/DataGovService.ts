import { createHttpClient } from '../utils/httpClient.js';

export interface DataGovPackage {
    id: string;
    title: string;
    notes: string;
    url: string;
    resources: Array<{
        name: string;
        format: string;
        url: string;
    }>;
    organization: {
        title: string;
        image_url: string;
    };
    tags: Array<{
        name: string;
    }>;
}

export interface DataGovSearchResult {
    help: string;
    success: boolean;
    result: {
        count: number;
        sort: string;
        results: DataGovPackage[];
    };
}

export class DataGovService {
    private client;

    constructor() {
        this.client = createHttpClient('https://catalog.data.gov/api/3');
    }

    /**
     * Search Data.gov catalog
     * @param query Search keywords
     * @param rows Number of results to return
     */
    async searchPackages(query: string, rows = 10): Promise<DataGovSearchResult> {
        try {
            const response = await this.client.get('/action/package_search', {
                params: {
                    q: query,
                    rows: rows
                }
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to search Data.gov: ${error.message}`);
        }
    }
}
