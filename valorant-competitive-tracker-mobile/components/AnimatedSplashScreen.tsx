import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Image, Text, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Prevent native splash screen from hiding automatically until custom animation takes over
SplashScreen.preventAutoHideAsync().catch(() => {
    /* reload ignore */
});

interface AnimatedSplashScreenProps {
    children: React.ReactNode;
    isReady: boolean;
}

export function AnimatedSplashScreen({ children, isReady }: AnimatedSplashScreenProps) {
    const [splashAnimationDone, setSplashAnimationDone] = useState(false);

    // Animation values
    const scale = useRef(new Animated.Value(1.18)).current;
    const logoOpacity = useRef(new Animated.Value(1)).current;
    const overlayOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!isReady) return;

        // Hide native splash screen as custom animated splash is active
        SplashScreen.hideAsync().catch(() => {});

        // Subtle delay for visual delight
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(scale, {
                    toValue: 0.88,
                    duration: 750,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, {
                    toValue: 0,
                    duration: 650,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(overlayOpacity, {
                    toValue: 0,
                    duration: 800,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setSplashAnimationDone(true);
            });
        }, 250);

        return () => clearTimeout(timer);
    }, [isReady]);

    return (
        <View style={styles.container}>
            {children}
            {!splashAnimationDone && (
                <Animated.View style={[styles.splashOverlay, { opacity: overlayOpacity }]} pointerEvents="none">
                    <Animated.View
                        style={[
                            styles.logoContainer,
                            {
                                opacity: logoOpacity,
                                transform: [{ scale }],
                            },
                        ]}
                    >
                        <Image
                            source={require('../assets/images/icon.png')}
                            style={styles.logoImage}
                            resizeMode="cover"
                        />
                    </Animated.View>
                    <Animated.Text style={[styles.appName, { opacity: logoOpacity }]}>
                        Seungki
                    </Animated.Text>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F1015',
    },
    splashOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0F1015',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
    },
    logoContainer: {
        width: 130,
        height: 130,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#161618',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 10,
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    appName: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: 1.2,
        marginTop: 20,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    },
});
