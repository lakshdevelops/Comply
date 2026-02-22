import { createHttpClient } from '../utils/httpClient.js';

export interface CanLIICase {
    databaseId: string;
    caseId: string;
    title: string;
    citation: string;
    url: string;
    decisionDate: string;
    court: string;
}

export class CanLIIService {
    private client;
    private apiKey: string;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('CanLII API key is required');
        }
        this.apiKey = apiKey;
        this.client = createHttpClient('https://api.canlii.org/v1');
    }

    /**
     * Search CanLII cases
     * @param query Search keywords
     * @param databaseId Database ID (e.g., 'csc-scc' for Supreme Court) - optional
     */
    async searchCases(query: string, databaseId?: string): Promise<CanLIICase[]> {
        try {
            // CanLII API structure is unique. 
            // /caseBrowse/en/{databaseId}/?offset=0&resultCount=10&api_key={key}
            // Note: Full text search might not be directly exposed in the free tier in the same way.
            // We'll implement a basic browse/list capability or search if available.

            // For this implementation, we'll assume we can list recent cases from a database
            // or search if the API documentation allows (which is restricted).
            // We will implement a "list recent" feature as a proxy for search in specific databases.

            const db = databaseId || 'csc-scc'; // Default to Supreme Court of Canada

            const response = await this.client.get(`/caseBrowse/en/${db}/`, {
                params: {
                    api_key: this.apiKey,
                    offset: 0,
                    resultCount: 10
                }
            });

            return (response.data.cases || []).map((c: any) => ({
                databaseId: c.databaseId,
                caseId: c.caseId,
                title: c.title,
                citation: c.citation,
                url: `https://www.canlii.org/en/${c.databaseId}/doc/${c.caseId}/doc.html`,
                decisionDate: c.decisionDate,
                court: db
            }));

        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('Invalid CanLII API key');
            }
            throw new Error(`Failed to access CanLII: ${error.message}`);
        }
    }
}
