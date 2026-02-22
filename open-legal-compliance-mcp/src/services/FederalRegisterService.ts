import { createHttpClient } from '../utils/httpClient.js';

export interface FederalRegisterDocument {
    document_number: string;
    title: string;
    abstract?: string;
    html_url: string;
    pdf_url?: string;
    publication_date: string;
    agencies: Array<{
        name: string;
        id: number;
        url: string;
    }>;
    type: string;
    excerpts?: string;
}

export interface FederalRegisterSearchResult {
    count: number;
    description: string;
    total_pages: number;
    results: FederalRegisterDocument[];
}

export class FederalRegisterService {
    private client;

    constructor() {
        this.client = createHttpClient('https://www.federalregister.gov/api/v1');
    }

    /**
     * Search Federal Register documents
     * @param query Search query string
     * @param options Optional filters
     */
    async searchDocuments(
        query: string,
        options: {
            perPage?: number;
            order?: 'relevance' | 'newest' | 'oldest';
            publicationDate?: {
                gte?: string; // YYYY-MM-DD
                lte?: string; // YYYY-MM-DD
            };
        } = {}
    ): Promise<FederalRegisterSearchResult> {
        try {
            const params: any = {
                'conditions[term]': query,
                'per_page': options.perPage || 20,
                'order': options.order || 'relevance',
            };

            if (options.publicationDate) {
                if (options.publicationDate.gte) {
                    params['conditions[publication_date][gte]'] = options.publicationDate.gte;
                }
                if (options.publicationDate.lte) {
                    params['conditions[publication_date][lte]'] = options.publicationDate.lte;
                }
            }

            const response = await this.client.get('/documents.json', { params });

            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to search Federal Register: ${error.message}`);
        }
    }

    /**
     * Get a specific document by its document number
     */
    async getDocument(documentNumber: string): Promise<FederalRegisterDocument> {
        try {
            const response = await this.client.get(`/documents/${documentNumber}.json`);
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new Error(`Document ${documentNumber} not found`);
            }
            throw new Error(`Failed to get document ${documentNumber}: ${error.message}`);
        }
    }
}
