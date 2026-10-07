import { getVlrMatchDetails } from './scrapeMatchData.js';
async function test() {
    const details = await getVlrMatchDetails('https://www.vlr.gg/753459');
    console.log(JSON.stringify(details, null, 2));
}
test().catch(console.error);
