import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Platform } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../providers/AuthProvider';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Colors } from '../../theme/colors';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

export default function HistoryPage() {
    const { userId, userProfile, isLoading: isAuthLoading } = useAuth();
    const transactions = useQuery(api.bets.getUserTransactions, userId ? { userId: userId as any } : "skip");

    const formatTimestamp = (ts: number) => {
        const date = new Date(ts);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const renderTransactionIcon = (type: string) => {
        switch (type) {
            case 'bet_placed':
                return <Ionicons name="arrow-down" size={20} color={Colors.accent} />;
            case 'bet_won':
                return <Ionicons name="arrow-up" size={20} color={Colors.success} />;
            case 'bet_lost':
                return <Ionicons name="close" size={20} color={Colors.danger} />;
            case 'fav_team_win':
                return <Ionicons name="star" size={20} color={Colors.warning} />;
            default:
                return <Ionicons name="ellipse" size={20} color={Colors.textSecondary} />;
        }
    };

    const renderTransactionText = (type: string, amount: number) => {
        switch (type) {
            case 'bet_placed':
                return `Placed a bet of ${amount} coins`;
            case 'bet_won':
                return `Won ${amount} coins from a bet`;
            case 'bet_lost':
                return `Lost a bet`;
            case 'fav_team_win':
                return `Received ${amount} coins (Favorite team won)`;
            default:
                return `Transaction: ${amount} coins`;
        }
    };

    const renderTransactionAmount = (type: string, amount: number) => {
        if (type === 'bet_lost' || type === 'bet_placed') {
            return (
                <Text style={[styles.transactionAmount, { color: Colors.danger }]}>
                    -{amount}
                </Text>
            );
        } else if (amount > 0) {
            return (
                <Text style={[styles.transactionAmount, { color: Colors.success }]}>
                    +{amount}
                </Text>
            );
        } else {
            return (
                <Text style={styles.transactionAmount}>0</Text>
            );
        }
    };

    if (isAuthLoading || transactions === undefined) {
        return (
            <ScreenWrapper>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={Colors.accent} />
                    </View>
                </SafeAreaView>
            </ScreenWrapper>
        );
    }

    if (!userId) {
        return (
            <ScreenWrapper>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.centerContainer}>
                        <FontAwesome5 name="lock" size={48} color={Colors.textSecondary} style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyTitle}>Not Logged In</Text>
                        <Text style={styles.emptySubtitle}>Log in to see your transaction history.</Text>
                    </View>
                </SafeAreaView>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>History</Text>
                    <View style={styles.balanceContainer}>
                        <FontAwesome5 name="coins" size={16} color={Colors.accent} style={{ marginRight: 6 }} />
                        <Text style={styles.balanceText}>{userProfile?.coins || 0}</Text>
                    </View>
                </View>

                {transactions.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <FontAwesome5 name="receipt" size={48} color={Colors.textSecondary} style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyTitle}>No Transactions</Text>
                        <Text style={styles.emptySubtitle}>Your bet history and rewards will appear here.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={transactions}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <View style={styles.transactionCard}>
                                <View style={styles.transactionIconContainer}>
                                    {renderTransactionIcon(item.type)}
                                </View>
                                <View style={styles.transactionDetails}>
                                    <Text style={styles.transactionText}>{renderTransactionText(item.type, item.amount)}</Text>
                                    <Text style={styles.transactionTime}>{formatTimestamp(item.timestamp)}</Text>
                                </View>
                                <View style={styles.amountContainer}>
                                    {renderTransactionAmount(item.type, item.amount)}
                                    <FontAwesome5 name="coins" size={12} color={Colors.textSecondary} style={{ marginLeft: 4 }} />
                                </View>
                            </View>
                        )}
                    />
                )}
            </SafeAreaView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontFamily: 'Inter_700Bold',
        color: '#FFFFFF',
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    balanceText: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        color: Colors.accent,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'Inter_600SemiBold',
        color: Colors.textPrimary,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: 'Inter_400Regular',
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100, // padding for bottom tabs
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    transactionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    transactionDetails: {
        flex: 1,
    },
    transactionText: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    transactionTime: {
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
        color: Colors.textSecondary,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    transactionAmount: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
    },
});
