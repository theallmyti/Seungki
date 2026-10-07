import { ConvexHttpClient } from "convex/browser";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
const client = new ConvexHttpClient(process.env.CONVEX_URL);
try {
  const match = await client.query("matches:getMatchById", { vlrId: "753459" });
  console.log('DB Status:', match?.status);
  console.log('Score:', match?.team1?.score, '-', match?.team2?.score);
} catch (e) { console.error(e); }
