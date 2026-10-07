import { getMatchUrlsFromMainPage } from './scrapeMatchData.js';
const urls = await getMatchUrlsFromMainPage();
console.log('Total:', urls.length);
console.log('Includes 753459?', urls.some(u => u.includes('753459')));
