import axios from 'axios';
import * as cheerio from 'cheerio';
import { sendNotification } from './notifications.js';

// =============================================================================
// Main Exported Functions
// =============================================================================

/**
 * Fetches and parses a single VLR.gg match page for its detailed data,
 * including map-by-map stats.
 * @param {string} matchUrl - The full URL of the VLR.gg match page.
 * @returns {Promise<Object|null>} A promise that resolves to the detailed match data object, or null on failure.
 */
export async function getVlrMatchDetails(matchUrl) {
    try {
        const html = await fetchHtml(matchUrl);
        const vlrId = matchUrl.split('/')[3];
        if (!vlrId || isNaN(parseInt(vlrId, 10))) {
            throw new Error(`Could not parse a valid vlrId from URL: ${matchUrl}`);
        }

        const matchData = await parseDetailedMatchData(html, vlrId);

        // Validate mandatory fields - discard if not met
        if (!matchData.time) {
            console.warn(`⚠️ Discarding match ${vlrId}: missing mandatory timestamp`);
            return null;
        }

        // Maps can be empty (but not null) - this is allowed
        if (matchData.maps === null) {
            console.warn(`⚠️ Discarding match ${vlrId}: maps data is null`);
            return null;
        }

        // Discard matches where both teams are TBD (To Be Determined)
        if (matchData.team1.name === 'TBD' && matchData.team2.name === 'TBD') {
            return null;
        }

        return matchData;
    } catch (error) {
        console.error(`❌ Failure in getVlrMatchDetails for ${matchUrl}: ${error.message}`);
        return null;
    }
}

/**
 * Scrapes the main VLR.gg matches page to get match URLs (live/upcoming).
 * @returns {Promise<Array>} A promise that resolves to an array of match URLs.
 */
export async function getMatchUrlsFromMainPage() {
    const url = 'https://www.vlr.gg/matches';
    console.log(`[Scraper] 📄 Scraping main matches page`);
    try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const matchUrls = [];

        const allMatches = $('div.col-container a.match-item');

        allMatches.each((_, element) => {
            const $match = $(element);
            const matchHref = $match.attr('href');
            if (matchHref) {
                const matchUrl = `https://www.vlr.gg${matchHref}`;
                matchUrls.push(matchUrl);
            }
        });

        return matchUrls;
    } catch (error) {
        console.error(`❌ Error scraping main matches page:`, error.message);
        return [];
    }
}

/**
 * Scrapes a VLR.gg results page to get match URLs.
 * @param {number} pageNumber - The page number to scrape (e.g., 1, 2, 3...).
 * @returns {Promise<Array>} A promise that resolves to an array of match URLs from that page.
 */
export async function getMatchUrlsFromResultsPage(pageNumber = 1) {
    const url = `https://www.vlr.gg/matches/results/?page=${pageNumber}`;
    console.log(`[Scraper] 📄 Scraping results page: ${pageNumber}`);
    try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const matchUrls = [];

        const allMatches = $('div.col-container a.match-item');

        allMatches.each((_, element) => {
            const $match = $(element);
            const matchHref = $match.attr('href');
            if (matchHref) {
                const matchUrl = `https://www.vlr.gg${matchHref}`;
                matchUrls.push(matchUrl);
            }
        });

        return matchUrls;
    } catch (error) {
        console.error(`❌ Error scraping results page ${pageNumber}:`, error.message);
        return [];
    }
}

// =============================================================================
// Core Scraper & HTML Fetcher
// =============================================================================

/**
 * Fetches the HTML content of a given URL.
 * This is the single entry point for all HTTP requests.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<string>} The HTML content of the page.
 */
async function fetchHtml(url) {
    try {
        const {
            data
        } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        return data;
    } catch (error) {
        console.error(`❌ Failed to fetch page at ${url}:`, error.message);

        if (error.code === 'ECONNREFUSED') {
            await sendNotification(
                'VLR Scraper Connection Error',
                `Failed to connect to ${url}. **Reason: ECONNREFUSED**. The site might be down or blocking the scraper.`
            );
        }

        throw error;
    }
}

// =============================================================================
// Parsing Helper Functions
// =============================================================================

/**
 * Parses the round history for a single map.
 * @param {cheerio.Cheerio<cheerio.Element>} $gameContainer - The Cheerio element for a map's stats container.
 * @param {string} team1Name - The name of the first team.
 * @param {string} team2Name - The name of the second team.
 * @param {cheerio.CheerioAPI} $ - The cheerio instance.
 * @returns {Array<Object>} An array of objects, each representing a round.
 */
function parseRoundsData($gameContainer, team1Name, team2Name, $) {
    const rounds = [];
    // Select all round columns, skipping the first one which contains team names
    const $roundCols = $gameContainer.find('.vlr-rounds-row-col:not(:first-child)');

    $roundCols.each((_, col) => {
        const $col = $(col);
        const roundNumberText = $col.find('.rnd-num').text().trim();
        if (!roundNumberText) return; // Skip non-round columns like spacers

        const roundNumber = parseInt(roundNumberText, 10);
        const $squares = $col.find('.rnd-sq');
        const $winnerSq = $squares.filter('.mod-win');

        let winningTeam = null;
        let winCondition = null;

        if ($winnerSq.length > 0) {
            // Determine winner by index (0 for team1, 1 for team2)
            winningTeam = $squares.index($winnerSq) === 0 ? team1Name : team2Name;

            // Extract win condition from the image src
            const imgSrc = $winnerSq.find('img').attr('src');
            if (imgSrc) {
                const match = imgSrc.match(/\/([a-z]+)\.webp$/);
                if (match && match[1]) {
                    winCondition = match[1]; // e.g., 'elim', 'defuse', 'boom', 'time'
                }
            }
        }

        rounds.push({
            roundNumber,
            winningTeam,
            winCondition,
        });
    });

    return rounds;
}

/**
 * Parses the HTML of a specific match page for detailed information.
 * @param {string} html - The HTML content of the match page.
 * @param {string} vlrId - The VLR match ID.
 * @returns {Promise<Object>} Detailed match data.
 */
export async function parseDetailedMatchData(html, vlrId) {
    const $ = cheerio.load(html);

    // Helper to normalize map names: remove hyphens then trim spaces
    const normalizeMapName = (name) => {
        if (!name) return '';
        return name.replace(/-/g, '').trim();
    };

    // Inner helper to parse the pick/ban note string.
    const parsePicks = (noteText) => {
        const picks = {};
        if (!noteText) return picks;
        const parts = noteText.split(';').map(p => p.trim());
        for (const part of parts) {
            if (part.toLowerCase().includes('pick')) {
                const words = part.split(' '); // e.g., ['TL', 'pick', 'Corrode']
                if (words.length >= 3) {
                    picks[words[2]] = words[0]; // { 'Corrode': 'TL' }
                }
            }
        }
        return picks;
    };

    // Inner helper to parse a table of player stats for a specific map.
    const parsePlayerStatsTable = ($container, team1Name, team2Name, $, options = { includeAgent: true }) => {
        const players = [];

        const parseNum = ($el) => {
            if (!$el || $el.length === 0) return 0;
            const text = $el.find('.side.mod-both').text().trim() || $el.text().trim();
            const cleaned = text.replace('%', '').replace('+', '').trim();
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        };

        // 1. Try parsing modern VLR .ovw-table layout
        const $ovwTable = $container.find('.ovw-table');
        if ($ovwTable.length > 0) {
            const $rows = $ovwTable.find('.ovw-row:not(.mod-head)');
            $rows.each((idx, row) => {
                const $row = $(row);
                const playerName = $row.find('.ovw-player-name').text().trim();
                if (!playerName) return;

                const playerTag = $row.find('.ovw-player-tag').text().trim();
                const playerLink = $row.find('a[href*="/player/"]').attr('href');
                let playerId = null;
                if (playerLink) {
                    const match = playerLink.match(/\/player\/(\d+)\//);
                    if (match && match[1]) playerId = match[1];
                }

                let agentName = null;
                let agentIconUrl = null;
                if (options.includeAgent) {
                    const agentImg = $row.find('.stats-sq.mod-agent img, .mod-agent img').first();
                    agentName = agentImg.attr('title') || agentImg.attr('alt') || null;
                    agentIconUrl = agentImg.attr('src') || null;
                    if (agentIconUrl && agentIconUrl.startsWith('/')) {
                        agentIconUrl = `https://www.vlr.gg${agentIconUrl}`;
                    }
                }

                let assignedTeam = team1Name;
                if (playerTag) {
                    if (team2Name.toLowerCase().includes(playerTag.toLowerCase()) || playerTag.toLowerCase() === team2Name.toLowerCase()) {
                        assignedTeam = team2Name;
                    } else if (idx >= 5) {
                        assignedTeam = team2Name;
                    }
                } else if (idx >= 5) {
                    assignedTeam = team2Name;
                }

                const $cells = $row.find('.ovw-cell');
                const $kCell = $cells.eq(3).find('[data-col="kills"]');
                const $dCell = $cells.eq(3).find('[data-col="deaths"]');
                const $aCell = $cells.eq(3).find('[data-col="assists"]');

                let kills = parseNum($kCell);
                let deaths = parseNum($dCell);
                let assists = parseNum($aCell);

                if (!$kCell.length) {
                    const kdaText = $cells.eq(3).text().trim();
                    const parts = kdaText.split('/').map(p => parseInt(p.trim(), 10));
                    if (parts.length >= 3) {
                        kills = !isNaN(parts[0]) ? parts[0] : 0;
                        deaths = !isNaN(parts[1]) ? parts[1] : 0;
                        assists = !isNaN(parts[2]) ? parts[2] : 0;
                    }
                }

                players.push({
                    playerId,
                    playerName,
                    teamName: assignedTeam,
                    agent: { name: agentName, iconUrl: agentIconUrl },
                    stats: {
                        kills,
                        deaths,
                        assists,
                        acs: parseNum($cells.eq(2)),
                        adr: parseNum($cells.eq(6)),
                        kastPercent: parseNum($cells.eq(5)),
                        headshotPercent: parseNum($cells.eq(7)),
                        firstKills: parseNum($cells.eq(8)),
                        firstDeaths: parseNum($cells.eq(9)),
                        rating: parseNum($cells.eq(1)),
                    },
                });
            });

            if (players.length > 0) return players;
        }

        // 2. Fallback to old .wf-table-inset format
        const $tables = $container.find('.wf-table-inset');
        $tables.each((tIdx, tbl) => {
            const currentTeam = tIdx === 0 ? team1Name : team2Name;
            const $rows = $(tbl).find('tbody tr');
            $rows.each((_, row) => {
                const $row = $(row);
                const playerName = $row.find('.mod-player .text-of').text().trim();
                if (!playerName) return;

                const playerLink = $row.find('.mod-player a').attr('href');
                let playerId = null;
                if (playerLink) {
                    const match = playerLink.match(/\/player\/(\d+)\//);
                    if (match && match[1]) playerId = match[1];
                }

                let agentName = null;
                let agentIconUrl = null;
                if (options.includeAgent) {
                    const agentImg = $row.find('.mod-agent img');
                    agentName = agentImg.attr('title') || null;
                    agentIconUrl = agentImg.attr('src') || null;
                    if (agentIconUrl && agentIconUrl.startsWith('/')) {
                        agentIconUrl = `https://www.vlr.gg${agentIconUrl}`;
                    }
                }

                const parseStat = (statClass) => {
                    const text = $row.find(statClass).find('.side.mod-both').text().trim();
                    const num = parseFloat(text.replace('%', ''));
                    return isNaN(num) ? 0 : num;
                };

                players.push({
                    playerId,
                    playerName,
                    teamName: currentTeam,
                    agent: { name: agentName, iconUrl: agentIconUrl },
                    stats: {
                        kills: parseStat('.mod-vlr-kills'),
                        deaths: parseStat('.mod-vlr-deaths'),
                        assists: parseStat('.mod-vlr-assists'),
                        acs: parseStat('td:nth-child(4)'),
                        adr: parseStat('.mod-combat'),
                        kastPercent: parseStat('td:nth-child(9)'),
                        headshotPercent: parseStat('td:nth-child(11)'),
                        firstKills: parseStat('.mod-fb'),
                        firstDeaths: parseStat('.mod-fd'),
                        rating: parseStat('td:nth-child(3)'),
                    },
                });
            });
        });

        return players;
    };

    // --- Main Parsing Logic ---
    let overallStatus = 'upcoming';
    const statusText = $('.match-header-vs-note').first().text().toLowerCase();
    if (statusText.includes('live')) overallStatus = 'live';
    else if (statusText.includes('final') || statusText.includes('forfeited')) overallStatus = 'completed';

    // Extract event info from match-header-super
    const eventLink = $('.match-header-super .match-header-event').attr('href');
    let eventId = null;
    if (eventLink) {
        const eventMatch = eventLink.match(/\/event\/(\d+)\//);
        if (eventMatch && eventMatch[1]) {
            eventId = eventMatch[1];
        }
    }

    const eventName = cleanText($('.match-header-super .match-header-event div[style*="font-weight: 700"]').text());
    const eventSeries = cleanText($('.match-header-super .match-header-event-series').text());

    // Extract patch number from match-header-date (if present)
    let patch = null;
    try {
        const $patchDivs = $('.match-header-date div');
        $patchDivs.each((_, el) => {
            const text = $(el).text();
            if (!text) return;
            const lower = text.toLowerCase();
            if (lower.includes('patch')) {
                const match = text.match(/patch\s*([0-9.]+)/i);
                if (match && match[1]) {
                    patch = match[1].trim();
                } else {
                    // If no number captured, store the cleaned text (fallback)
                    patch = text.trim();
                }
                return false;
            }
        });
    } catch (e) {
        patch = null;
    }

    // Extract timestamp from match-header-date
    const timestampElement = $('.match-header-date .moment-tz-convert[data-utc-ts]').first();
    const rawTimestamp = timestampElement.attr('data-utc-ts');
    if (!rawTimestamp) {
        throw new Error('Mandatory timestamp not found');
    }

    // Parse and standardize the timestamp (format: "2025-09-06 14:00:00")
    const timestamp = parseUtcTimestamp(rawTimestamp);
    if (!timestamp) {
        throw new Error('Invalid timestamp format');
    }

    // Normalize map names in picks keys to ensure lookup works after normalization
    const rawMapPicks = parsePicks($('.match-header-note').text());
    const mapPicks = Object.keys(rawMapPicks).reduce((acc, key) => {
        acc[normalizeMapName(key)] = rawMapPicks[key];
        return acc;
    }, {});

    const team1Name = $('.match-header-link.mod-1 .wf-title-med').text().trim();
    const team2Name = $('.match-header-link.mod-2 .wf-title-med').text().trim();
    const $scoreContainer = $('.match-header-vs-score').first();
    const scoreSpans = $scoreContainer.find('span:not(.match-header-vs-score-colon):not(.match-header-vs-note)');
    let team1OverallScore = parseInt(scoreSpans.eq(0).text().trim(), 10) || 0;
    let team2OverallScore = parseInt(scoreSpans.eq(1).text().trim(), 10) || 0;
    const teamShortNameElements = $('.vlr-rounds-row .team');
    const team1ShortName = teamShortNameElements.eq(0).clone().children().remove().end().text().trim() || team1Name;
    const team2ShortName = teamShortNameElements.eq(1).clone().children().remove().end().text().trim() || team2Name;

    // Extract team IDs from anchor links
    const team1Link = $('.match-header-link.mod-1').attr('href');
    const team2Link = $('.match-header-link.mod-2').attr('href');
    let team1Id = null;
    let team2Id = null;

    if (team1Link) {
        const match1 = team1Link.match(/\/team\/(\d+)\//);
        if (match1 && match1[1]) {
            team1Id = match1[1];
        }
    }

    if (team2Link) {
        const match2 = team2Link.match(/\/team\/(\d+)\//);
        if (match2 && match2[1]) {
            team2Id = match2[1];
        }
    }

    // Extract team logo URLs
    const fixUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('//')) return `https:${url}`;
        if (url.startsWith('/')) return `https://www.vlr.gg${url}`;
        return url;
    };
    const team1LogoUrl = fixUrl($('.match-header-link.mod-1 img').attr('src')) || 'https://www.vlr.gg/img/vlr/tmp/vlr.png';
    const team2LogoUrl = fixUrl($('.match-header-link.mod-2 img').attr('src')) || 'https://www.vlr.gg/img/vlr/tmp/vlr.png';

    const maps = [];

    // Parse "All Maps" tab data
    if (overallStatus === 'completed') {
        const $allMapsNav = $('.vm-stats-gamesnav-item.mod-all').first();
        const allGameId = $allMapsNav.data('game-id');
        const $allContainer = allGameId ? $(`.vm-stats-game[data-game-id="${allGameId}"]`) : $('.vm-stats-game.mod-all');
        if ($allContainer && $allContainer.length > 0) {
            const statsAll = parsePlayerStatsTable($allContainer, team1Name, team2Name, $, { includeAgent: false });

            maps.push({
                name: 'All Maps',
                status: 'completed',
                pickedBy: null,
                team1Score: 0,
                team2Score: 0,
                stats: statsAll,
                rounds: null,
            });
        }
    }

    // First try to find maps using the gamesnav items (multiple maps case)
    $('.vm-stats-gamesnav-item:not(.mod-all)').each((_, el) => {
        const $el = $(el);
        const mapNameRaw = $el.find('div[style*="margin-bottom"]').text().replace(/\d/g, '').trim();
        const mapName = normalizeMapName(mapNameRaw);
        const gameId = $el.data('game-id');
        const $gameContainer = $(`.vm-stats-game[data-game-id="${gameId}"]`);

        let status = 'upcoming'; // Default status
        if ($gameContainer.length > 0) {
            if ($gameContainer.find('.vm-stats-game-header .score.mod-win').length > 0) status = 'completed';
            else if ($el.hasClass('mod-live')) status = 'live';
        }

        const stats = $gameContainer.length ? parsePlayerStatsTable($gameContainer, team1Name, team2Name, $, { includeAgent: true }) : [];

        const rounds = $gameContainer.length ? parseRoundsData($gameContainer, team1Name, team2Name, $) : [];

        maps.push({
            name: mapName,
            status: status,
            pickedBy: mapPicks[mapName] || null,
            team1Score: parseInt($gameContainer.find('.vm-stats-game-header .team').first().find('.score').text().trim(), 10) || 0,
            team2Score: parseInt($gameContainer.find('.vm-stats-game-header .team').last().find('.score').text().trim(), 10) || 0,
            stats: stats,
            rounds: rounds,
        });
    });

    // If no maps found via gamesnav, try the single map case with vm-stats-container
    if (maps.length === 0) {
        const $statsContainer = $('.vm-stats .vm-stats-container');
        if ($statsContainer.length > 0) {
            // Extract map name from stats container
            const mapNameElement = $statsContainer.find('.vm-stats-game-header .map').first();
            const mapName = normalizeMapName((mapNameElement.length > 0 ? mapNameElement.text() : 'Unknown Map')
                .replace(/\d/g, '')
                .replace(/\s+/g, ' ')
                .replace(/[:\t\n\r]+/g, '')
                .trim());

            const $gameContainer = $statsContainer.find('.vm-stats-game').first();

            let status = 'upcoming'; // Default status
            if ($gameContainer.length > 0) {
                if ($gameContainer.find('.vm-stats-game-header .score.mod-win').length > 0) status = 'completed';
                else if ($statsContainer.find('.mod-live').length > 0) status = 'live';
            }

            const stats = $gameContainer.length ? parsePlayerStatsTable($gameContainer, team1Name, team2Name, $, { includeAgent: true }) : [];

            const rounds = $gameContainer.length ? parseRoundsData($gameContainer, team1Name, team2Name, $) : [];

            maps.push({
                name: mapName,
                status: status,
                pickedBy: mapPicks[mapName] || null,
                team1Score: parseInt($gameContainer.find('.vm-stats-game-header .team').first().find('.score').text().trim(), 10) || 0,
                team2Score: parseInt($gameContainer.find('.vm-stats-game-header .team').last().find('.score').text().trim(), 10) || 0,
                stats: stats,
                rounds: rounds,
            });
        }
    }



    // Calculate overall map wins from completed maps as fallback/verification
    const team1MapWins = maps.filter(m => m.name !== 'All Maps' && m.status === 'completed' && m.team1Score > m.team2Score).length;
    const team2MapWins = maps.filter(m => m.name !== 'All Maps' && m.status === 'completed' && m.team2Score > m.team1Score).length;

    team1OverallScore = Math.max(team1OverallScore, team1MapWins);
    team2OverallScore = Math.max(team2OverallScore, team2MapWins);

    // Adjust map statuses if the whole match is completed but some maps weren't played
    if (overallStatus === 'completed') {
        maps.forEach(map => {
            if (map.status === 'upcoming') map.status = 'unplayed';
        });
    }

    return {
        vlrId,
        status: overallStatus,
        time: timestamp,
        patch,
        team1: {
            teamId: team1Id,
            name: team1Name,
            shortName: team1ShortName,
            score: team1OverallScore,
            logoUrl: team1LogoUrl
        },
        team2: {
            teamId: team2Id,
            name: team2Name,
            shortName: team2ShortName,
            score: team2OverallScore,
            logoUrl: team2LogoUrl
        },
        event: {
            eventId: eventId,
            name: eventName,
            series: eventSeries
        },
        maps,
    };
}

// =============================================================================
// Utility Helper Functions
// =============================================================================

/**
 * Cleans up text by normalizing whitespace.
 * @param {string} text - The input string.
 * @returns {string} The cleaned string.
 */
function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parses a UTC timestamp string and converts it to ISO format.
 * @param {string} utcTimestamp - The UTC timestamp string (e.g., "2025-09-06 14:00:00").
 * @returns {string|null} The ISO timestamp or null if parsing fails.
 */
function parseUtcTimestamp(utcTimestamp) {
    if (!utcTimestamp) return null;

    try {
        // Clean the timestamp string
        const cleanTimestamp = utcTimestamp.trim();

        // Parse the UTC timestamp and convert to ISO string
        const date = new Date(cleanTimestamp + ' UTC');

        if (isNaN(date.getTime())) {
            console.error(`Invalid UTC timestamp format: "${utcTimestamp}"`);
            return null;
        }

        return date.toISOString();
    } catch (error) {
        console.error(`Error parsing UTC timestamp: "${utcTimestamp}"`, error);
        return null;
    }
}