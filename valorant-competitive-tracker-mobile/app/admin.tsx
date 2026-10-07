import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../providers/AuthProvider';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useRouter } from 'expo-router';

export default function AdminPanel() {
    const { userId, userProfile } = useAuth();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [amountMap, setAmountMap] = useState<Record<string, string>>({});

    const allUsers = useQuery(
        api.admin.searchAllUsers,
        userId ? { adminId: userId as any, searchQuery } : "skip"
    );
    
    const removeUserMutation = useMutation(api.admin.removeUser);
    const giveCoinsMutation = useMutation(api.admin.giveCoins);

    if (!userProfile?.isAdmin) {
        return (
            <ScreenWrapper>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.center}>
                        <Text style={styles.title}>Access Denied</Text>
                        <Text style={styles.subtitle}>You do not have admin privileges.</Text>
                    </View>
                </SafeAreaView>
            </ScreenWrapper>
        );
    }

    const handleRemoveUser = async (targetUserId: string, username: string) => {
        const doRemove = async () => {
            try {
                await removeUserMutation({ adminId: userId as any, targetUserId: targetUserId as any });
                if (Platform.OS === 'web') window.alert('User removed');
                else Alert.alert('Success', 'User removed');
            } catch (e: any) {
                if (Platform.OS === 'web') window.alert(e.message);
                else Alert.alert('Error', e.message);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Are you sure you want to completely delete @${username}?`)) {
                doRemove();
            }
        } else {
            Alert.alert("Delete User", `Are you sure you want to completely delete @${username}?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: doRemove }
            ]);
        }
    };

    const handleGiveCoins = async (targetUserId: string, username: string) => {
        const amount = parseInt(amountMap[targetUserId] || "0");
        if (isNaN(amount) || amount <= 0) {
            if (Platform.OS === 'web') window.alert("Enter a valid amount");
            else Alert.alert("Error", "Enter a valid amount");
            return;
        }

        try {
            await giveCoinsMutation({ adminId: userId as any, targetUserId: targetUserId as any, amount });
            setAmountMap(prev => ({ ...prev, [targetUserId]: "" }));
            if (Platform.OS === 'web') window.alert(`Gave ${amount} coins to @${username}`);
            else Alert.alert('Success', `Gave ${amount} coins to @${username}`);
        } catch (e: any) {
            if (Platform.OS === 'web') window.alert(e.message);
            else Alert.alert('Error', e.message);
        }
    };

    return (
        <ScreenWrapper>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Admin Dashboard</Text>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.input}
                        placeholder="Search by username or UID..."
                        placeholderTextColor={Colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                    />
                </View>

                <ScrollView style={styles.list}>
                    {allUsers === undefined ? (
                        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
                    ) : allUsers.map((u: any) => (
                        <View key={u._id} style={styles.userCard}>
                            <View style={styles.userInfo}>
                                <Text style={styles.username}>@{u.username} {u.isAdmin && <Text style={{color: Colors.accent}}>[ADMIN]</Text>}</Text>
                                <Text style={styles.coins}>Coins: {u.coins}</Text>
                            </View>

                            <View style={styles.actions}>
                                <TextInput
                                    style={styles.coinInput}
                                    placeholder="Amount"
                                    placeholderTextColor={Colors.textSecondary}
                                    keyboardType="numeric"
                                    value={amountMap[u._id] || ""}
                                    onChangeText={(val) => setAmountMap(prev => ({ ...prev, [u._id]: val }))}
                                />
                                <TouchableOpacity style={styles.giveBtn} onPress={() => handleGiveCoins(u._id, u.username)}>
                                    <Text style={styles.btnText}>Give</Text>
                                </TouchableOpacity>
                                
                                {u._id !== userId && (
                                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveUser(u._id, u.username)}>
                                        <Ionicons name="trash" size={16} color="#fff" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </SafeAreaView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
    backBtn: { marginRight: 16 },
    title: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.textPrimary },
    subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 16, height: 50, marginBottom: 16 },
    input: { flex: 1, color: Colors.textPrimary, fontFamily: 'Inter_400Regular' },
    list: { flex: 1, paddingHorizontal: 20 },
    userCard: { backgroundColor: '#1e1e1e', padding: 16, borderRadius: 12, marginBottom: 12 },
    userInfo: { marginBottom: 12 },
    username: { color: Colors.textPrimary, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
    coins: { color: '#ffd700', fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 4 },
    actions: { flexDirection: 'row', alignItems: 'center' },
    coinInput: { backgroundColor: '#2a2a2a', color: Colors.textPrimary, borderRadius: 8, paddingHorizontal: 12, height: 36, width: 80, marginRight: 8 },
    giveBtn: { backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 16, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
    removeBtn: { backgroundColor: Colors.danger, borderRadius: 8, height: 36, width: 36, justifyContent: 'center', alignItems: 'center' }
});
