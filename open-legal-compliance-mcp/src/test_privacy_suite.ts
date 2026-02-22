import { EURexService } from './services/EURexService.js';
import { GovInfoService } from './services/GovInfoService.js';
import { StateScraperService } from './services/StateScraperService.js';
import dotenv from 'dotenv';

dotenv.config();

async function runPrivacySuite() {
    console.log('📱 Running Comprehensive Cell Phone Data Privacy Search Suite...\n');

    // 1. EU Regulations
    console.log('🇪🇺 [EU] Searching EUR-Lex for "privacy electronic communications"...');
    const euService = new EURexService();
    try {
        const euResults = await euService.searchRegulation('privacy electronic communications');
        console.log(`   ✅ Found ${euResults.length} EU results.`);
        euResults.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.title}`);
            console.log(`      URL: ${r.url}`);
        });
    } catch (e: any) {
        console.error(`   ❌ EU Search failed: ${e.message}`);
    }
    console.log('\n----------------------------------------\n');

    // 2. US Federal Code
    console.log('🇺🇸 [US Federal] Searching US Code (GovInfo) for "mobile tracking privacy"...');
    const govInfoService = new GovInfoService(process.env.GOVINFO_API_KEY || '');
    try {
        // Searching Title 18 (Crimes) or Title 47 (Telecommunications) is often relevant
        const usResults = await govInfoService.searchUSCode('mobile tracking privacy');
        console.log(`   ✅ Found ${usResults.length} US Federal results.`);
        usResults.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.title}`);
            console.log(`      URL: ${r.url}`);
        });
    } catch (e: any) {
        console.error(`   ❌ US Federal Search failed: ${e.message}`);
    }
    console.log('\n----------------------------------------\n');

    // 3. US State Laws
    const stateService = new StateScraperService();

    // California (CCPA/CPRA)
    console.log('🇺🇸 [CA] Searching California Law for "mobile location privacy"...');
    try {
        const caResults = await stateService.scrapeStateLaw('ca', 'mobile location privacy');
        console.log(`   ✅ Found ${caResults.length} CA results.`);
        caResults.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.title}`);
            console.log(`      Section: ${r.section}`);
            console.log(`      URL: ${r.url}`);
        });
    } catch (e: any) {
        console.error(`   ❌ CA Search failed: ${e.message}`);
    }
    console.log('\n');

    // Illinois (BIPA - relevant for FaceID/Fingerprint data)
    console.log('🇺🇸 [IL] Searching Illinois Law for "biometric privacy"...');
    try {
        const ilResults = await stateService.scrapeStateLaw('il', 'biometric privacy');
        console.log(`   ✅ Found ${ilResults.length} IL results.`);
        ilResults.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.title}`);
            console.log(`      Section: ${r.section}`);
            console.log(`      URL: ${r.url}`);
        });
    } catch (e: any) {
        console.error(`   ❌ IL Search failed: ${e.message}`);
    }
    console.log('\n');

    // New York (SHIELD Act / General Privacy)
    console.log('🇺🇸 [NY] Searching New York Law for "location tracking"...');
    try {
        const nyResults = await stateService.scrapeStateLaw('ny', 'location tracking');
        console.log(`   ✅ Found ${nyResults.length} NY results.`);
        nyResults.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.title}`);
            console.log(`      Section: ${r.section}`);
            console.log(`      URL: ${r.url}`);
        });
    } catch (e: any) {
        console.error(`   ❌ NY Search failed: ${e.message}`);
    }
}

runPrivacySuite().catch(console.error);
