import { ConvexHttpClient } from "convex/browser";
import { getVlrMatchDetails } from './scrapeMatchData.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function test() {
  console.log('Scraping KC vs XLG (753459)...');
  const match = await getVlrMatchDetails('https://www.vlr.gg/753459');
  match.vlrId = '753459';
  console.log('Status from scraper:', match.status);
  
  try {
    const res = await client.mutation("matches:upsertMatch", {
      match,
      apiKey: process.env.CONVEX_API_KEY
    });
    console.log('Upsert result:', res);
  } catch (err) {
    console.error('Mutation error:', err);
  }
}
test();
