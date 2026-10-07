import { getMatchUrlsFromResultsPage } from './scrapeMatchData.js';
const urls = await getMatchUrlsFromResultsPage(1);
console.log('Total:', urls.length);
console.log('Includes 753459?', urls.some(u => u.includes('753459')));
