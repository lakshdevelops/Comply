import { OpenStatesService } from './services/OpenStatesService.js';
import dotenv from 'dotenv';

dotenv.config();

const ALL_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

async function testAll50States() {
    console.log('🇺🇸 Starting 50-State Legislation Search for "privacy"...');
    console.log('------------------------------------------------');

    const openStates = new OpenStatesService(process.env.OPEN_STATES_API_KEY || '');
    const query = 'privacy';

    const results: Record<string, number> = {};
    const errors: string[] = [];

    // Process sequentially to avoid rate limiting (429)
    const CHUNK_SIZE = 1;
    for (let i = 0; i < ALL_STATES.length; i += CHUNK_SIZE) {
        const chunk = ALL_STATES.slice(i, i + CHUNK_SIZE);
        const promises = chunk.map(async (state) => {
            let retries = 3;
            let delay = 2000;

            while (retries > 0) {
                try {
                    const response = await openStates.searchBills(query, state);
                    results[state] = response.results.length;
                    console.log(`✅ [${state}] Found ${response.results.length} bills`);
                    break;
                } catch (e: any) {
                    if (e.message.includes('429') && retries > 1) {
                        console.log(`⏳ [${state}] Rate limited, retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2;
                        retries--;
                    } else {
                        console.error(`❌ [${state}] Failed: ${e.message}`);
                        errors.push(state);
                        break;
                    }
                }
            }
        });

        await Promise.all(promises);
        // Delay between requests
        if (i + CHUNK_SIZE < ALL_STATES.length) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    console.log('\n------------------------------------------------');
    console.log(`🎉 Completed. Successful: ${Object.keys(results).length}/50`);
    if (errors.length > 0) {
        console.log(`⚠️  Failed States: ${errors.join(', ')}`);
    }
}

testAll50States().catch(console.error);
