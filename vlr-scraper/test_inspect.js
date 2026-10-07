import axios from 'axios';
import * as cheerio from 'cheerio';

async function testScoreParsing() {
    const url = 'https://www.vlr.gg/753455';
    const { data: html } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(html);

    const $scoreDiv = $('.match-header-vs-score').first();
    const scoreSpans = $scoreDiv.find('span:not(.match-header-vs-score-colon):not(.match-header-vs-note)');
    console.log('Score spans count:', scoreSpans.length);
    scoreSpans.each((i, el) => {
        console.log(`Score Span ${i}: "${$(el).text().trim()}"`);
    });

    const team1Score = parseInt(scoreSpans.eq(0).text().trim(), 10) || 0;
    const team2Score = parseInt(scoreSpans.eq(1).text().trim(), 10) || 0;

    console.log(`Parsed overall scores: Team1=${team1Score}, Team2=${team2Score}`);
}

testScoreParsing().catch(console.error);
