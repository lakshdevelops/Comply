import { EURexService } from './services/EURexService.js';
import { StateScraperService } from './services/StateScraperService.js';

async function findPrivacyLaws() {
    console.log('🔍 Searching for Cell Phone Data Tracking Privacy Laws...\n');

    // 1. Search EU Regulations
    console.log('🇪🇺 Searching EU Regulations (EUR-Lex)...');
    const euService = new EURexService();
    try {
        // ePrivacy Directive is key for electronic communications
        const euResults = await euService.searchRegulation('privacy electronic communications');

        console.log(`   Found ${euResults.length} EU results.`);
        euResults.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.title}`);
            console.log(`      URL: ${r.url}`);
            console.log(`      Snippet: ${r.text.substring(0, 150).replace(/\n/g, ' ')}...\n`);
        });
    } catch (e: any) {
        console.error(`   ❌ EU Search failed: ${e.message}`);
    }

    // 2. Search California Law
    console.log('🇺🇸 Searching California Law (StateScraper)...');
    const stateService = new StateScraperService();
    try {
        const caResults = await stateService.scrapeStateLaw('ca', 'mobile tracking privacy');

        console.log(`   Found ${caResults.length} CA results.`);
        caResults.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.title}`);
            console.log(`      Section: ${r.section}`);
            console.log(`      URL: ${r.url}`);
            console.log(`      Snippet: ${r.text.substring(0, 150).replace(/\n/g, ' ')}...\n`);
        });
    } catch (e: any) {
        console.error(`   ❌ CA Search failed: ${e.message}`);
    }
}

findPrivacyLaws().catch(console.error);
