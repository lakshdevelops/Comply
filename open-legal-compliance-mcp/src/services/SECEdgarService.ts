import { createHttpClient } from '../utils/httpClient.js';

export interface SECSubmission {
    cik: string;
    entityType: string;
    sic: string;
    sicDescription: string;
    name: string;
    tickers: string[];
    exchanges: string[];
    ein: string;
    description: string;
    website: string;
    investorWebsite: string;
    category: string;
    fiscalYearEnd: string;
    stateOfIncorporation: string;
    stateOfIncorporationDescription: string;
    filings: {
        recent: {
            accessionNumber: string[];
            filingDate: string[];
            reportDate: string[];
            acceptanceDateTime: string[];
            act: string[];
            form: string[];
            fileNumber: string[];
            filmNumber: string[];
            items: string[];
            size: number[];
            isXBRL: number[];
            isInlineXBRL: number[];
            primaryDocument: string[];
            primaryDocDescription: string[];
        };
    };
}

export class SECEdgarService {
    private client;

    constructor() {
        // SEC requires a specific User-Agent format: <Company Name> <Email Address>
        this.client = createHttpClient('https://data.sec.gov', 30000);
        this.client.defaults.headers.common['User-Agent'] = 'Legal Compliance MCP 62.dropper-gauze@icloud.com';
    }

    /**
     * Get company submissions by CIK
     * @param cik Central Index Key (10 digits)
     */
    async getCompanySubmissions(cik: string): Promise<SECSubmission> {
        try {
            // CIK must be 10 digits, padded with zeros
            const paddedCik = cik.padStart(10, '0');
            const response = await this.client.get(`/submissions/CIK${paddedCik}.json`);
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new Error(`Company with CIK ${cik} not found`);
            }
            throw new Error(`Failed to get SEC submissions: ${error.message}`);
        }
    }

    /**
     * Get company concept (XBRL data)
     * @param cik Central Index Key
     * @param taxonomy Taxonomy (e.g., 'us-gaap')
     * @param tag Tag (e.g., 'AccountsPayableCurrent')
     */
    async getCompanyConcept(cik: string, taxonomy: string, tag: string): Promise<any> {
        try {
            const paddedCik = cik.padStart(10, '0');
            const response = await this.client.get(`/api/xbrl/companyconcept/CIK${paddedCik}/${taxonomy}/${tag}.json`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get company concept: ${error.message}`);
        }
    }
}
