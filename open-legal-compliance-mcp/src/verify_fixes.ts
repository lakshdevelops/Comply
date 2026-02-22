
import { OpenStatesService } from './services/OpenStatesService.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verifyFixes() {
    const apiKey = process.env.OPEN_STATES_API_KEY;
    if (!apiKey) {
        console.error("❌ OPEN_STATES_API_KEY is missing.");
        process.exit(1);
    }
    const service = new OpenStatesService(apiKey);

    // 1. Test Louisiana (Legacy/Timeout Fallback)
    console.log('🔍 Test 1: Louisiana (Legacy Fallback Check)');
    console.log('Searching for "privacy" in LA...');
    try {
        const laResults = await service.searchBills('privacy', 'LA');
        if (laResults.results.length > 0) {
            const bill = laResults.results[0];
            console.log(`📄 Bill: ${bill.identifier} (ID: ${bill.id})`);
            console.log('   Fetching text...');
            const text = await service.getBillText(bill);
            console.log(`Snapshot: ${text.substring(0, 100).replace(/\n/g, ' ')}...`);
            console.log(`Length: ${text.length}`);
        } else {
            console.log('⚠️ No LA results found.');
        }
    } catch (e: any) {
        console.error(`❌ LA Test Failed: ${e.message}`);
    }

    console.log('\n------------------------------------------------');

    // 2. Test Indiana (PDF Parsing)
    console.log('🔍 Test 2: Indiana (PDF Parsing Check)');
    try {
        // Search for something broad to guarantee a PDF result
        const inResults = await service.searchBills('education', 'IN');
        if (inResults.results.length > 0) {
            const bill = inResults.results[0];
            console.log(`📄 Bill: ${bill.identifier} (ID: ${bill.id})`);
            console.log('   Fetching text...');
            const text = await service.getBillText(bill);
            console.log(`Snapshot: ${text.substring(0, 100).replace(/\n/g, ' ')}...`);
            console.log(`Length: ${text.length}`);
        } else {
            console.log('⚠️ No IN results found.');
        }
    } catch (e: any) {
        console.error(`❌ IN Test Failed: ${e.message}`);
    }
}

verifyFixes();
