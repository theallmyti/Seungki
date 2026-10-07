import { View, Text, StyleSheet, Animated } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../theme/colors';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import MatchCard from '../../components/MatchCard';
import { EmptyState } from '../../components/LoadingStates';
import { HomePageSkeleton } from '../../components/SkeletonLoaders';
import { useNetwork } from '../../providers/NetworkProvider';
import { useState, useRef } from 'react';

const Section = ({ title, data }: { title: string, data: any[] | undefined }) => {
  if (!data || data.length === 0) {
    return null; // Don't render section if there's no data
  }

  // Group by tournament name
  const groupedData = data.reduce((acc, match) => {
    const eventName = match.event?.name || "Other Matches";
    if (!acc[eventName]) acc[eventName] = [];
    acc[eventName].push(match);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {Object.entries(groupedData).map(([eventName, matches]) => (
        <View key={eventName} style={styles.tournamentGroup}>
          <Text style={styles.tournamentTitle}>{eventName}</Text>
          {(matches as any[]).map((match) => (
            <MatchCard key={match.vlrId} match={match} />
          ))}
        </View>
      ))}
    </View>
  );
};


export default function HomePage() {
  const { isConnected, isInternetReachable } = useNetwork();
  const [retryCount, setRetryCount] = useState(0);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const matchesData = useQuery(api.matches.getHomePageMatches, {
    upcomingLimit: 10,
  });

  // Handle different states
  const isOffline = !isConnected || isInternetReachable === false;
  const isLoading = matchesData === undefined && !isOffline;
  const hasError = matchesData === null;

    if (hasError) {
      return (
        <ScreenWrapper>
          <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.centered}>
              <Text style={styles.errorText}>Failed to load matches. Please try again.</Text>
            </View>
          </SafeAreaView>
        </ScreenWrapper>
      );
    }

    if (isLoading) {
      return (
        <ScreenWrapper>
          <SafeAreaView style={styles.container} edges={['top']}>
            <HomePageSkeleton />
          </SafeAreaView>
        </ScreenWrapper>
      );
    }

  const { live, upcoming } = matchesData || { live: [], upcoming: [] };
  const isEmpty = live.length === 0 && upcoming.length === 0;

    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: 100 }}
            contentInsetAdjustmentBehavior="automatic"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
          >
            {isEmpty ? (
              <EmptyState
                message="No live or upcoming matches at the moment."
                icon="🏆"
              />
            ) : (
              <>
                <Section title="Live" data={live} />
                <Section title="Upcoming" data={upcoming} />
              </>
            )}
          </Animated.ScrollView>

          {/* Sticky Header Background (Fades in, soft gradient edge) */}
          <Animated.View pointerEvents="none" style={[styles.header, { paddingTop: insets.top, height: insets.top + 80, opacity: headerOpacity }]}>
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.95)', 'rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.4)', 'transparent']}
              locations={[0, 0.5, 0.8, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Sticky Header Title (Always visible) */}
          <View style={[styles.headerTitleContainer, { paddingTop: insets.top, height: insets.top + 60 }]}>
            <Text style={styles.headerTitle}>Seungki</Text>
          </View>
        </View>
      </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerTitleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    paddingHorizontal: 16,
    pointerEvents: 'none',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.textPrimary,
    marginLeft: 16,
    marginBottom: 4,
  },
  tournamentGroup: {
    marginBottom: 16,
  },
  tournamentTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  }
});
