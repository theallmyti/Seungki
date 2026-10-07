import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useNetwork } from '../providers/NetworkProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function NetworkBanner() {
    const { isConnected, isInternetReachable, connectionType } = useNetwork();
    const insets = useSafeAreaInsets();
    const bottomOffset = insets.bottom + (Platform.OS === 'ios' ? 70 : 90);

    const isOffline = !isConnected || isInternetReachable === false;

    if (!isOffline) {
        return null;
    }

    const bannerContent = {
        icon: '📡',
        title: 'No Internet Connection',
        message: connectionType === 'none'
            ? "You're currently offline. Please check your internet connection."
            : "Unable to connect to the server. Please check your connection and try again.",
        backgroundColor: '#FF6B6B',
        textColor: '#FFFFFF'
    };

    return (
        <View style={[styles.banner, { backgroundColor: bannerContent.backgroundColor, bottom: bottomOffset }]}>
            <View style={styles.bannerContent}>
                <View style={styles.bannerLeft}>
                    <Text style={styles.bannerIcon}>{bannerContent.icon}</Text>
                    <View style={styles.bannerText}>
                        <Text style={[styles.bannerTitle, { color: bannerContent.textColor }]}>
                            {bannerContent.title}
                        </Text>
                        <Text style={[styles.bannerMessage, { color: bannerContent.textColor }]}>
                            {bannerContent.message}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 16,
        zIndex: 1000,
        elevation: 1000,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    bannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    bannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    bannerIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    bannerText: {
        flex: 1,
    },
    bannerTitle: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        marginBottom: 2,
    },
    bannerMessage: {
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
        opacity: 0.9,
        lineHeight: 16,
    },
});
