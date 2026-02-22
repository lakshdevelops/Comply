import { EURexService } from './services/EURexService.js';
import { GovInfoService } from './services/GovInfoService.js';
import { StateScraperService } from './services/StateScraperService.js';
import { OpenStatesService } from './services/OpenStatesService.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Production-ready function to search privacy laws across all supported jurisdictions.
 * This mimics how the MCP server would handle a complex user query.
 */
async function searchPrivacyLaws(query: string) {
    console.log(`\n🔍 Executing Global Privacy Law Search for: "${query}"\n`);

    // Initialize Services
    const euService = new EURexService();
    const govInfoService = new GovInfoService(process.env.GOVINFO_API_KEY || '');
    const stateScraper = new StateScraperService();
    const openStates = new OpenStatesService(process.env.OPEN_STATES_API_KEY || '');

    // 1. European Union (EUR-Lex)
    console.log('🇪🇺 [EU] Searching Regulations...');
    try {
        const euResults = await euService.searchRegulation(query);
        console.log(`   Found ${euResults.length} results.`);
        if (euResults.length > 0) {
            console.log(`   Top Result: ${euResults[0].title} (${euResults[0].url})`);
        }
    } catch (e: any) {
        console.error(`   ❌ EU Search failed: ${e.message}`);
    }

    // 2. US Federal (GovInfo)
    console.log('\n🇺🇸 [US Federal] Searching US Code...');
    try {
        const usResults = await govInfoService.searchUSCode(query);
        console.log(`   Found ${usResults.length} results.`);
        if (usResults.length > 0) {
            console.log(`   Top Result: ${usResults[0].title} (${usResults[0].url})`);
        }
    } catch (e: any) {
        console.error(`   ❌ US Federal Search failed: ${e.message}`);
    }

    // 3. Key US States (Deep Scraping: CA, NY, IL)
    console.log('\n🇺🇸 [US States - Deep Search] Searching CA, NY, IL...');
    const keyStates = ['ca', 'ny', 'il'];
    for (const state of keyStates) {
        try {
            const results = await stateScraper.scrapeStateLaw(state, query);
            console.log(`   [${state.toUpperCase()}] Found ${results.length} results.`);
            if (results.length > 0) {
                console.log(`   Top Result: ${results[0].title} (${results[0].url})`);
            }
        } catch (e: any) {
            console.error(`   ❌ ${state.toUpperCase()} Search failed: ${e.message}`);
        }
    }

    // 4. All US States (Open States API)
    // We'll search a few other states to demonstrate 50-state capability
    console.log('\n🇺🇸 [US States - Broad Search] Searching TX, FL via Open States...');
    const otherStates = ['TX', 'FL'];
    for (const state of otherStates) {
        try {
            const response = await openStates.searchBills(query, state);
            console.log(`   [${state}] Found ${response.results.length} results.`);
            if (response.results.length > 0) {
                const topResult = response.results[0];
                console.log(`   Top Result: ${topResult.title} (ID: ${topResult.identifier})`);

                // Fetch full text
                console.log(`   ... Fetching full text for ${topResult.identifier} ...`);
                const text = await openStates.getBillText(topResult);
                console.log(`   Extracted ${text.length} characters.`);
                console.log(`   Preview: "${text.substring(0, 100).replace(/\n/g, ' ')}..."`);
            }
        } catch (e: any) {
            console.error(`   ❌ ${state} Search failed: ${e.message}`);
        }
    }
}

// Execute the search
searchPrivacyLaws('mobile tracking privacy').catch(console.error);
