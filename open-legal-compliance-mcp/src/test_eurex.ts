import dotenv from 'dotenv';
import { EURexService } from './services/EURexService.js';

dotenv.config();

async function testEURex() {
    console.log('Testing EURexService with Playwright...');

    const service = new EURexService();

    try {
        console.log('Searching for "GDPR"...');
        const results = await service.searchRegulation('gdpr');

        console.log(`✅ Success! Found ${results.length} results.`);

        if (results.length > 0) {
            const first = results[0];
            console.log('\nFirst Result:');
            console.log(`Title: ${first.title}`);
            console.log(`CELEX: ${first.celexNumber}`);
            console.log(`URL: ${first.url}`);
            console.log(`Text Preview: ${first.text.substring(0, 150)}...`);
        }
    } catch (error: any) {
        console.error('❌ Failed:', error.message);
    }
}

testEURex().catch(console.error);
