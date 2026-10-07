# VCT Tracker Mobile - UI Components Guide

This document provides a comprehensive overview of the UI components and layout structures used in the `valorant-competitive-tracker-mobile` Expo/React Native application. It is designed to help developers and AI agents understand the UI architecture without needing to scan every individual file.

## 1. Core Architecture & Styling

### Theme & Colors (`theme/colors.ts`)
The app uses a dark-mode-first centralized color system. Always import colors from `theme/colors.ts` rather than hardcoding hex values.

```typescript
export const Colors = {
    background: '#2A2A2A',       // Main app background
    surface: '#363636',          // Cards and elevated elements
    surfaceSecondary: '#404040', // Secondary elevated elements
    textPrimary: '#FFFFFF',      // Main text (Titles, active elements)
    textSecondary: '#B6B6B6',    // Subtitles, metadata
    textMuted: '#D9D9D9',        // Muted labels
    accent: '#3b82f6',           // Blue (Team 1, active states)
    danger: '#FF4655',           // Valorant Red (Team 2, Live badges, errors)
    divider: '#555555',          // Borders
    dividerSecondary: '#4A4A4A',
    shadow: '#1A1A1A',
};
```

### Navigation (`app/_layout.tsx`, `app/(tabs)/_layout.tsx`)
- Uses **Expo Router** for file-based routing.
- **Tabs**: Bottom tab navigation (`Home`, `Results`).
- **Stack**: Used for pushing detail screens (e.g., `Match Detail`) over the tabs.

---

## 2. Shared Components

### MatchCard (`components/MatchCard.tsx`)
The primary UI element for displaying a summary of a match. Used on both the Home screen and Results screen.

**Props:**
- `match`: Object containing `vlrId`, `status` (`live` | `upcoming` | `completed`), `time`, `team1`, `team2`, and `event`.
- `showYear` (optional boolean): Whether to display the year in the formatted date.

**Behavior:**
- Displays event info, time (auto-localized to the user's timezone), team names, logos, and scores.
- Highlights the winning team's name and score in the accent color if the match is completed.
- Shows a red `LIVE` badge if the match is currently ongoing.
- Tapping the card routes the user to `/match/[vlrId]`.

### Loading States (`components/LoadingStates.tsx`)
Provides standardized fallback UI for asynchronous operations and edge cases.

- `LoadingSpinner`: Generic centered spinner.
- `OfflineState`: Shown when device loses network connectivity (managed via `NetworkProvider`).
- `SlowConnectionState`: Shown if a query takes exceptionally long.
- `ErrorState`: Displays an error message and a retry button.
- `EmptyState`: Shown when lists (like upcoming matches or search results) are empty.

### Skeleton Loaders (`components/SkeletonLoaders.tsx`)
Replaces generic spinners with layout-aware shimmer animations for a smoother UX during data fetching.

- `MatchCardSkeleton`: A single card placeholder.
- `HomePageSkeleton`: Placeholder for the Home screen (Live & Upcoming sections).
- `ResultsPageSkeleton`: Placeholder for the Results screen (Search bar + list).
- `MatchDetailSkeleton`: Placeholder for the Match Detail screen (Header, tabs, and stats table).

---

## 3. Screens

### Home Page (`app/(tabs)/index.tsx`)
Displays active and upcoming matches.

**Layout:**
- Uses `SafeAreaView` and `ScrollView`.
- Fetches data via Convex query `api.matches.getHomePageMatches`.
- Divided into two `Section` blocks:
  1. **Live**: Displays matches currently being played.
  2. **Upcoming**: Displays scheduled matches.
- Uses `HomePageSkeleton` while loading, and `EmptyState` if no matches are active/upcoming.

### Results Page (`app/(tabs)/results.tsx`)
Allows users to search and view completed matches.

**Layout:**
- Search bar at the top (with a `?` help modal for advanced search syntax).
- Uses `FlatList` to render a paginated list of `MatchCard` components.
- Fetches data via Convex paginated query `api.matches.searchCompletedMatchesPaginated`.
- Uses `ResultsPageSkeleton` on initial load, and standard `ActivityIndicator` at the bottom for infinite scrolling.

### Match Detail Page (`app/match/[vlrId].tsx`)
A complex screen displaying in-depth statistics for a specific match.

**Layout & Components:**
- **MatchHeader**: Shows event info (clickable to open in-app browser to VLR.gg), team scores, and a LIVE/COMPLETED badge.
- **Map Tabs**: Horizontal scrollable tabs to switch between different maps played in the series (e.g., "All Maps", "Bind", "Split").
- **RoundTimeline**: (Only shown for played maps) A horizontal timeline showing round-by-round results, indicating which team won, the win condition (Elimination, Spike Exploded, etc.), and the running score.
- **MapStats (Table)**: 
  - **Responsive Design**: 
    - On mobile (< 600px width), renders a horizontally scrollable table with a sticky left column (Player Names).
    - On tablets/wide screens (>= 600px width), renders a full-width grid table without horizontal scrolling.
  - Displays extensive stats: Kills (K), Deaths (D), Assists (A), Plus/Minus (+/-), Average Combat Score (ACS), Average Damage per Round (ADR), Headshot % (HS%), First Kills (FK), First Deaths (FD), Rating (R²), and KAST%.
  - Uses `MatchDetailSkeleton` during initial load.

---

## 4. Key Design Patterns to Follow

1. **Accessibility/Font Scaling**: For complex tables (like in Match Detail), `allowFontScaling={false}` is heavily utilized to prevent the UI from breaking when system text size is increased.
2. **In-App Browsing**: External links (like Event pages or Player profiles) use `expo-web-browser` (`WebBrowser.openBrowserAsync`) instead of throwing the user out of the app.
3. **Timezones**: All times are scraped in Eastern Time (America/New_York) and converted to the user's local timezone on the client device (handled in `MatchCard` and `Match Detail`).
4. **Offline First**: The app utilizes a `NetworkProvider` to detect connectivity drops and gracefully display the `OfflineState` rather than failing silently or crashing.
