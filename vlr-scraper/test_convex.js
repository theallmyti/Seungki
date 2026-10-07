import { ConvexHttpClient } from "convex/browser";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new ConvexHttpClient(process.env.CONVEX_URL || "https://loyal-leopard-468.convex.cloud");

async function checkConvex() {
    try {
        console.log("Connecting to Convex at:", process.env.CONVEX_URL);
        const homeMatches = await client.query("matches:getHomePageMatches", { upcomingLimit: 20 });
        console.log("Home page live count:", homeMatches.live.length, "upcoming count:", homeMatches.upcoming.length);
        if (homeMatches.live.length > 0) {
            console.log("Sample LIVE match:", homeMatches.live[0].team1.name, "vs", homeMatches.live[0].team2.name);
        }
        if (homeMatches.upcoming.length > 0) {
            console.log("Sample UPCOMING match:", homeMatches.upcoming[0].team1.name, "vs", homeMatches.upcoming[0].team2.name);
        }

        const results = await client.query("matches:searchCompletedMatchesPaginated", { paginationOpts: { numItems: 5, cursor: null }, searchTerm: "" });
        console.log("Completed matches count:", results ? results.page.length : 0);
        if (results && results.page.length > 0) {
            console.log("Sample completed match:", results.page[0].team1.name, "vs", results.page[0].team2.name);
        }
    } catch (e) {
        console.error("Convex error:", e);
    }
}

checkConvex();
