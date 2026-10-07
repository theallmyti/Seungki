import { getVlrMatchDetails } from './scrapeMatchData.js';
async function test() {
    const details = await getVlrMatchDetails('https://www.vlr.gg/753459');
    console.log("Overall status:", details.status);
    console.log("Team 1 score:", details.team1.score);
    console.log("Team 2 score:", details.team2.score);
    console.log("Maps:", details.maps.map(m => ({name: m.name, status: m.status})));
}
test().catch(console.error);
