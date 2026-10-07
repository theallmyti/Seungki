import { useLocalSearchParams } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Dimensions } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState, useEffect, useRef } from 'react';
import { Colors } from '../../theme/colors';
import { ErrorState } from '../../components/LoadingStates';
import { MatchDetailSkeleton } from '../../components/SkeletonLoaders';
import { useNetwork } from '../../providers/NetworkProvider';
import { normalizeLogoUrl } from '../../utils/image';

// Type definitions based on the Convex schema
interface PlayerStats {
    playerId: string | null;
    playerName: string;
    teamName: string;
    agent: {
        name: string | null;
        iconUrl: string | null;
    };
    stats: {
        kills: number;
        deaths: number;
        assists: number;
        acs: number;
        adr: number;
        kastPercent: number;
        headshotPercent: number;
        firstKills: number;
        firstDeaths: number;
        rating: number;
    };
}

interface MapData {
    name: string;
    status: string;
    pickedBy: string | null;
    team1Score: number;
    team2Score: number;
    stats: PlayerStats[];
    rounds: Array<{
        roundNumber: number;
        winningTeam: string | null;
        winCondition: string | null;
    }>;
}

interface MatchData {
    vlrId: string;
    status: 'live' | 'upcoming' | 'completed';
    time: string;
    patch: string | null;
    team1: {
        teamId: string | null;
        name: string;
        shortName: string;
        score: number;
        logoUrl: string;
    };
    team2: {
        teamId: string | null;
        name: string;
        shortName: string;
        score: number;
        logoUrl: string;
    };
    event: {
        eventId: string | null;
        name: string;
        series: string;
    };
    maps: MapData[];
}

// Custom hook for dynamic dimensions
const useDimensions = () => {
    const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setDimensions(window);
        });

        return () => subscription?.remove();
    }, []);

    return dimensions;
};



// Helper to robustly display a map name
const getMapDisplayName = (name: string | null | undefined) => {
    if (!name) return 'No Map Provided';
    const trimmed = name.trim();
    if (trimmed.length === 0) return 'No Map Provided';
    if (trimmed.toUpperCase().startsWith('TBD')) return 'No Map Provided';
    return trimmed;
};

// Match header component
const MatchHeader = ({ match }: { match: MatchData }) => (
    <View style={styles.matchHeader}>
        <View style={styles.eventInfo}>
            <Text
                style={styles.eventName}
                accessibilityRole="link"
                accessibilityHint="Opens event page in in-app browser"
                onPress={() => {
                    if (match.event.eventId) {
                        WebBrowser.openBrowserAsync(`https://www.vlr.gg/event/${match.event.eventId}/`);
                    }
                }}
            >
                {match.event.name}
            </Text>
            <Text style={styles.eventSeries}>{match.event.series}</Text>
            {match.patch && (
                <Text style={styles.eventPatch}>Patch {match.patch}</Text>
            )}
        </View>

        <View style={styles.teamsContainer}>
            <View style={styles.teamHeaderSection}>
                <Pressable
                    accessibilityRole="link"
                    accessibilityHint="Opens team page in in-app browser"
                    onPress={() => {
                        if (match.team1.teamId) {
                            WebBrowser.openBrowserAsync(`https://www.vlr.gg/team/${match.team1.teamId}/`);
                        }
                    }}
                    style={{ alignItems: 'center' }}
                >
                    <Text style={styles.teamName} numberOfLines={2} ellipsizeMode="tail">{match.team1.name}</Text>
                </Pressable>
            </View>

            <View style={styles.scoreSection}>
                <Text style={styles.scoreText}>{match.team1.score} - {match.team2.score}</Text>
                <View style={[styles.statusBadge, match.status === 'live' && styles.liveBadge]}>
                    <Text style={[styles.statusText, match.status === 'live' && styles.liveText]}>
                        {match.status.toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.teamHeaderSection}>
                <Pressable
                    accessibilityRole="link"
                    accessibilityHint="Opens team page in in-app browser"
                    onPress={() => {
                        if (match.team2.teamId) {
                            WebBrowser.openBrowserAsync(`https://www.vlr.gg/team/${match.team2.teamId}/`);
                        }
                    }}
                    style={{ alignItems: 'center' }}
                >
                    <Text style={styles.teamName} numberOfLines={2} ellipsizeMode="tail">{match.team2.name}</Text>
                </Pressable>
            </View>
        </View>
    </View>
);

// Map tab component
const MapTab = ({ map, isActive, onPress }: { map: MapData; isActive: boolean; onPress: () => void }) => (
    <Pressable
        style={[styles.mapTab, isActive && styles.activeMapTab, map.status === 'live' && styles.liveMapTab]}
        onPress={onPress}
    >
        <View style={styles.mapTabContent}>
            <Text style={[styles.mapTabText, isActive && styles.activeMapTabText]}>
                {getMapDisplayName(map.name)}
            </Text>
            {map.status === 'live' && (
                <View style={styles.liveDot} />
            )}
        </View>
    </Pressable>
);

// Win condition icon component
const WinConditionIcon = ({ condition }: { condition: string | null }) => {
    if (!condition) return null;

    const iconUrl = normalizeLogoUrl(`https://www.vlr.gg/img/vlr/game/round/${condition}.webp`);

    return (
        <Image
            source={{ uri: iconUrl }}
            style={styles.winConditionIcon}
            resizeMode="contain"
        />
    );
};

// Round timeline component
const RoundTimeline = ({ map, match }: { map: MapData; match: MatchData }) => {
    const [pressedRound, setPressedRound] = useState<number | null>(null);
    const scrollRef = useRef<ScrollView | null>(null);
    const didAutoScrollRef = useRef(false);
    const roundPositionsRef = useRef<{ [key: number]: number }>({});
    const [viewportWidth, setViewportWidth] = useState<number | null>(null);

    const getTeamColor = (teamName: string | null) => {
        if (!teamName) return Colors.textMuted;
        return teamName === match.team1.name ? '#3b82f6' : '#FF4655';
    };

    const getTeamShortName = (teamName: string | null) => {
        if (!teamName) return 'TBD';
        return teamName === match.team1.name ? match.team1.shortName : match.team2.shortName;
    };

    const getWinConditionText = (condition: string | null) => {
        switch (condition) {
            case 'elim': return 'Elimination';
            case 'boom': return 'Bomb Exploded';
            case 'defuse': return 'Bomb Defused';
            case 'time': return 'Time Expired';
            default: return 'TBD';
        }
    };

    const getScoreAtRound = (roundNumber: number) => {
        const completedRounds = map.rounds.filter(round =>
            round.roundNumber <= roundNumber && round.winningTeam !== null
        );
        const team1Wins = completedRounds.filter(round => round.winningTeam === match.team1.name).length;
        const team2Wins = completedRounds.filter(round => round.winningTeam === match.team2.name).length;
        return { team1Wins, team2Wins };
    };

    const filteredRounds = map.rounds.filter(round =>
        map.status === 'completed' ? round.winCondition !== null : true
    );
    const completedRounds = map.rounds.filter(round => round.winningTeam !== null);
    const team1Wins = completedRounds.filter(round => round.winningTeam === match.team1.name).length;
    const team2Wins = completedRounds.filter(round => round.winningTeam === match.team2.name).length;

    useEffect(() => {
        if (map.status !== 'live') return;
        if (didAutoScrollRef.current) return;
        if (!Array.isArray(filteredRounds) || filteredRounds.length === 0) return;

        // Find last completed round index within filteredRounds
        let lastCompletedIndex: number | undefined = undefined;
        for (let i = filteredRounds.length - 1; i >= 0; i--) {
            const r = filteredRounds[i];
            if (r.winningTeam !== null && r.winCondition !== null) {
                lastCompletedIndex = i;
                break;
            }
        }

        if (lastCompletedIndex === undefined) {
            didAutoScrollRef.current = true;
            return;
        }

        const x = roundPositionsRef.current[lastCompletedIndex];
        if (typeof x === 'number' && typeof viewportWidth === 'number') {
            // Defer to ensure layouts are committed
            setTimeout(() => {
                const roundCenterX = x + 30;
                const targetOffset = Math.max(roundCenterX - viewportWidth / 2, 0);
                scrollRef.current?.scrollTo({ x: targetOffset, animated: true });
            }, 0);
            didAutoScrollRef.current = true;
        }
    }, [map.status, filteredRounds.length, viewportWidth]);

    return (
        <View style={styles.timelineContainer}>
            <View style={styles.timelineHeader}>
                <Text style={styles.timelineTitle} allowFontScaling={false}>Round Timeline</Text>
                <View style={styles.timelineScore}>
                    <Text style={[styles.timelineScoreText, { color: '#3b82f6' }]} allowFontScaling={false}>
                        {match.team1.shortName} {team1Wins}
                    </Text>
                    <Text style={styles.timelineScoreText} allowFontScaling={false}> - </Text>
                    <Text style={[styles.timelineScoreText, { color: '#FF4655' }]} allowFontScaling={false}>
                        {team2Wins} {match.team2.shortName}
                    </Text>
                </View>
            </View>

            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.timelineScrollView}
                contentContainerStyle={styles.timelineContent}
                onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
            >
                {filteredRounds.map((round, index) => {
                    const isCompleted = round.winningTeam !== null && round.winCondition !== null;
                    const isPressed = pressedRound === round.roundNumber;
                    const teamColor = getTeamColor(round.winningTeam);
                    const isLastRound = index === filteredRounds.length - 1;
                    const scoreAtRound = getScoreAtRound(round.roundNumber);

                    return (
                        <View
                            key={round.roundNumber}
                            style={styles.roundContainer}
                            onLayout={(e) => {
                                roundPositionsRef.current[index] = e.nativeEvent.layout.x;
                            }}
                        >
                            <Pressable
                                style={[
                                    styles.roundItem,
                                    isCompleted && styles.completedRound,
                                    !isCompleted && styles.pendingRound,
                                    { borderColor: isCompleted ? teamColor : Colors.divider }
                                ]}
                                onPressIn={() => setPressedRound(round.roundNumber)}
                                onPressOut={() => setPressedRound(null)}
                            >
                                <Text style={[
                                    styles.roundNumber,
                                    { color: isCompleted ? teamColor : Colors.textMuted }
                                ]} allowFontScaling={false}>
                                    {round.roundNumber}
                                </Text>

                                {isCompleted && (
                                    <View style={styles.roundDetails}>
                                        <Text style={[styles.winningTeam, { color: teamColor }]} allowFontScaling={false}>
                                            {getTeamShortName(round.winningTeam)}
                                        </Text>
                                        <WinConditionIcon condition={round.winCondition} />
                                    </View>
                                )}

                                {!isCompleted && (
                                    <Text style={styles.pendingText} allowFontScaling={false}>TBD</Text>
                                )}
                            </Pressable>

                            {/* Press and hold popup */}
                            {isPressed && isCompleted && (
                                <View style={styles.roundPopup}>
                                    <Text style={styles.popupScore} allowFontScaling={false}>
                                        {scoreAtRound.team1Wins} - {scoreAtRound.team2Wins}
                                    </Text>
                                    <Text style={styles.popupWinCondition} allowFontScaling={false}>
                                        {getWinConditionText(round.winCondition)}
                                    </Text>
                                </View>
                            )}

                            {/* Connecting line to next round */}
                            {!isLastRound && (
                                <View style={[
                                    styles.connectingLine,
                                    { backgroundColor: isCompleted ? teamColor : Colors.divider }
                                ]} />
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
};


// New component for just the player stats data
const PlayerStatsData = ({ player, mapStatus }: { player: PlayerStats; mapStatus: string }) => {
    const plusMinus = player.stats.kills - player.stats.deaths;

    const getPlusMinusColor = (value: number) => {
        if (value > 0) return '#10B981'; // Green for positive
        if (value < 0) return '#EF4444'; // Red for negative
        return Colors.textPrimary; // Normal color for zero
    };

    return (
        <>
            <Text style={styles.killsText} allowFontScaling={false}>{player.stats.kills}</Text>
            <Text style={styles.deathsText} allowFontScaling={false}>{player.stats.deaths}</Text>
            <Text style={styles.assistsText} allowFontScaling={false}>{player.stats.assists}</Text>
            <Text style={[styles.plusMinusText, { color: getPlusMinusColor(plusMinus) }]} allowFontScaling={false}>
                {plusMinus > 0 ? `+${plusMinus}` : plusMinus < 0 ? `${plusMinus}` : ` 0`}
            </Text>
            <Text style={styles.acsText} allowFontScaling={false}>{mapStatus === 'live' ? '' : player.stats.acs}</Text>
            <Text style={styles.adrText} allowFontScaling={false}>{mapStatus === 'live' ? '' : player.stats.adr}</Text>
            <Text style={styles.hsText} allowFontScaling={false}>{player.stats.headshotPercent}%</Text>
            <Text style={styles.fkText} allowFontScaling={false}>{player.stats.firstKills}</Text>
            <Text style={styles.fdText} allowFontScaling={false}>{player.stats.firstDeaths}</Text>
            <Text style={styles.ratingText} allowFontScaling={false}>{mapStatus === 'live' ? '' : (player.stats.rating || 0).toFixed(2)}</Text>
            <Text style={styles.kastText} allowFontScaling={false}>{(player.stats.kastPercent || 0)}%</Text>
        </>
    );
};

// Agents row for All Maps: shows unique agent icons from other maps below player name
const PlayerAgentsFromOtherMaps = ({ player, match }: { player: PlayerStats; match: MatchData }) => {
    const playerKey = player.playerId ?? `name:${player.playerName}`;
    const iconsSet = new Set<string>();
    for (const m of match.maps) {
        if (m?.name?.trim().toLowerCase() === 'all maps') continue;
        const found = m.stats.find(s => (s.playerId ?? `name:${s.playerName}`) === playerKey);
        const url = found?.agent?.iconUrl ?? undefined;
        if (url) iconsSet.add(url);
    }
    const icons = Array.from(iconsSet);
    if (icons.length === 0) return null;
    return (
        <View style={styles.playerAgentsRow}>
            {icons.map((url, index) => (
                <Image key={index} source={{ uri: url }} style={styles.agentIconSmall} />
            ))}
        </View>
    );
};

// Wide screen player stats component for larger screens
const WideScreenPlayerStats = ({ map, match }: { map: MapData; match: MatchData }) => {
    const team1Players = map.stats.filter(p => p.teamName === match.team1.name);
    const team2Players = map.stats.filter(p => p.teamName === match.team2.name);
    const isAllMaps = map?.name?.trim().toLowerCase() === 'all maps';

    const getPlayerAgentsFromOtherMaps = (player: PlayerStats): string[] => {
        const playerKey = player.playerId ?? `name:${player.playerName}`;
        const iconsSet = new Set<string>();
        for (const m of match.maps) {
            if (m?.name?.trim().toLowerCase() === 'all maps') continue;
            const found = m.stats.find(s => (s.playerId ?? `name:${s.playerName}`) === playerKey);
            const url = found?.agent?.iconUrl ?? undefined;
            if (url) iconsSet.add(url);
        }
        return Array.from(iconsSet);
    };

    return (
        <View style={styles.wideScreenTableContainer}>
            <View style={styles.wideScreenTable}>
                {/* Header Row */}
                <View style={styles.wideScreenHeaderRow}>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenPlayerHeader]} allowFontScaling={false}>Player</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenKillsHeader]} allowFontScaling={false}>K</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenDeathsHeader]} allowFontScaling={false}>D</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenAssistsHeader]} allowFontScaling={false}>A</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenPlusMinusHeader]} allowFontScaling={false}>+/-</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenAcsHeader]} allowFontScaling={false}>ACS</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenAdrHeader]} allowFontScaling={false}>ADR</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenHsHeader]} allowFontScaling={false}>HS%</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenFkHeader]} allowFontScaling={false}>FK</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenFdHeader]} allowFontScaling={false}>FD</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenRatingHeader]} allowFontScaling={false}>R²</Text>
                    <Text style={[styles.wideScreenHeaderCell, styles.wideScreenKastHeader]} allowFontScaling={false}>KAST</Text>
                </View>

                {/* Team 1 Players */}
                <View style={styles.wideScreenTeamSection}>
                    <Text style={styles.wideScreenTeamLabel} allowFontScaling={false}>{match.team1.shortName}</Text>
                    {team1Players.map((player, index) => {
                        const plusMinus = player.stats.kills - player.stats.deaths;
                        const getPlusMinusColor = (value: number) => {
                            if (value > 0) return '#10B981';
                            if (value < 0) return '#EF4444';
                            return Colors.textPrimary;
                        };

                        return (
                            <View key={index} style={styles.wideScreenPlayerRow}>
                                <Pressable
                                    accessibilityRole="link"
                                    accessibilityHint="Opens player page in in-app browser"
                                    onPress={() => {
                                        if (player.playerId) {
                                            WebBrowser.openBrowserAsync(`https://www.vlr.gg/player/${player.playerId}/`);
                                        }
                                    }}
                                    style={[styles.wideScreenPlayerInfo, isAllMaps && styles.playerInfoAllMaps]}
                                >
                                    {isAllMaps ? (
                                        <>
                                            <Text style={[styles.wideScreenPlayerName, styles.playerNameAllMaps]} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>
                                                {player.playerName}
                                            </Text>
                                            <View style={styles.playerAgentsRow}>
                                                {getPlayerAgentsFromOtherMaps(player).map((url, i) => (
                                                    <Image key={i} source={{ uri: url }} style={styles.agentIconSmall} />
                                                ))}
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            {player.agent.iconUrl && (
                                                <Image source={{ uri: player.agent.iconUrl }} style={styles.agentIcon} />
                                            )}
                                            <Text style={styles.wideScreenPlayerName} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>
                                                {player.playerName}
                                            </Text>
                                        </>
                                    )}
                                </Pressable>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenKillsCell]} allowFontScaling={false}>{player.stats.kills}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenDeathsCell]} allowFontScaling={false}>{player.stats.deaths}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenAssistsCell]} allowFontScaling={false}>{player.stats.assists}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenPlusMinusCell, { color: getPlusMinusColor(plusMinus) }]} allowFontScaling={false}>
                                    {plusMinus > 0 ? `+${plusMinus}` : plusMinus < 0 ? `${plusMinus}` : ` 0`}
                                </Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenAcsCell]} allowFontScaling={false}>
                                    {map.status === 'live' ? '' : player.stats.acs}
                                </Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenAdrCell]} allowFontScaling={false}>
                                    {map.status === 'live' ? '' : player.stats.adr}
                                </Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenHsCell]} allowFontScaling={false}>{player.stats.headshotPercent}%</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenFkCell]} allowFontScaling={false}>{player.stats.firstKills}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenFdCell]} allowFontScaling={false}>{player.stats.firstDeaths}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenRatingCell]} allowFontScaling={false}>
                                    {map.status === 'live' ? '' : (player.stats.rating || 0).toFixed(2)}
                                </Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenKastCell]} allowFontScaling={false}>{(player.stats.kastPercent || 0)}%</Text>
                            </View>
                        );
                    })}
                </View>

                {/* Team 2 Players */}
                <View style={styles.wideScreenTeamSection}>
                    <Text style={styles.wideScreenTeamLabel} allowFontScaling={false}>{match.team2.shortName}</Text>
                    {team2Players.map((player, index) => {
                        const plusMinus = player.stats.kills - player.stats.deaths;
                        const getPlusMinusColor = (value: number) => {
                            if (value > 0) return '#10B981';
                            if (value < 0) return '#EF4444';
                            return Colors.textPrimary;
                        };

                        return (
                            <View key={index} style={styles.wideScreenPlayerRow}>
                                <Pressable
                                    accessibilityRole="link"
                                    accessibilityHint="Opens player page in in-app browser"
                                    onPress={() => {
                                        if (player.playerId) {
                                            WebBrowser.openBrowserAsync(`https://www.vlr.gg/player/${player.playerId}/`);
                                        }
                                    }}
                                    style={[styles.wideScreenPlayerInfo, isAllMaps && styles.playerInfoAllMaps]}
                                >
                                    {isAllMaps ? (
                                        <>
                                            <Text style={[styles.wideScreenPlayerName, styles.playerNameAllMaps]} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>
                                                {player.playerName}
                                            </Text>
                                            <View style={styles.playerAgentsRow}>
                                                {getPlayerAgentsFromOtherMaps(player).map((url, i) => (
                                                    <Image key={i} source={{ uri: url }} style={styles.agentIconSmall} />
                                                ))}
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            {player.agent.iconUrl && (
                                                <Image source={{ uri: player.agent.iconUrl }} style={styles.agentIcon} />
                                            )}
                                            <Text style={styles.wideScreenPlayerName} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>
                                                {player.playerName}
                                            </Text>
                                        </>
                                    )}
                                </Pressable>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenKillsCell]} allowFontScaling={false}>{player.stats.kills}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenDeathsCell]} allowFontScaling={false}>{player.stats.deaths}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenAssistsCell]} allowFontScaling={false}>{player.stats.assists}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenPlusMinusCell, { color: getPlusMinusColor(plusMinus) }]} allowFontScaling={false}>
                                    {plusMinus > 0 ? `+${plusMinus}` : plusMinus < 0 ? `${plusMinus}` : ` 0`}
                                </Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenAcsCell]} allowFontScaling={false}>
                                    {map.status === 'live' ? '' : player.stats.acs}
                                </Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenAdrCell]} allowFontScaling={false}>
                                    {map.status === 'live' ? '' : player.stats.adr}
                                </Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenHsCell]} allowFontScaling={false}>{player.stats.headshotPercent}%</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenFkCell]} allowFontScaling={false}>{player.stats.firstKills}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenFdCell]} allowFontScaling={false}>{player.stats.firstDeaths}</Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenRatingCell]} allowFontScaling={false}>
                                    {map.status === 'live' ? '' : (player.stats.rating || 0).toFixed(2)}
                                </Text>
                                <Text style={[styles.wideScreenDataCell, styles.wideScreenKastCell]} allowFontScaling={false}>{(player.stats.kastPercent || 0)}%</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
};


// Map stats component
const MapStats = ({ map, match }: { map: MapData; match: MatchData }) => {
    const team1Players = map.stats.filter(p => p.teamName === match.team1.name);
    const team2Players = map.stats.filter(p => p.teamName === match.team2.name);
    const { width } = useDimensions();
    const isAllMaps = map?.name?.trim().toLowerCase() === 'all maps';

    const [scrollX, setScrollX] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    const showLeftArrow = scrollX > 0;
    const showRightArrow = scrollX < contentWidth - containerWidth - 10;

    const scrollToLeft = () => {
        scrollViewRef.current?.scrollTo({ x: 0, animated: true });
    };

    const scrollToRight = () => {
        const maxScrollX = contentWidth - containerWidth;
        scrollViewRef.current?.scrollTo({ x: maxScrollX, animated: true });
    };

    // Determine if we should use wide screen layout (tablets and larger screens)
    const isWideScreen = width >= 600; // Breakpoint for wide screens

    return (
        <View style={styles.mapStatsContainer}>
            <View style={styles.mapHeader}>
                <View style={styles.mapInfo}>
                    <View style={styles.mapNameContainer}>
                        <Text style={styles.mapName} allowFontScaling={false}>{getMapDisplayName(map.name)}</Text>
                        {map.status === 'live' && (
                            <View style={styles.mapLiveIndicator}>
                                <View style={styles.mapLiveDot} />
                                <Text style={styles.mapLiveText} allowFontScaling={false}>LIVE</Text>
                            </View>
                        )}
                    </View>
                    {map.pickedBy && (
                        <Text style={styles.mapPickInfo} allowFontScaling={false}>
                            Picked by {map.pickedBy === match.team1.shortName ? match.team1.shortName : match.team2.shortName}
                        </Text>
                    )}
                </View>
                {!(map?.name?.trim().toLowerCase() === 'all maps') && (
                    <Text style={styles.mapScore} allowFontScaling={false}>{map.team1Score} - {map.team2Score}</Text>
                )}
            </View>

            {/* Round Timeline */}
            {(() => {
                const hasAnyCompletedRound = Array.isArray(map.rounds) && map.rounds.some(r => r.winningTeam !== null && r.winCondition !== null);
                const shouldShowTimeline = map.status === 'live' || (map.status === 'completed' && hasAnyCompletedRound);
                return shouldShowTimeline ? (
                    <RoundTimeline map={map} match={match} />
                ) : null;
            })()}

            {/* If the map is upcoming and has no stats yet, show notice */}
            {(!map.stats || map.stats.length === 0) && map.status === 'upcoming' ? (
                <View style={styles.statsTableWrapper}>
                    <Text style={styles.noDataText} allowFontScaling={false}>This map hasn't started yet.</Text>
                </View>
            ) : isWideScreen ? (
                // Wide screen layout - no scroll, uses full available space
                <WideScreenPlayerStats map={map} match={match} />
            ) : (
                // Mobile layout - scrollable table
                <View style={styles.statsTableWrapper}>
                    {/* Scroll Indicators Above Header */}
                    <View style={styles.scrollIndicatorsContainer}>
                        {showLeftArrow && (
                            <Pressable style={styles.scrollIndicatorLeft} onPress={scrollToLeft}>
                                <Text style={styles.scrollArrow} allowFontScaling={false}>‹</Text>
                            </Pressable>
                        )}
                        {showRightArrow && (
                            <Pressable style={styles.scrollIndicatorRight} onPress={scrollToRight}>
                                <Text style={styles.scrollArrow} allowFontScaling={false}>›</Text>
                            </Pressable>
                        )}
                    </View>

                    <View style={styles.statsTable}>
                        {/* Sticky Player Column */}
                        <View style={styles.stickyColumn}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, styles.playerHeader]} allowFontScaling={false}>Player</Text>
                            </View>

                            {/* Team 1 Players */}
                            <View style={styles.teamSection}>
                                <Text style={styles.teamLabel} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{match.team1.shortName}</Text>
                                {team1Players.map((player, index) => (
                                    <View key={index} style={[styles.playerRow, isAllMaps && styles.playerRowAllMaps]}>
                                        <Pressable
                                            accessibilityRole="link"
                                            accessibilityHint="Opens player page in in-app browser"
                                            onPress={() => {
                                                if (player.playerId) {
                                                    WebBrowser.openBrowserAsync(`https://www.vlr.gg/player/${player.playerId}/`);
                                                }
                                            }}
                                            style={[styles.playerInfo, isAllMaps && styles.playerInfoAllMaps]}
                                        >
                                            {isAllMaps ? (
                                                <>
                                                    <Text style={[styles.playerName, styles.playerNameAllMaps]} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{player.playerName}</Text>
                                                    <PlayerAgentsFromOtherMaps player={player} match={match} />
                                                </>
                                            ) : (
                                                <>
                                                    {player.agent.iconUrl && (
                                                        <Image source={{ uri: player.agent.iconUrl }} style={styles.agentIcon} />
                                                    )}
                                                    <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{player.playerName}</Text>
                                                </>
                                            )}
                                        </Pressable>
                                    </View>
                                ))}
                            </View>

                            {/* Team 2 Players */}
                            <View style={styles.teamSection}>
                                <Text style={styles.teamLabel} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{match.team2.shortName}</Text>
                                {team2Players.map((player, index) => (
                                    <View key={index} style={[styles.playerRow, isAllMaps && styles.playerRowAllMaps]}>
                                        <Pressable
                                            accessibilityRole="link"
                                            accessibilityHint="Opens player page in in-app browser"
                                            onPress={() => {
                                                if (player.playerId) {
                                                    WebBrowser.openBrowserAsync(`https://www.vlr.gg/player/${player.playerId}/`);
                                                }
                                            }}
                                            style={[styles.playerInfo, isAllMaps && styles.playerInfoAllMaps]}
                                        >
                                            {isAllMaps ? (
                                                <>
                                                    <Text style={[styles.playerName, styles.playerNameAllMaps]} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{player.playerName}</Text>
                                                    <PlayerAgentsFromOtherMaps player={player} match={match} />
                                                </>
                                            ) : (
                                                <>
                                                    {player.agent.iconUrl && (
                                                        <Image source={{ uri: player.agent.iconUrl }} style={styles.agentIcon} />
                                                    )}
                                                    <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{player.playerName}</Text>
                                                </>
                                            )}
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Scrollable Stats Area */}
                        <ScrollView
                            ref={scrollViewRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.tableScrollContainer}
                            onScroll={(event) => {
                                setScrollX(event.nativeEvent.contentOffset.x);
                            }}
                            onContentSizeChange={(contentWidth) => {
                                setContentWidth(contentWidth);
                            }}
                            onLayout={(event) => {
                                setContainerWidth(event.nativeEvent.layout.width);
                            }}
                            scrollEventThrottle={16}
                            bounces={false}
                        >
                            <View style={styles.scrollableTable}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.headerCell, styles.killsHeader]} allowFontScaling={false}>K</Text>
                                    <Text style={[styles.headerCell, styles.deathsHeader]} allowFontScaling={false}>D</Text>
                                    <Text style={[styles.headerCell, styles.assistsHeader]} allowFontScaling={false}>A</Text>
                                    <Text style={[styles.headerCell, styles.plusMinusHeader]} allowFontScaling={false}>+/-</Text>
                                    <Text style={[styles.headerCell, styles.acsHeader]} allowFontScaling={false}>ACS</Text>
                                    <Text style={[styles.headerCell, styles.adrHeader]} allowFontScaling={false}>ADR</Text>
                                    <Text style={[styles.headerCell, styles.hsHeader]} allowFontScaling={false}>HS%</Text>
                                    <Text style={[styles.headerCell, styles.fkHeader]} allowFontScaling={false}>FK</Text>
                                    <Text style={[styles.headerCell, styles.fdHeader]} allowFontScaling={false}>FD</Text>
                                    <Text style={[styles.headerCell, styles.ratingHeader]} allowFontScaling={false}>R²</Text>
                                    <Text style={[styles.headerCell, styles.kastHeader]} allowFontScaling={false}>KAST</Text>
                                </View>

                                {/* Team 1 Players */}
                                <View style={styles.teamSection}>
                                    {/* Invisible label for spacing */}
                                    <Text style={[styles.teamLabel, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{match.team1.shortName}</Text>
                                    {team1Players.map((player, index) => (
                                        <View key={index} style={[styles.playerRow, isAllMaps && styles.playerRowAllMaps]}>
                                            <PlayerStatsData player={player} mapStatus={map.status} />
                                        </View>
                                    ))}
                                </View>

                                {/* Team 2 Players */}
                                <View style={styles.teamSection}>
                                    {/* Invisible label for spacing */}
                                    <Text style={[styles.teamLabel, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{match.team2.shortName}</Text>
                                    {team2Players.map((player, index) => (
                                        <View key={index} style={[styles.playerRow, isAllMaps && styles.playerRowAllMaps]}>
                                            <PlayerStatsData player={player} mapStatus={map.status} />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            )}
        </View>
    );
};

export default function MatchDetailPage() {
    const insets = useSafeAreaInsets();
    const fabBottomOffset = Math.max(10, 10 + insets.bottom);
    const fabHeight = 40;
    const contentBottomPadding = fabBottomOffset + fabHeight + 6;
    const { vlrId } = useLocalSearchParams();
    const { isConnected, isInternetReachable } = useNetwork();
    const [retryCount, setRetryCount] = useState(0);

    const match = useQuery(api.matches.getMatchById, { vlrId: vlrId as string }) as MatchData | null | undefined;

    const [selectedMapIndex, setSelectedMapIndex] = useState(0);
    const hasAutoSelectedLiveMap = useRef(false);

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
    };

    // Auto-jump to the live map when the match is live
    useEffect(() => {
        if (!match) return;
        if (match.status !== 'live') return;
        if (hasAutoSelectedLiveMap.current) return;
        if (!Array.isArray(match.maps) || match.maps.length === 0) return;

        // Compute live index relative to the displayed list during live (includes upcoming)
        const displayed = match.maps.filter((m: MapData) => m.status !== 'unplayed');
        const liveIndex = displayed.findIndex((m: MapData) => m.status === 'live');
        if (liveIndex !== -1) {
            setSelectedMapIndex(liveIndex);
        }
        hasAutoSelectedLiveMap.current = true;
    }, [match?.status, match?.maps]);

    // Handle different states
    const isOffline = !isConnected || isInternetReachable === false;
    const isLoading = match === undefined && !isOffline;
    const hasError = match === null;

    if (hasError) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1 }}>
                    <ErrorState message="Match not found." onRetry={handleRetry} />
                </View>
            </ScreenWrapper>
        );
    }

    if (isLoading) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1 }}>
                    <MatchDetailSkeleton />
                </View>
            </ScreenWrapper>
        );
    }

    // At this point, match is guaranteed to be defined
    if (!match) return null;

    const displayedMaps = Array.isArray(match.maps) && match.maps.length > 0
        ? match.maps.filter((map: MapData) => map.status !== 'unplayed')
        : [];

    if (displayedMaps.length === 0) {
        return (
            <ScreenWrapper>
                <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: 0, paddingBottom: contentBottomPadding }}>
                    <MatchHeader match={match} />
                    <View style={styles.noDataContainer}>
                        <Text style={styles.noDataText}>No map data available yet</Text>
                    </View>
                </ScrollView>
            </ScreenWrapper>
        );
    }

    const currentMap = displayedMaps[selectedMapIndex];

    return (
        <ScreenWrapper>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: 0, paddingBottom: contentBottomPadding }}>
                <MatchHeader match={match} />

                {/* Map Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mapTabsContainer}>
                    {displayedMaps.map((map, index) => (
                        <MapTab
                            key={index}
                            map={map}
                            isActive={index === selectedMapIndex}
                            onPress={() => setSelectedMapIndex(index)}
                        />
                    ))}
                </ScrollView>

                {/* Map Stats */}
                <MapStats map={currentMap} match={match} />

                {/* Open in VLR Floating Button */}
                <View pointerEvents="box-none" style={[styles.fabContainer, { bottom: fabBottomOffset }]}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityHint="Opens this match on vlr.gg in the in-app browser"
                        style={styles.fabButton}
                        onPress={() => WebBrowser.openBrowserAsync(`https://www.vlr.gg/${match.vlrId}/`)}
                    >
                        <Text style={styles.fabText} allowFontScaling={false}>Open in VLR</Text>
                        <Text style={styles.fabIcon} allowFontScaling={false}>↗</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    errorText: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_400Regular',
        fontSize: 16,
    },
    noDataContainer: {
        padding: 40,
        alignItems: 'center',
    },
    noDataText: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_400Regular',
        fontSize: 16,
        textAlign: 'center',
    },

    // Match Header Styles
    matchHeader: {
        backgroundColor: Colors.surface,
        padding: 20,
        marginBottom: 8,
    },
    eventInfo: {
        alignItems: 'center',
        marginBottom: 20,
    },
    eventName: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 18,
        marginBottom: 4,
        textAlign: 'center',
    },
    eventLink: {
        color: Colors.accent,
        textDecorationLine: 'underline',
    },
    eventSeries: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
    },
    eventPatch: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        marginTop: 4,
    },
    teamsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    teamHeaderSection: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: 4,
    },
    teamName: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        textAlign: 'center',
    },
    scoreSection: {
        alignItems: 'center',
        marginHorizontal: 10,
        minWidth: 80,
    },
    scoreText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_700Bold',
        fontSize: 32,
        marginBottom: 8,
    },
    statusBadge: {
        backgroundColor: Colors.divider,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    liveBadge: {
        backgroundColor: '#FF4655',
    },
    statusText: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
    },
    liveText: {
        color: Colors.textPrimary,
    },

    // Map Tabs Styles
    mapTabsContainer: {
        backgroundColor: Colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 8,
    },
    fabContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    fabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.accent,
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    fabText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
    },
    fabIcon: {
        color: Colors.textPrimary,
        fontSize: 16,
        marginLeft: 6,
    },
    mapTab: {
        backgroundColor: Colors.surfaceSecondary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        marginRight: 8,
        alignItems: 'center',
        minWidth: 80,
    },
    activeMapTab: {
        backgroundColor: '#FF4655',
    },
    mapTabText: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
    },
    activeMapTabText: {
        color: Colors.textPrimary,
    },
    liveMapTab: {
        // Placeholder
    },
    mapTabContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        marginLeft: 6,
    },

    // Map Stats Styles
    mapStatsContainer: {
        backgroundColor: Colors.surface,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 8,
        overflow: 'hidden',
    },
    mapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    mapInfo: {
        flex: 1,
    },
    mapNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    mapName: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 20,
    },
    mapLiveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    mapLiveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        marginRight: 6,
    },
    mapLiveText: {
        color: '#FFFFFF',
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    mapPickInfo: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
    },
    mapScore: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_700Bold',
        fontSize: 22,
    },

    // Stats Table Styles
    statsTableWrapper: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    statsTable: {
        flexDirection: 'row',
    },
    stickyColumn: {
        width: 140,
        backgroundColor: Colors.surface,
        zIndex: 1,
    },
    scrollableTable: {
        minWidth: 500,
    },
    tableScrollContainer: {
        flex: 1,
    },
    tableContainer: {
        minWidth: 500,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
        marginBottom: 16,
    },
    headerCell: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
        textAlign: 'center',
        width: 60,
    },
    playerHeader: {
        textAlign: 'left',
        width: 140,
    },
    acsHeader: {
        width: 50,
        textAlign: 'center',
    },
    adrHeader: {
        width: 50,
        textAlign: 'center',
    },
    kastHeader: {
        width: 70,
        textAlign: 'center',
    },
    hsHeader: {
        width: 50,
        textAlign: 'center',
    },
    fkHeader: {
        width: 40,
        textAlign: 'center',
    },
    fdHeader: {
        width: 40,
        textAlign: 'center',
    },
    kdaHeader: {
        width: 60,
        textAlign: 'center',
    },
    killsHeader: {
        width: 40,
        textAlign: 'center',
    },
    deathsHeader: {
        width: 40,
        textAlign: 'center',
    },
    assistsHeader: {
        width: 40,
        textAlign: 'center',
    },
    plusMinusHeader: {
        width: 50,
        textAlign: 'center',
    },
    ratingHeader: {
        width: 50,
        textAlign: 'center',
    },

    // Team Section Styles
    teamSection: {
        marginBottom: 20,
    },
    teamLabel: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 20,
        marginBottom: 8,
    },

    // Player Row Styles
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dividerSecondary,
    },
    playerRowAllMaps: {
        minHeight: 60,
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 140,
    },
    // All Maps overrides for player info/name spacing
    playerInfoAllMaps: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        width: 140,
        paddingTop: 2,
        paddingBottom: 2,
    },
    playerName: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        flex: 1,
        marginLeft: 6,
    },
    playerNameAllMaps: {
        marginLeft: 0,
        marginBottom: 3,
        paddingTop: 2,
    },
    agentIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    agentIconSmall: {
        width: 22,
        height: 22,
        borderRadius: 11,
        marginRight: 6,
    },
    playerAgentsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    acsText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 50,
    },
    adrText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 50,
    },
    kastText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 70,
    },
    hsText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 50,
    },
    fkText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 40,
    },
    fdText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 40,
    },
    kdaText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 60,
    },
    killsText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 40,
    },
    deathsText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 40,
    },
    assistsText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 40,
    },
    plusMinusText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
        textAlign: 'center',
        width: 50,
    },
    ratingText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
        width: 50,
    },

    // Timeline Styles
    timelineContainer: {
        backgroundColor: Colors.surface,
        marginBottom: 4,
        paddingVertical: 16,
        overflow: 'visible',
    },
    timelineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    timelineTitle: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 18,
    },
    timelineScore: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timelineScoreText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
    },
    timelineScrollView: {
        paddingHorizontal: 16,
        overflow: 'visible',
    },
    timelineContent: {
        paddingRight: 16,
    },
    roundContainer: {
        alignItems: 'center',
        marginRight: 8,
        position: 'relative',
    },
    roundItem: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        backgroundColor: Colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    completedRound: {
        backgroundColor: Colors.surface,
    },
    pendingRound: {
        backgroundColor: Colors.surfaceSecondary,
        opacity: 0.6,
    },
    roundNumber: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        marginBottom: 0,
    },
    roundDetails: {
        alignItems: 'center',
    },
    winningTeam: {
        fontFamily: 'Inter_500Medium',
        fontSize: 10,
        marginBottom: 2,
    },
    winConditionIcon: {
        width: 16,
        height: 16,
    },
    pendingText: {
        color: Colors.textMuted,
        fontFamily: 'Inter_400Regular',
        fontSize: 10,
    },
    roundPopup: {
        position: 'absolute',
        bottom: 86,
        left: -10,
        right: -10,
        backgroundColor: Colors.surfaceSecondary,
        padding: 8,
        borderRadius: 8,
        alignItems: 'center',
        minWidth: 80,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    popupScore: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        marginBottom: 2,
    },
    popupWinCondition: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_400Regular',
        fontSize: 10,
        textAlign: 'center',
    },
    connectingLine: {
        position: 'absolute',
        top: 35,
        left: 70,
        width: 8,
        height: 2,
        zIndex: -1,
    },

    // Scroll Indicator Styles
    scrollIndicatorsContainer: {
        position: 'relative',
        height: 20,
        marginBottom: 8,
    },
    scrollIndicatorLeft: {
        position: 'absolute',
        left: 140,
        top: 0,
        bottom: 0,
        width: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 4,
        zIndex: 1,
    },
    scrollIndicatorRight: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 4,
        zIndex: 1,
    },
    scrollArrow: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        opacity: 0.8,
        includeFontPadding: false,
    },

    // Wide Screen Table Styles
    wideScreenTableContainer: {
        padding: 16,
    },
    wideScreenTable: {
        backgroundColor: Colors.surface,
        borderRadius: 8,
        overflow: 'hidden',
    },
    wideScreenHeaderRow: {
        flexDirection: 'row',
        backgroundColor: Colors.surfaceSecondary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    wideScreenHeaderCell: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
        textAlign: 'center',
    },
    wideScreenPlayerHeader: {
        flex: 3,
        textAlign: 'left',
    },
    wideScreenKillsHeader: {
        flex: 1,
    },
    wideScreenDeathsHeader: {
        flex: 1,
    },
    wideScreenAssistsHeader: {
        flex: 1,
    },
    wideScreenPlusMinusHeader: {
        flex: 1.2,
    },
    wideScreenAcsHeader: {
        flex: 1.4,
    },
    wideScreenAdrHeader: {
        flex: 1.4,
    },
    wideScreenHsHeader: {
        flex: 1.2,
    },
    wideScreenFkHeader: {
        flex: 1,
    },
    wideScreenFdHeader: {
        flex: 1,
    },
    wideScreenRatingHeader: {
        flex: 1.2,
    },
    wideScreenKastHeader: {
        flex: 1.2,
    },
    wideScreenTeamSection: {
        marginBottom: 8,
    },
    wideScreenTeamLabel: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 18,
        marginBottom: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    wideScreenPlayerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dividerSecondary,
    },
    wideScreenPlayerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 3,
    },
    wideScreenPlayerName: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        flex: 1,
        marginLeft: 8,
    },
    wideScreenDataCell: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        textAlign: 'center',
    },
    wideScreenKillsCell: {
        flex: 1,
    },
    wideScreenDeathsCell: {
        flex: 1,
    },
    wideScreenAssistsCell: {
        flex: 1,
    },
    wideScreenPlusMinusCell: {
        flex: 1.2,
        fontFamily: 'Inter_600SemiBold',
    },
    wideScreenAcsCell: {
        flex: 1.4,
    },
    wideScreenAdrCell: {
        flex: 1.4,
    },
    wideScreenHsCell: {
        flex: 1.2,
    },
    wideScreenFkCell: {
        flex: 1,
    },
    wideScreenFdCell: {
        flex: 1,
    },
    wideScreenRatingCell: {
        flex: 1.2,
    },
    wideScreenKastCell: {
        flex: 1.2,
    },
});
