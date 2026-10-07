import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Alert, Platform, Modal, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../theme/colors';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from '../providers/AuthProvider';
import { Id } from '../convex/_generated/dataModel';
import { normalizeLogoUrl } from '../utils/image';

type MatchCardProps = {
    vlrId: string;
    status: 'live' | 'upcoming' | 'completed';
    time: string;
    team1: { name: string; shortName?: string; score: number; logoUrl: string; };
    team2: { name: string; shortName?: string; score: number; logoUrl: string; };
    event: { name: string; series: string; };
};

const formatTime = (timeString: string, includeYear: boolean = false) => {
    try {
        const sourceTimeZone = 'America/New_York';
        const match = timeString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (!match) return timeString;

        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        const hour = parseInt(match[4], 10);
        const minute = parseInt(match[5], 10);
        const second = match[6] ? parseInt(match[6], 10) : 0;

        let provisionalMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
        const provisionalDate = new Date(provisionalMs);

        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: sourceTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).formatToParts(provisionalDate);

        const fYear = parseInt(parts.find(p => p.type === 'year')?.value || String(year), 10);
        const fMonth = parseInt(parts.find(p => p.type === 'month')?.value || String(month), 10);
        const fDay = parseInt(parts.find(p => p.type === 'day')?.value || String(day), 10);
        const fHour = parseInt(parts.find(p => p.type === 'hour')?.value || String(hour), 10);
        const fMinute = parseInt(parts.find(p => p.type === 'minute')?.value || String(minute), 10);
        const fSecond = parseInt(parts.find(p => p.type === 'second')?.value || String(second), 10);

        const intendedWallUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
        const formattedWallUtcMs = Date.UTC(fYear, fMonth - 1, fDay, fHour, fMinute, fSecond, 0);
        const deltaMs = intendedWallUtcMs - formattedWallUtcMs;
        const desiredUtcMs = provisionalMs + deltaMs;
        const desiredDate = new Date(desiredUtcMs);

        const localNow = new Date();
        const sameLocalDate = (a: Date, b: Date) => a.toDateString() === b.toDateString();
        const isToday = sameLocalDate(desiredDate, localNow);
        const isTomorrow = sameLocalDate(desiredDate, new Date(localNow.getTime() + 24 * 60 * 60 * 1000));

        const timeParts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(desiredDate);
        const hourStr = timeParts.find(p => p.type === 'hour')?.value ?? '';
        const minuteStr = timeParts.find(p => p.type === 'minute')?.value ?? '';
        const dayPeriod = (timeParts.find(p => p.type === 'dayPeriod')?.value ?? '').toLowerCase();
        const timeStr = `${hourStr}:${minuteStr}${dayPeriod}`;

        if (!isToday && !isTomorrow) {
            const dateParts = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}) }).formatToParts(desiredDate);
            const weekday = dateParts.find(p => p.type === 'weekday')?.value ?? '';
            const month = dateParts.find(p => p.type === 'month')?.value ?? '';
            const dayStr = dateParts.find(p => p.type === 'day')?.value ?? '';
            const yearStr = includeYear ? (dateParts.find(p => p.type === 'year')?.value ?? '') : '';
            return `${includeYear ? `${weekday}, ${month} ${dayStr} ${yearStr}` : `${weekday}, ${month} ${dayStr}`}, ${timeStr}`;
        }
        if (isToday) return `Today, ${timeStr}`;
        if (isTomorrow) return `Tomorrow, ${timeStr}`;

        return `${desiredDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${timeStr}`;
    } catch (error) {
        return timeString;
    }
};

const getInitials = (name: string) => {
    if (!name) return "";
    const words = name.split(' ').filter(Boolean);
    if (words.length === 1) {
        return words[0].substring(0, 3).toUpperCase();
    }
    return words.map(w => w[0]).join('').toUpperCase().substring(0, 3);
};

const formatTeamName = (name: string, shortName?: string) => {
    if (shortName && shortName.length <= 5) return shortName.toUpperCase();
    return getInitials(name);
};

export default function MatchCard({ match, showYear }: { match: MatchCardProps; showYear?: boolean }) {
    const router = useRouter();
    const { userId, userProfile } = useAuth();
    const placeBet = useMutation(api.bets.placeBet);
    const updateBet = useMutation(api.bets.updateBet);
    const cancelBet = useMutation(api.bets.cancelBet);
    const [showBettorsModal, setShowBettorsModal] = useState(false);
    
    // Betting Modal State
    const [showBetModal, setShowBetModal] = useState(false);
    const [betStep, setBetStep] = useState(1); // 1: Select Team, 2: Enter Amount
    const [selectedTeamForBet, setSelectedTeamForBet] = useState('');
    const [betAmount, setBetAmount] = useState('100');
    
    // Fetch detailed bets for this match
    const matchBets = useQuery(api.bets.getBetsForMatch, { matchId: match.vlrId }) || [];
    const actualUsers = matchBets.length;

    // Check if current user already has a bet on this match
    const myExistingBet = userId
        ? matchBets.find((b: any) => b.userId === userId)
        : undefined;

    // Allow placing/editing bets ONLY when match status is 'upcoming'
    const isWithinEditWindow = match.status === 'upcoming';

    const isEditMode = !!myExistingBet && isWithinEditWindow;

    const handlePress = () => {
        router.push(`/match/${match.vlrId}` as any);
    };

    const handleBetPress = () => {
        if (!userId) {
            router.push('/(tabs)/profile');
            return;
        }

        if (!isWithinEditWindow) {
            if (myExistingBet) {
                if (Platform.OS === 'web') {
                    window.alert("Bet Locked\n\nBets cannot be edited or cancelled once the match is live or completed.");
                } else {
                    Alert.alert("Bet Locked", "Bets cannot be edited or cancelled once the match is live or completed.");
                }
            } else {
                if (Platform.OS === 'web') {
                    window.alert("Betting Closed\n\nBets can only be placed on upcoming matches.");
                } else {
                    Alert.alert("Betting Closed", "Bets can only be placed on upcoming matches.");
                }
            }
            return;
        }

        if (isEditMode) {
            // Pre-fill with existing bet values for editing
            setSelectedTeamForBet(myExistingBet!.teamId);
            setBetAmount(String(myExistingBet!.amount));
            setBetStep(1);
            setShowBetModal(true);
            return;
        }

        if ((userProfile?.coins || 0) < 100) {
            if (Platform.OS === 'web') {
                window.alert("You need at least 100 coins to place a bet.");
            } else {
                Alert.alert("Insufficient Coins", "You need at least 100 coins to place a bet.");
            }
            return;
        }

        setBetStep(1);
        setSelectedTeamForBet('');
        setBetAmount('100');
        setShowBetModal(true);
    };

    const submitBet = async () => {
        const amount = parseInt(betAmount, 10);
        if (isNaN(amount) || amount < 10) {
            if (Platform.OS === 'web') window.alert("Enter a valid amount (min 10)");
            else Alert.alert("Invalid Amount", "Enter a valid amount (min 10)");
            return;
        }
        const maxAvailable = (userProfile?.coins || 0) + (isEditMode && myExistingBet ? myExistingBet.amount : 0);
        if (amount > maxAvailable) {
            if (Platform.OS === 'web') window.alert("You don't have enough coins");
            else Alert.alert("Insufficient Coins", "You don't have enough coins");
            return;
        }

        try {
            if (isEditMode) {
                await updateBet({
                    userId: userId as Id<'users'>,
                    matchId: match.vlrId,
                    newAmount: amount,
                    newTeamId: selectedTeamForBet,
                });
                setShowBetModal(false);
                if (Platform.OS === 'web') {
                    window.alert(`Updated! ${amount} coins on ${selectedTeamForBet}`);
                } else {
                    Alert.alert("Updated!", `${amount} coins on ${selectedTeamForBet}`);
                }
            } else {
                await placeBet({
                    userId: userId as Id<'users'>,
                    matchId: match.vlrId,
                    amount: amount,
                    teamId: selectedTeamForBet,
                });
                setShowBetModal(false);
                if (Platform.OS === 'web') {
                    window.alert(`Success! You placed ${amount} coins on ${selectedTeamForBet}!`);
                } else {
                    Alert.alert("Success", `You placed ${amount} coins on ${selectedTeamForBet}!`);
                }
            }
        } catch (error: any) {
            if (Platform.OS === 'web') window.alert(error.message || "Failed to place bet");
            else Alert.alert("Error", error.message || "Failed to place bet");
        }
    };

    const handleCancelBet = async () => {
        if (!userId || !myExistingBet) return;
        const doCancel = async () => {
            try {
                const res = await cancelBet({
                    userId: userId as Id<'users'>,
                    matchId: match.vlrId,
                });
                setShowBetModal(false);
                if (Platform.OS === 'web') {
                    window.alert(`Bet Cancelled!\n\n${res.refundAmount} coins refunded to your account.`);
                } else {
                    Alert.alert("Bet Cancelled", `${res.refundAmount} coins refunded to your account.`);
                }
            } catch (error: any) {
                if (Platform.OS === 'web') window.alert(error.message || "Failed to cancel bet");
                else Alert.alert("Error", error.message || "Failed to cancel bet");
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Cancel your bet of ${myExistingBet.amount} coins and get a full refund?`)) {
                doCancel();
            }
        } else {
            Alert.alert(
                "Cancel Bet",
                `Are you sure you want to cancel your bet of ${myExistingBet.amount} coins and get a full refund?`,
                [
                    { text: "No", style: "cancel" },
                    { text: "Yes, Refund Coins", style: "destructive", onPress: doCancel }
                ]
            );
        }
    };

    const handleUsersPress = () => {
        setShowBettorsModal(true);
    };

    // Construct team abbreviation if names are too long, or just use names.
    // The user wanted: Logo1 Team1 X Team2 Logo2. 
    // We'll arrange it nicely.
    return (
        <Pressable onPress={handlePress} style={styles.card}>
            {match.status === 'live' && (
                <View style={styles.liveIndicator}>
                    <Text style={styles.liveText}>LIVE</Text>
                </View>
            )}

            {/* Top Row: Logos and Teams */}
            <View style={styles.topRow}>
                <View style={styles.teamsDisplay}>
                    <View style={styles.teamBadge}>
                        {match.team1.logoUrl ? (
                            <Image source={{ uri: normalizeLogoUrl(match.team1.logoUrl) }} style={styles.teamLogo} resizeMode="contain" />
                        ) : (
                            <View style={styles.teamLogoPlaceholder} />
                        )}
                        <Text style={styles.teamNameText} numberOfLines={1}>
                            {formatTeamName(match.team1.name, match.team1.shortName)}
                        </Text>
                    </View>

                    <Text style={styles.xText}>X</Text>
                    
                    <View style={styles.teamBadge}>
                        {match.team2.logoUrl ? (
                            <Image source={{ uri: normalizeLogoUrl(match.team2.logoUrl) }} style={styles.teamLogo} resizeMode="contain" />
                        ) : (
                            <View style={styles.teamLogoPlaceholder} />
                        )}
                        <Text style={styles.teamNameText} numberOfLines={1}>
                            {formatTeamName(match.team2.name, match.team2.shortName)}
                        </Text>
                    </View>
                </View>
                <View style={styles.betActionContainer}>
                    {match.status !== 'completed' && (
                        <Pressable
                            onPress={handleBetPress}
                            style={[
                                styles.betIconButton,
                                isEditMode && { backgroundColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderColor: Colors.accent }
                            ]}
                        >
                            {isEditMode ? (
                                <Ionicons name="pencil" size={16} color={Colors.accent} />
                            ) : (
                                <FontAwesome5 name="coins" size={18} color={Colors.textPrimary} />
                            )}
                        </Pressable>
                    )}
                    {myExistingBet && (
                        <Text style={[styles.betAmountText, { color: Colors.accent }]}>
                            {myExistingBet.amount}✓
                        </Text>
                    )}
                    {!myExistingBet && <Text style={styles.betAmountText}>100</Text>}
                </View>
            </View>

            {/* Middle Row: Time */}
            <View style={styles.middleRow}>
                <Text style={styles.timeText}>{formatTime(match.time, !!showYear)}</Text>
            </View>

            {/* Bottom Row: Users placed bet */}
            <View style={styles.bottomRow}>
                <Pressable onPress={handleUsersPress} style={styles.usersBetContainer}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.usersBetText}>{actualUsers} users placed bet</Text>
                </Pressable>
                
                {match.status === 'completed' && (
                    <Text style={styles.scoreText}>
                        {match.team1.score} - {match.team2.score}
                    </Text>
                )}
            </View>

            {/* Bettors Modal */}
            <Modal visible={showBettorsModal} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Bettors for this Match</Text>
                        <ScrollView style={{maxHeight: 300, width: '100%'}}>
                            {matchBets.length > 0 ? matchBets.map((bet: any, idx: number) => (
                                <View key={idx} style={styles.bettorRow}>
                                    {bet.pfp ? (
                                        <Image source={{ uri: bet.pfp }} style={styles.bettorPfp} />
                                    ) : (
                                        <View style={styles.bettorPfpPlaceholder}>
                                            <Ionicons name="person" size={16} color={Colors.textSecondary} />
                                        </View>
                                    )}
                                    <View style={styles.bettorInfo}>
                                        <Text style={styles.bettorName}>@{bet.username}</Text>
                                        {userProfile?.isAdmin && (
                                            <Text style={styles.bettorAmount}>{bet.amount} coins on {bet.teamId}</Text>
                                        )}
                                    </View>
                                </View>
                            )) : (
                                <Text style={styles.noBetsText}>No bets placed yet.</Text>
                            )}
                        </ScrollView>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setShowBettorsModal(false)}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Bet Modal */}
            <Modal visible={showBetModal} animationType="slide" transparent={true} onRequestClose={() => setShowBetModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {betStep === 1 ? (
                            <>
                                <Text style={styles.modalTitle}>{isEditMode ? 'Edit Your Bet' : 'Select a Team'}</Text>
                                <Text style={styles.modalSubtitle}>{isEditMode ? `Currently: ${myExistingBet?.amount}c on ${myExistingBet?.teamId}` : 'Which team will win?'}</Text>
                                
                                <View style={styles.teamSelectRow}>
                                    <TouchableOpacity style={[styles.teamSelectButton, selectedTeamForBet === match.team1.name && styles.teamSelectButtonActive]} onPress={() => setSelectedTeamForBet(match.team1.name)}>
                                        <Text style={styles.teamSelectText}>{match.team1.name}</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity style={[styles.teamSelectButton, selectedTeamForBet === match.team2.name && styles.teamSelectButtonActive]} onPress={() => setSelectedTeamForBet(match.team2.name)}>
                                        <Text style={styles.teamSelectText}>{match.team2.name}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalActionRow}>
                                    <TouchableOpacity style={styles.cancelButton} onPress={() => setShowBetModal(false)}>
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.primaryButton, !selectedTeamForBet && {opacity: 0.5}]} onPress={() => selectedTeamForBet && setBetStep(2)} disabled={!selectedTeamForBet}>
                                        <Text style={styles.primaryButtonText}>Next</Text>
                                    </TouchableOpacity>
                                </View>

                                {isEditMode && (
                                    <TouchableOpacity 
                                        style={styles.deleteBetBtn} 
                                        onPress={handleCancelBet}
                                    >
                                        <Ionicons name="trash-outline" size={16} color={Colors.danger} style={{ marginRight: 6 }} />
                                        <Text style={styles.deleteBetBtnText}>Cancel Bet & Refund ({myExistingBet?.amount} coins)</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <>
                                <Text style={styles.modalTitle}>Enter Amount</Text>
                                <Text style={styles.modalSubtitle}>Betting on {selectedTeamForBet}</Text>
                                
                                <View style={styles.inputContainer}>
                                    <FontAwesome5 name="coins" size={16} color={Colors.accent} style={{marginRight: 8}} />
                                    <TextInput 
                                        style={styles.betInput}
                                        value={betAmount}
                                        onChangeText={setBetAmount}
                                        keyboardType="numeric"
                                        placeholder="Amount"
                                        placeholderTextColor={Colors.textSecondary}
                                    />
                                </View>
                                
                                <View style={styles.quickAmountRow}>
                                    <TouchableOpacity style={styles.quickAmountButton} onPress={() => {
                                        const maxCoins = (userProfile?.coins || 0) + (isEditMode && myExistingBet ? myExistingBet.amount : 0);
                                        setBetAmount(Math.min(maxCoins, parseInt(betAmount || '0') + 100).toString());
                                    }}>
                                        <Text style={styles.quickAmountText}>+100</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.quickAmountButton} onPress={() => {
                                        const maxCoins = (userProfile?.coins || 0) + (isEditMode && myExistingBet ? myExistingBet.amount : 0);
                                        setBetAmount(maxCoins.toString());
                                    }}>
                                        <Text style={styles.quickAmountText}>All In</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalActionRow}>
                                    <TouchableOpacity style={styles.cancelButton} onPress={() => setBetStep(1)}>
                                        <Text style={styles.cancelButtonText}>Back</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.primaryButton} onPress={submitBet}>
                                        <Text style={styles.primaryButtonText}>{isEditMode ? 'Update Bet' : 'Place Bet'}</Text>
                                    </TouchableOpacity>
                                </View>

                                {isEditMode && (
                                    <TouchableOpacity 
                                        style={styles.deleteBetBtn} 
                                        onPress={handleCancelBet}
                                    >
                                        <Ionicons name="trash-outline" size={16} color={Colors.danger} style={{ marginRight: 6 }} />
                                        <Text style={styles.deleteBetBtnText}>Cancel Bet & Refund ({myExistingBet?.amount} coins)</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: Platform.OS === 'web' ? 8 : 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    liveIndicator: {
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: [{ translateX: -20 }],
        backgroundColor: Colors.danger,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        zIndex: 10,
    },
    liveText: {
        color: '#FFF',
        fontSize: 10,
        fontFamily: 'Inter_700Bold',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    teamsDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
        justifyContent: 'flex-start',
    },
    teamBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    teamLogo: {
        width: 28,
        height: 28,
        marginRight: 6,
    },
    teamLogoPlaceholder: {
        width: 28,
        height: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 14,
        marginRight: 6,
    },
    teamNameText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Inter_600SemiBold',
        flexShrink: 1,
    },
    xText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
        fontFamily: 'Inter_400Regular',
        marginHorizontal: 16,
    },
    betActionContainer: {
        alignItems: 'center',
    },
    betIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    middleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    timeText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'Inter_600SemiBold',
    },
    betAmountText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    usersBetContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    usersBetText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
        fontFamily: 'Inter_500Medium',
    },
    scoreText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: 'Inter_700Bold',
        color: Colors.textPrimary,
        marginBottom: 16,
    },
    bettorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    bettorPfp: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    bettorPfpPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bettorInfo: {
        flex: 1,
    },
    bettorName: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
    },
    bettorAmount: {
        color: Colors.accent,
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
    },
    noBetsText: {
        color: Colors.textSecondary,
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 20,
    },
    closeButton: {
        marginTop: 24,
        backgroundColor: Colors.accent,
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
    },
    closeButtonText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
    },
    modalSubtitle: {
        fontSize: 14,
        fontFamily: 'Inter_400Regular',
        color: Colors.textSecondary,
        marginBottom: 20,
    },
    teamSelectRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    teamSelectButton: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginHorizontal: 8,
        alignItems: 'center',
    },
    teamSelectButtonActive: {
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        borderColor: Colors.accent,
    },
    teamSelectText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
    },
    modalActionRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        marginRight: 8,
    },
    cancelButtonText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
    },
    primaryButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: Colors.accent,
        alignItems: 'center',
        marginLeft: 8,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        width: '100%',
        marginBottom: 16,
    },
    betInput: {
        flex: 1,
        color: Colors.textPrimary,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 18,
    },
    quickAmountRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    quickAmountButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    quickAmountText: {
        color: Colors.textPrimary,
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
    },
    deleteBetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 70, 85, 0.15)',
        borderWidth: 1,
        borderColor: Colors.danger,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 14,
        width: '100%',
    },
    deleteBetBtnText: {
        color: Colors.danger,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
    }
});
