import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '../theme/colors';

// =============================================================================
// Shimmer Animation Primitive
// =============================================================================

const SHIMMER_BASE = 'rgba(255,255,255,0.04)';
const SHIMMER_HIGHLIGHT = 'rgba(255,255,255,0.10)';

function ShimmerBlock({
    width,
    height,
    borderRadius = 6,
    style,
}: {
    width: number | string;
    height: number;
    borderRadius?: number;
    style?: object;
}) {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1200,
                easing: Easing.ease,
                useNativeDriver: false,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [shimmerAnim]);

    const backgroundColor = shimmerAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [SHIMMER_BASE, SHIMMER_HIGHLIGHT, SHIMMER_BASE],
    });

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor,
                },
                style,
            ]}
        />
    );
}

// =============================================================================
// Match Card Skeleton
// =============================================================================

export function MatchCardSkeleton() {
    return (
        <View style={skeletonStyles.card}>
            {/* Header: event name, series, time */}
            <View style={skeletonStyles.header}>
                <View style={{ flex: 1 }}>
                    <ShimmerBlock width="60%" height={14} />
                    <ShimmerBlock width="40%" height={12} style={{ marginTop: 6 }} />
                    <ShimmerBlock width="50%" height={12} style={{ marginTop: 4 }} />
                </View>
            </View>

            {/* Team 1 row */}
            <View style={skeletonStyles.teamRow}>
                <ShimmerBlock width="55%" height={16} />
                <ShimmerBlock width={30} height={16} />
            </View>

            {/* Team 2 row */}
            <View style={skeletonStyles.teamRow}>
                <ShimmerBlock width="45%" height={16} />
                <ShimmerBlock width={30} height={16} />
            </View>
        </View>
    );
}

// =============================================================================
// Home Page Skeleton (Live + Upcoming sections)
// =============================================================================

export function HomePageSkeleton() {
    return (
        <View style={skeletonStyles.pageContainer}>
            {/* "Live" section title */}
            <View style={skeletonStyles.section}>
                <ShimmerBlock width={80} height={22} style={skeletonStyles.sectionTitle} />
                <MatchCardSkeleton />
            </View>

            {/* "Upcoming" section title */}
            <View style={skeletonStyles.section}>
                <ShimmerBlock width={120} height={22} style={skeletonStyles.sectionTitle} />
                <MatchCardSkeleton />
                <MatchCardSkeleton />
                <MatchCardSkeleton />
            </View>
        </View>
    );
}

// =============================================================================
// Results Page Skeleton (Search bar + list)
// =============================================================================

export function ResultsPageSkeleton() {
    return (
        <View style={skeletonStyles.pageContainer}>
            {/* Search bar placeholder */}
            <View style={skeletonStyles.searchBarSkeleton}>
                <ShimmerBlock width="100%" height={44} borderRadius={10} />
            </View>

            {/* Match cards */}
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
        </View>
    );
}

// =============================================================================
// Match Detail Page Skeleton
// =============================================================================

export function MatchDetailSkeleton() {
    return (
        <View style={skeletonStyles.pageContainer}>
            {/* Event info */}
            <View style={skeletonStyles.detailHeader}>
                <ShimmerBlock width="70%" height={16} />
                <ShimmerBlock width="50%" height={13} style={{ marginTop: 6 }} />
                <ShimmerBlock width="30%" height={12} style={{ marginTop: 4 }} />
            </View>

            {/* Teams + Score */}
            <View style={skeletonStyles.teamsRow}>
                <View style={skeletonStyles.teamBlock}>
                    <ShimmerBlock width={48} height={48} borderRadius={24} />
                    <ShimmerBlock width={80} height={14} style={{ marginTop: 8 }} />
                </View>

                <View style={skeletonStyles.scoreBlock}>
                    <ShimmerBlock width={80} height={32} borderRadius={8} />
                    <ShimmerBlock width={70} height={20} borderRadius={4} style={{ marginTop: 8 }} />
                </View>

                <View style={skeletonStyles.teamBlock}>
                    <ShimmerBlock width={48} height={48} borderRadius={24} />
                    <ShimmerBlock width={80} height={14} style={{ marginTop: 8 }} />
                </View>
            </View>

            {/* Map selector tabs */}
            <View style={skeletonStyles.mapTabs}>
                <ShimmerBlock width={70} height={32} borderRadius={6} />
                <ShimmerBlock width={70} height={32} borderRadius={6} style={{ marginLeft: 8 }} />
                <ShimmerBlock width={70} height={32} borderRadius={6} style={{ marginLeft: 8 }} />
            </View>

            {/* Map score summary */}
            <View style={skeletonStyles.mapScoreSummary}>
                <ShimmerBlock width="35%" height={14} />
                <ShimmerBlock width={60} height={20} />
                <ShimmerBlock width="35%" height={14} />
            </View>

            {/* Player stats table rows */}
            <View style={skeletonStyles.statsSection}>
                {/* Table header */}
                <View style={skeletonStyles.statsHeaderRow}>
                    <ShimmerBlock width="30%" height={12} />
                    <ShimmerBlock width={30} height={12} />
                    <ShimmerBlock width={30} height={12} />
                    <ShimmerBlock width={40} height={12} />
                </View>

                {/* Player rows (5 per team) */}
                {[...Array(5)].map((_, i) => (
                    <View key={`t1-${i}`} style={skeletonStyles.playerRow}>
                        <View style={skeletonStyles.playerInfo}>
                            <ShimmerBlock width={24} height={24} borderRadius={12} />
                            <ShimmerBlock width={80} height={14} style={{ marginLeft: 8 }} />
                        </View>
                        <ShimmerBlock width={30} height={14} />
                        <ShimmerBlock width={30} height={14} />
                        <ShimmerBlock width={40} height={14} />
                    </View>
                ))}

                {/* Divider */}
                <View style={skeletonStyles.teamDivider} />

                {/* Team 2 players */}
                {[...Array(5)].map((_, i) => (
                    <View key={`t2-${i}`} style={skeletonStyles.playerRow}>
                        <View style={skeletonStyles.playerInfo}>
                            <ShimmerBlock width={24} height={24} borderRadius={12} />
                            <ShimmerBlock width={80} height={14} style={{ marginLeft: 8 }} />
                        </View>
                        <ShimmerBlock width={30} height={14} />
                        <ShimmerBlock width={30} height={14} />
                        <ShimmerBlock width={40} height={14} />
                    </View>
                ))}
            </View>
        </View>
    );
}

// =============================================================================
// Styles
// =============================================================================

const skeletonStyles = StyleSheet.create({
    pageContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    // MatchCard skeleton
    card: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
        paddingBottom: 8,
    },
    teamRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },

    // Home page skeleton
    section: {
        marginTop: 20,
    },
    sectionTitle: {
        marginLeft: 16,
        marginBottom: 10,
    },

    // Results page skeleton
    searchBarSkeleton: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },

    // Match detail skeleton
    detailHeader: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 16,
        alignItems: 'center',
    },
    teamsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    teamBlock: {
        alignItems: 'center',
        flex: 1,
    },
    scoreBlock: {
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    mapTabs: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    mapScoreSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    statsSection: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    statsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        marginBottom: 4,
    },
    playerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    teamDivider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginVertical: 12,
    },
});
