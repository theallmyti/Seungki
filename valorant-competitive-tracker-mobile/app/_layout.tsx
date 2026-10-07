import { Stack } from 'expo-router';
import { ConvexClientProvider } from '../providers/ConvexClientProvider';
import { NetworkProvider } from '../providers/NetworkProvider';
import { AuthProvider } from '../providers/AuthProvider';
import { NetworkBanner } from '../components/NetworkBanner';
import { Colors } from '../theme/colors';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ActivityIndicator, View, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import Aptabase from '@aptabase/react-native';
import { useEffect } from 'react';
import { trackEvent } from '@aptabase/react-native';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
import { VercelAnalytics } from '../components/VercelAnalytics';
import * as SystemUI from 'expo-system-ui';

SystemUI.setBackgroundColorAsync('#0F1015');

// Initialize Aptabase
const aptabaseKey = process.env.EXPO_PUBLIC_APTABASE_API_KEY;
if (aptabaseKey) {
    Aptabase.init(aptabaseKey);
}

// Custom theme to prevent React Navigation from applying a solid background color
const TransparentTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: 'transparent',
    },
};

export default function RootLayout() {
    // Load fonts for the application
    let [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
    });

    // Track application open event
    useEffect(() => {
        if (fontsLoaded && aptabaseKey) {
            trackEvent('app_open');
        }
    }, [fontsLoaded]);

    return (
        <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0F1015' }}>
            <AnimatedSplashScreen isReady={fontsLoaded}>
                <View style={{ flex: 1, backgroundColor: '#0F1015' }}>
                    <ThemeProvider value={TransparentTheme}>
                        <NetworkProvider>
                            <ConvexClientProvider>
                                <AuthProvider>
                                    <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                                    <Stack screenOptions={{
                                        headerStyle: {
                                            backgroundColor: 'rgba(54, 54, 54, 0.7)', // Semi-transparent surface
                                        },
                                        headerTintColor: '#fff',
                                        headerTitleStyle: {
                                            fontFamily: 'Inter_600SemiBold',
                                        },
                                        contentStyle: {
                                            backgroundColor: 'transparent'
                                        },
                                        headerTransparent: true,
                                        gestureEnabled: true,
                                        gestureDirection: 'horizontal',
                                    }}>
                                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                        <Stack.Screen name="match/[vlrId]" options={{ title: 'Match Details', headerBackTitle: 'Back', headerTransparent: false, headerStyle: { backgroundColor: '#161618' }, headerTintColor: '#fff', headerShadowVisible: false }} />
                                    </Stack>
                                    <NetworkBanner />
                                    <VercelAnalytics />
                                </AuthProvider>
                            </ConvexClientProvider>
                        </NetworkProvider>
                    </ThemeProvider>
                </View>
            </AnimatedSplashScreen>
        </SafeAreaProvider>
    );
}