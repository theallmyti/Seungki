import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const { data: html } = await axios.get('https://www.vlr.gg/753459', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(html);
    console.log("VS Note:", $('.match-header-vs-note').first().text().trim());
    console.log("Score 1:", $('.match-header-vs-score span').eq(0).text().trim());
    console.log("Score 2:", $('.match-header-vs-score span').eq(1).text().trim());
    console.log("Score 3:", $('.match-header-vs-score span').eq(2).text().trim());
    
    // Check if there is a LIVE indicator somewhere else
    console.log("Is LIVE present anywhere in match-header-vs?", $('.match-header-vs').text().includes('LIVE'));
    console.log("Raw match-header-vs text:", $('.match-header-vs').text().replace(/\s+/g, ' '));
}
test().catch(console.error);
