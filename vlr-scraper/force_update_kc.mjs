import { ConvexHttpClient } from "convex/browser";
import { getVlrMatchDetails } from './scrapeMatchData.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new ConvexHttpClient(process.env.CONVEX_URL);
const CONVEX_API_KEY = process.env.CONVEX_API_KEY;

// Force scrape and upsert the KC vs XLG match directly
console.log('Scraping KC vs XLG match page (753459)...');
const details = await getVlrMatchDetails('https://www.vlr.gg/753459');
if (!details) {
    console.log('Failed to get match details');
    process.exit(1);
}
console.log(`Status: ${details.status}`);
console.log(`Teams: ${details.team1.name} ${details.team1.score} - ${details.team2.score} ${details.team2.name}`);

// Upsert to Convex
const result = await client.mutation("matches:upsertMatch", {
    match: details,
    apiKey: CONVEX_API_KEY
});
console.log('Upsert result:', result);
