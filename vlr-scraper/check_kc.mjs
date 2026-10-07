import { ConvexHttpClient } from "convex/browser";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function findMatch() {
    const matches = await client.query("matches:getHomePageMatches", { upcomingLimit: 100 });
    const match = matches.upcoming.find(m => m.team1.name.includes('Karmine') || m.team2.name.includes('Karmine'));
    if (match) {
        console.log('Match ID:', match.vlrId, match.team1.name, 'vs', match.team2.name);
    } else {
        console.log('Match not found');
    }
}
findMatch().catch(console.error);
