import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { VCT_TEAMS } from '../../constants/teams';
import { Colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../providers/AuthProvider';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import * as ImagePicker from 'expo-image-picker';
import ImageCropModal from '../../components/ImageCropModal';

export default function ProfilePage() {
    const { userId, login, logout, isLoading, userProfile } = useAuth();
    
    // Auth Flow State
    const [authMode, setAuthMode] = useState<'selection' | 'login' | 'signup'>('selection');
    const [signupStep, setSignupStep] = useState(1);
    
    // Auth Forms
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    // Profile Forms
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState(''); // Male or Female
    const [pfp, setPfp] = useState('');
    const [favTeams, setFavTeams] = useState<string[]>([]);
    
    // Friend Form
    const [friendInput, setFriendInput] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Convex Mutations & Queries
    const signupMutation = useMutation(api.auth.signup);
    const loginMutation = useMutation(api.auth.login);
    const updateProfileMutation = useMutation(api.auth.updateProfile);
    const addFriendMutation = useMutation(api.users.addFriend);
    const sendFriendRequestMutation = useMutation(api.users.sendFriendRequest);
    const respondToFriendRequestMutation = useMutation(api.users.respondToFriendRequest);
    const removeFriendMutation = useMutation(api.users.removeFriend);
    const updateFavoriteTeamsMutation = useMutation(api.users.updateFavoriteTeams);
    const updateProfilePictureMutation = useMutation(api.users.updateProfilePicture);
    const markNotificationsReadMutation = useMutation(api.users.markNotificationsRead);
    const usernameCheck = useQuery(api.users.checkUsername, { username });

    const searchResults = useQuery(
        api.users.searchUsers,
        userId && friendInput.trim().length > 0
            ? { currentUserId: userId as any, query: friendInput.trim() }
            : "skip"
    );

    const pendingRequests = useQuery(
        api.users.getPendingRequests,
        userId ? { userId: userId as any } : "skip"
    );

    const notifications = useQuery(
        api.users.getNotifications,
        userId ? { userId: userId as any } : "skip"
    );

    // Modal state
    const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
    const [isNotifModalVisible, setIsNotifModalVisible] = useState(false);
    const [tempFavTeams, setTempFavTeams] = useState<string[]>([]);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    // Image crop state (web only)
    const [cropModalVisible, setCropModalVisible] = useState(false);
    const [pendingCropUri, setPendingCropUri] = useState<string | null>(null);

    // Validation
    const isUsernameValid = /^[a-zA-Z0-9_]+$/.test(username) && !username.includes(' ');
    const hasCapital = /[A-Z]/.test(password);
    const hasLength = password.length >= 8;
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasNoSpaces = !password.includes(' ');
    const isPasswordValid = hasCapital && hasLength && hasSpecial && hasNoSpaces;

    const handleLogin = async () => {
        setIsSubmitting(true);
        try {
            const id = await loginMutation({ username, password });
            await login(id);
        } catch (e: any) {
            if (e.message.includes("Username not found")) {
                if (Platform.OS === 'web') {
                    if (window.confirm("Account Not Found\n\nWe couldn't find an account with that username. Would you like to create one?")) {
                        setAuthMode('signup');
                    }
                } else {
                    Alert.alert(
                        "Account Not Found",
                        "We couldn't find an account with that username. Would you like to create one?",
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Sign Up", onPress: () => setAuthMode('signup') }
                        ]
                    );
                }
            } else {
                if (Platform.OS === 'web') {
                    window.alert(`Login Failed\n\n${e.message}`);
                } else {
                    Alert.alert("Login Failed", e.message);
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignupStep1 = async () => {
        if (!isUsernameValid) {
            if (Platform.OS === 'web') window.alert("Invalid Username\n\nOnly A-Z, 0-9, and _ are allowed. No spaces.");
            else Alert.alert("Invalid Username", "Only A-Z, 0-9, and _ are allowed. No spaces.");
            return;
        }
        if (!isPasswordValid) {
            if (Platform.OS === 'web') window.alert("Invalid Password\n\nPlease meet all password requirements.");
            else Alert.alert("Invalid Password", "Please meet all password requirements.");
            return;
        }
        
        setIsSubmitting(true);
        try {
            const id = await signupMutation({ username, password });
            await login(id);
            setSignupStep(2);
        } catch (e: any) {
            if (Platform.OS === 'web') window.alert(`Signup Failed\n\n${e.message}`);
            else Alert.alert("Signup Failed", e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignupStep2 = async () => {
        if (!name.trim()) {
            if (Platform.OS === 'web') window.alert("Name is required.");
            else Alert.alert("Required", "Please enter your name.");
            return;
        }
        if (!age.trim() || isNaN(parseInt(age)) || parseInt(age) < 1 || parseInt(age) > 120) {
            if (Platform.OS === 'web') window.alert("Please enter a valid age.");
            else Alert.alert("Required", "Please enter a valid age.");
            return;
        }
        if (!gender) {
            if (Platform.OS === 'web') window.alert("Please select your gender.");
            else Alert.alert("Required", "Please select your gender.");
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProfileMutation({
                userId: userId as any,
                name: name.trim(),
                age: parseInt(age),
                gender: gender,
                pfp: pfp || undefined,
                favoriteTeams: favTeams
            });
            setSignupStep(3); // Done
        } catch (e: any) {
            Alert.alert("Profile Update Failed", e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendFriendRequest = async (target: string) => {
        if (!target.trim() || !userId) return;
        setIsSubmitting(true);
        try {
            const res = await sendFriendRequestMutation({
                senderId: userId as any,
                targetIdentifier: target.trim(),
            });
            if (res.autoAccepted) {
                if (Platform.OS === 'web') window.alert(`Accepted @${res.friendUsername}'s request! You are now friends.`);
                else Alert.alert("Success", `Accepted @${res.friendUsername}'s request! You are now friends.`);
            } else {
                if (Platform.OS === 'web') window.alert(`Friend request sent to @${res.friendUsername}!`);
                else Alert.alert("Success", `Friend request sent to @${res.friendUsername}!`);
            }
            setFriendInput('');
        } catch (e: any) {
            let msg = e.message || "Failed to send request";
            if (msg.includes("Uncaught Error: ")) msg = msg.split("Uncaught Error: ")[1];
            if (Platform.OS === 'web') window.alert(`Error\n\n${msg}`);
            else Alert.alert("Error", msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRespondToRequest = async (requestId: any, action: 'accept' | 'decline') => {
        if (!userId) return;
        setIsSubmitting(true);
        try {
            await respondToFriendRequestMutation({
                requestId,
                userId: userId as any,
                action,
            });
            if (action === 'accept') {
                if (Platform.OS === 'web') window.alert("Friend request accepted!");
                else Alert.alert("Success", "Friend request accepted!");
            }
        } catch (e: any) {
            let msg = e.message || "Action failed";
            if (msg.includes("Uncaught Error: ")) msg = msg.split("Uncaught Error: ")[1];
            if (Platform.OS === 'web') window.alert(`Error\n\n${msg}`);
            else Alert.alert("Error", msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveFriend = async (friendId: any, friendUsername: string) => {
        if (!userId) return;
        const doRemove = async () => {
            try {
                await removeFriendMutation({ userId: userId as any, friendId });
            } catch (e: any) {
                Alert.alert("Error", e.message);
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm(`Remove @${friendUsername} from your friends list?`)) {
                doRemove();
            }
        } else {
            Alert.alert(
                "Remove Friend",
                `Are you sure you want to remove @${friendUsername}?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: doRemove }
                ]
            );
        }
    };

    const toggleFavTeam = (team: string) => {
        if (favTeams.includes(team)) {
            setFavTeams(favTeams.filter(t => t !== team));
        } else {
            if (favTeams.length < 2) {
                setFavTeams([...favTeams, team]);
            } else {
                if (Platform.OS === 'web') {
                    window.alert("Limit Reached\n\nYou can only select up to 2 favorite teams.");
                } else {
                    Alert.alert("Limit Reached", "You can only select up to 2 favorite teams.");
                }
            }
        }
    };

    const handleUpdateFavTeams = async () => {
        setIsSubmitting(true);
        try {
            await updateFavoriteTeamsMutation({
                userId: userId as any,
                teams: tempFavTeams
            });
            setIsTeamModalVisible(false);
            Alert.alert("Success", "Favorite teams updated.");
        } catch (e: any) {
            let msg = e.message;
            if (msg.includes("You can change your favorite teams again in")) {
                msg = msg.split("Uncaught Error: ")[1] || msg;
            }
            if (Platform.OS === 'web') {
                window.alert(`Wait\n\n${msg}`);
            } else {
                Alert.alert("Wait", msg);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const pickImage = async () => {
        if (Platform.OS === 'web') {
            // On web: pick without editing, then show our custom crop modal
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.9,
                base64: false,
            });
            if (!result.canceled && result.assets[0]) {
                setPendingCropUri(result.assets[0].uri);
                setCropModalVisible(true);
            }
        } else {
            // On native: expo-image-picker handles cropping natively
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });
            if (!result.canceled && result.assets[0].base64) {
                const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
                await saveProfilePicture(base64Image);
            }
        }
    };

    const saveProfilePicture = async (base64Image: string) => {
        if (userId) {
            setIsSubmitting(true);
            try {
                await updateProfilePictureMutation({ userId: userId as any, base64Image });
            } catch (e) {
                if (Platform.OS === 'web') {
                    window.alert('Error\n\nFailed to update profile picture');
                } else {
                    Alert.alert('Error', 'Failed to update profile picture');
                }
            } finally {
                setIsSubmitting(false);
            }
        } else {
            setPfp(base64Image);
        }
    };

    if (isLoading) {
        return (
            <ScreenWrapper>
                <View style={[styles.container, { justifyContent: 'center' }]}>
                    <ActivityIndicator size="large" color={Colors.accent} />
                </View>
            </ScreenWrapper>
        );
    }

    if (!userId) {
        return (
            <ScreenWrapper>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        {authMode === 'selection' ? (
                            <>
                                <Image 
                                    source={require('../../Logo.jpg')} 
                                    style={styles.logo} 
                                    resizeMode="cover" 
                                />
                                <Text style={styles.title}>Join Seungki</Text>
                                <Text style={styles.subtitle}>Track teams, make bets, and connect with friends.</Text>
                                
                                <TouchableOpacity style={styles.primaryButton} onPress={() => setAuthMode('login')}>
                                    <Text style={styles.primaryButtonText}>Log In</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }]} onPress={() => setAuthMode('signup')}>
                                    <Text style={styles.primaryButtonText}>Sign Up</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity 
                                    style={{ position: 'absolute', top: 0, left: 24, zIndex: 10 }} 
                                    onPress={() => setAuthMode('selection')}
                                >
                                    <Ionicons name="arrow-back" size={28} color={Colors.textPrimary} />
                                </TouchableOpacity>
                                
                                <Image 
                                    source={require('../../Logo.jpg')} 
                                    style={styles.logo} 
                                    resizeMode="cover" 
                                />
                                <Text style={styles.title}>{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</Text>
                                
                                <View style={styles.inputContainer}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Username"
                                        placeholderTextColor={Colors.textSecondary}
                                        value={username}
                                        onChangeText={setUsername}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    {username.length > 0 && (
                                        <Text style={[
                                            styles.validationText, 
                                            !isUsernameValid ? styles.invalid : 
                                            (authMode === 'signup' ? 
                                                (usernameCheck?.available ? styles.valid : styles.invalid) : 
                                                (!usernameCheck?.available ? styles.valid : styles.invalid)
                                            )
                                        ]}>
                                            {!isUsernameValid ? "✗ Only A-Z, 0-9, and _ allowed" : 
                                                (authMode === 'signup' ? 
                                                    (usernameCheck?.available ? "✓ Username available" : "✗ Username taken") :
                                                    (!usernameCheck?.available ? "✓ Username found" : "✗ Username not found")
                                                )
                                            }
                                        </Text>
                                    )}

                                    <TextInput
                                        style={[styles.input, { marginTop: 16 }]}
                                        placeholder="Password"
                                        placeholderTextColor={Colors.textSecondary}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                    {authMode === 'signup' && password.length > 0 && (
                                        <View style={styles.checklist}>
                                            <Text style={[styles.validationText, hasCapital ? styles.valid : styles.invalid]}>
                                                {hasCapital ? "✓" : "○"} 1 Capital Letter
                                            </Text>
                                            <Text style={[styles.validationText, hasLength ? styles.valid : styles.invalid]}>
                                                {hasLength ? "✓" : "○"} 8+ Characters
                                            </Text>
                                            <Text style={[styles.validationText, hasSpecial ? styles.valid : styles.invalid]}>
                                                {hasSpecial ? "✓" : "○"} 1 Special Character
                                            </Text>
                                            <Text style={[styles.validationText, hasNoSpaces ? styles.valid : styles.invalid]}>
                                                {hasNoSpaces ? "✓" : "○"} No Spaces
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity 
                                    style={styles.primaryButton} 
                                    onPress={authMode === 'login' ? handleLogin : handleSignupStep1}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color={Colors.textPrimary} />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>{authMode === 'login' ? 'Log In' : 'Create Account'}</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity style={{ marginTop: 24 }} onPress={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
                                    <Text style={styles.linkText}>
                                        {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </ScrollView>
                </SafeAreaView>
                </KeyboardAvoidingView>
            </ScreenWrapper>
        );
    }

    if (signupStep === 2) {
        // Step 2 Profile Setup
        return (
            <ScreenWrapper>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <TouchableOpacity onPress={pickImage} style={{ alignSelf: 'center', marginBottom: 16 }}>
                            <Image 
                                source={pfp ? { uri: pfp } : require('../../Logo.jpg')} 
                                style={styles.avatar} 
                                resizeMode="cover" 
                            />
                            <View style={styles.editPfpBadgeLarge}>
                                <Ionicons name="camera" size={16} color="#fff" />
                            </View>
                        </TouchableOpacity>
                        
                        <Text style={styles.title}>Complete Your Profile</Text>
                        <Text style={styles.subtitle}>Tell us a bit about yourself</Text>

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Name *"
                                placeholderTextColor={Colors.textSecondary}
                                value={name}
                                onChangeText={setName}
                            />
                            <TextInput
                                style={[styles.input, { marginTop: 16 }]}
                                placeholder="Age *"
                                placeholderTextColor={Colors.textSecondary}
                                value={age}
                                onChangeText={setAge}
                                keyboardType="numeric"
                            />
                            
                            <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>Gender <Text style={{ color: Colors.danger }}>*</Text></Text>
                            <View style={styles.genderRow}>
                                <TouchableOpacity 
                                    style={[styles.genderBtn, gender === 'Male' && styles.genderBtnActive]}
                                    onPress={() => setGender('Male')}
                                >
                                    <Text style={[styles.genderText, gender === 'Male' && styles.genderTextActive]}>Male</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.genderBtn, gender === 'Female' && styles.genderBtnActive]}
                                    onPress={() => setGender('Female')}
                                >
                                    <Text style={[styles.genderText, gender === 'Female' && styles.genderTextActive]}>Female</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Favorite Teams <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>(Optional, max 2)</Text></Text>
                            <View style={styles.teamsGrid}>
                                {VCT_TEAMS.map(team => (
                                    <TouchableOpacity 
                                        key={team} 
                                        style={[styles.teamBtn, favTeams.includes(team) && styles.teamBtnActive]}
                                        onPress={() => toggleFavTeam(team)}
                                    >
                                        <Text style={[styles.teamBtnText, favTeams.includes(team) && styles.teamBtnTextActive]}>{team}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={styles.primaryButton} 
                            onPress={handleSignupStep2}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color={Colors.textPrimary} />
                            ) : (
                                <Text style={styles.primaryButtonText}>Finish Setup</Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Notification Bell Header */}
                <TouchableOpacity 
                    style={styles.notifHeaderBtn} 
                    onPress={async () => {
                        setIsNotifModalVisible(true);
                        if (userId) {
                            try { await markNotificationsReadMutation({ userId: userId as any }); } catch (e) {}
                        }
                    }}
                >
                    <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
                    {((pendingRequests?.length || 0) + (notifications?.filter((n: any) => !n.read)?.length || 0)) > 0 && (
                        <View style={styles.notifBadge}>
                            <Text style={styles.notifBadgeText}>
                                {(pendingRequests?.length || 0) + (notifications?.filter((n: any) => !n.read)?.length || 0)}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity 
                        onPress={pickImage} 
                        onLongPress={() => {
                            if (userProfile?.pfp) {
                                setFullScreenImage(userProfile.pfp);
                            }
                        }}
                        style={{ alignSelf: 'center' }}
                    >
                        <Image 
                            source={userProfile?.pfp ? { uri: userProfile.pfp } : require('../../Logo.jpg')} 
                            style={styles.avatar} 
                            resizeMode="cover"
                        />
                        <View style={styles.editPfpBadgeLarge}>
                            <Ionicons name="camera" size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.title}>{userProfile?.name || userProfile?.username}</Text>
                    <Text style={styles.subtitle}>@{userProfile?.username}</Text>
                    
                    <TouchableOpacity style={styles.uidContainer} onPress={async () => {
                        if (userProfile?.shortId) {
                            await Clipboard.setStringAsync(userProfile.shortId);
                            Alert.alert("Copied", "UID copied to clipboard");
                        }
                    }}>
                        <Text style={styles.uidText}>UID: {userProfile?.shortId}</Text>
                        <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                    
                    <View style={styles.statsContainer}>
                        <TouchableOpacity style={styles.statBox} onPress={() => {
                            setTempFavTeams(userProfile?.favoriteTeams || []);
                            setIsTeamModalVisible(true);
                        }}>
                            <Ionicons name="star" size={24} color={Colors.accent} />
                            <Text style={styles.statNumber}>{userProfile?.favoriteTeams?.length || 0}</Text>
                            <Text style={styles.statLabel}>Favorites</Text>
                        </TouchableOpacity>
                        <View style={styles.statBox}>
                            <Ionicons name="people" size={24} color={Colors.accent} />
                            <Text style={styles.statNumber}>{userProfile?.friends?.length || 0}</Text>
                            <Text style={styles.statLabel}>Friends</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Ionicons name="cash-outline" size={24} color="#ffd700" />
                            <Text style={styles.statNumber}>{userProfile?.coins || 0}</Text>
                            <Text style={styles.statLabel}>Coins</Text>
                        </View>
                    </View>

                    {/* Pending Friend Requests Section */}
                    {pendingRequests && pendingRequests.length > 0 && (
                        <View style={styles.pendingRequestsSection}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Ionicons name="notifications" size={20} color={Colors.accent} style={{ marginRight: 8 }} />
                                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Friend Requests ({pendingRequests.length})</Text>
                            </View>
                            {pendingRequests.map((req: any) => (
                                <View key={req._id} style={styles.pendingRequestCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        {req.sender.pfp ? (
                                            <TouchableOpacity onLongPress={() => setFullScreenImage(req.sender.pfp)}>
                                                <Image source={{ uri: req.sender.pfp }} style={styles.friendAvatar} />
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={styles.friendAvatarPlaceholder}>
                                                <Text style={styles.friendAvatarText}>{req.sender.username[0].toUpperCase()}</Text>
                                            </View>
                                        )}
                                        <View style={{ marginLeft: 10, flex: 1 }}>
                                            <Text style={styles.friendName}>{req.sender.name || `@${req.sender.username}`}</Text>
                                            <Text style={styles.friendSubtext}>@{req.sender.username} • UID: {req.sender.shortId}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity
                                            style={styles.acceptButton}
                                            onPress={() => handleRespondToRequest(req._id, 'accept')}
                                            disabled={isSubmitting}
                                        >
                                            <Ionicons name="checkmark" size={16} color="#fff" style={{ marginRight: 4 }} />
                                            <Text style={styles.acceptButtonText}>Accept</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.declineButton}
                                            onPress={() => handleRespondToRequest(req._id, 'decline')}
                                            disabled={isSubmitting}
                                        >
                                            <Ionicons name="close" size={18} color={Colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Add Friend Section */}
                    <View style={styles.addFriendSection}>
                        <Text style={styles.sectionTitle}>Add a Friend</Text>
                        <Text style={{ color: Colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
                            Enter Username or 10-digit UID to search:
                        </Text>
                        <View style={styles.friendRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, minWidth: 0, marginBottom: 0, height: 52 }]}
                                placeholder="Enter Username or UID..."
                                placeholderTextColor={Colors.textSecondary}
                                value={friendInput}
                                onChangeText={setFriendInput}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity style={styles.addButton} onPress={() => handleSendFriendRequest(friendInput)} disabled={isSubmitting || !friendInput.trim()}>
                                <Ionicons name="person-add" size={20} color={Colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {/* Live Search Autocomplete Dropdown */}
                        {friendInput.trim().length > 0 && (
                            <View style={styles.searchResultsContainer}>
                                {searchResults === undefined ? (
                                    <View style={styles.searchLoadingRow}>
                                        <ActivityIndicator size="small" color={Colors.accent} />
                                        <Text style={styles.searchLoadingText}>Searching users...</Text>
                                    </View>
                                ) : searchResults.length === 0 ? (
                                    <Text style={styles.noResultsText}>No user found matching "{friendInput}"</Text>
                                ) : (
                                    searchResults.map((user: any) => (
                                        <View key={user._id} style={styles.searchResultItem}>
                                            {user.pfp ? (
                                                <TouchableOpacity onLongPress={() => setFullScreenImage(user.pfp)}>
                                                    <Image source={{ uri: user.pfp }} style={styles.searchAvatar} />
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={styles.searchAvatarPlaceholder}>
                                                    <Text style={styles.searchAvatarText}>{(user.name || user.username)[0].toUpperCase()}</Text>
                                                </View>
                                            )}
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={styles.searchUsername}>@{user.username}</Text>
                                                <Text style={styles.searchUid}>UID: {user.shortId}</Text>
                                            </View>
                                            {user.relationship === 'friends' && (
                                                <View style={styles.badgeFriends}>
                                                    <Text style={styles.badgeFriendsText}>Friends ✓</Text>
                                                </View>
                                            )}
                                            {user.relationship === 'pending_sent' && (
                                                <View style={styles.badgePending}>
                                                    <Text style={styles.badgePendingText}>Sent</Text>
                                                </View>
                                            )}
                                            {user.relationship === 'pending_received' && (
                                                <TouchableOpacity
                                                    style={styles.btnAcceptMini}
                                                    onPress={() => handleRespondToRequest(user.requestId, 'accept')}
                                                    disabled={isSubmitting}
                                                >
                                                    <Text style={styles.btnAcceptMiniText}>Accept</Text>
                                                </TouchableOpacity>
                                            )}
                                            {user.relationship === 'none' && (
                                                <TouchableOpacity
                                                    style={styles.btnAddMini}
                                                    onPress={() => handleSendFriendRequest(user.shortId || user.username)}
                                                    disabled={isSubmitting}
                                                >
                                                    <Ionicons name="person-add" size={14} color="#fff" style={{ marginRight: 4 }} />
                                                    <Text style={styles.btnAddMiniText}>Add</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))
                                )}
                            </View>
                        )}
                    </View>

                    {/* Friends List */}
                    {userProfile?.friends && userProfile.friends.length > 0 && (
                        <View style={styles.friendsList}>
                            <Text style={styles.sectionTitle}>Your Friends ({userProfile.friends.length})</Text>
                            {userProfile.friends.map((f: any) => (
                                <View key={f._id} style={styles.friendItem}>
                                    {f.pfp ? (
                                        <TouchableOpacity onLongPress={() => setFullScreenImage(f.pfp)}>
                                            <Image source={{ uri: f.pfp }} style={styles.friendAvatar} />
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={styles.friendAvatarPlaceholder}>
                                            <Text style={styles.friendAvatarText}>{f.username[0].toUpperCase()}</Text>
                                        </View>
                                    )}
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.friendName}>{f.name || `@${f.username}`}</Text>
                                        <Text style={styles.friendSubtext}>@{f.username} • UID: {f.shortId}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.removeFriendBtn}
                                        onPress={() => handleRemoveFriend(f._id, f.username)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                    {userProfile?.isAdmin && (
                        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: Colors.accent, borderColor: Colors.accent, marginBottom: 12 }]} onPress={() => {
                            // Using expo-router to navigate to admin screen
                            // @ts-ignore
                            import('expo-router').then(r => r.router.push('/admin'));
                        }}>
                            <Text style={[styles.secondaryButtonText, { color: '#fff' }]}>Admin Dashboard</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.secondaryButton} onPress={logout}>
                        <Text style={styles.secondaryButtonText}>Log Out</Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Team Selection Modal */}
                <Modal visible={isTeamModalVisible} animationType="slide" transparent={true}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.sectionTitle}>Select Favorite Teams (Max 2)</Text>
                            <ScrollView style={{maxHeight: 400}}>
                                <View style={styles.teamsGrid}>
                                    {VCT_TEAMS.map(team => (
                                        <TouchableOpacity 
                                            key={team} 
                                            style={[styles.teamBtn, tempFavTeams.includes(team) && styles.teamBtnActive]}
                                            onPress={() => {
                                                if (tempFavTeams.includes(team)) {
                                                    setTempFavTeams(tempFavTeams.filter(t => t !== team));
                                                } else if (tempFavTeams.length < 2) {
                                                    setTempFavTeams([...tempFavTeams, team]);
                                                }
                                            }}
                                        >
                                            <Text style={[styles.teamBtnText, tempFavTeams.includes(team) && styles.teamBtnTextActive]}>{team}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.secondaryButton, { flex: 1, marginRight: 8, marginTop: 0 }]} onPress={() => setIsTeamModalVisible(false)}>
                                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.primaryButton, { flex: 1, marginLeft: 8 }]} onPress={handleUpdateFavTeams} disabled={isSubmitting}>
                                    {isSubmitting ? <ActivityIndicator color={Colors.textPrimary} /> : <Text style={styles.primaryButtonText}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Notifications Modal */}
                <Modal visible={isNotifModalVisible} animationType="slide" transparent={true}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 0 }]}>Notifications</Text>
                                <TouchableOpacity onPress={() => setIsNotifModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={Colors.textPrimary} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ maxHeight: 350 }}>
                                {notifications && notifications.length > 0 ? (
                                    notifications.map((n: any) => (
                                        <View key={n._id} style={[styles.notifItem, !n.read && styles.notifItemUnread]}>
                                            <Ionicons
                                                name={n.type === 'friend_request' ? 'person-add' : n.type === 'friend_accept' ? 'checkmark-circle' : 'notifications'}
                                                size={22}
                                                color={Colors.accent}
                                                style={{ marginRight: 12, marginTop: 2 }}
                                            />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.notifTitle}>{n.title}</Text>
                                                <Text style={styles.notifMessage}>{n.message}</Text>
                                                <Text style={styles.notifTime}>{new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginVertical: 20 }}>No notifications yet.</Text>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

            </SafeAreaView>

            {/* Web-only image crop modal */}
            {pendingCropUri && (
                <ImageCropModal
                    visible={cropModalVisible}
                    imageUri={pendingCropUri}
                    onCrop={async (base64Image) => {
                        setCropModalVisible(false);
                        setPendingCropUri(null);
                        await saveProfilePicture(base64Image);
                    }}
                    onCancel={() => {
                        setCropModalVisible(false);
                        setPendingCropUri(null);
                    }}
                />
            )}

            {/* Full Screen Image Modal */}
            <Modal visible={!!fullScreenImage} transparent={true} animationType="fade">
                <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }} 
                    activeOpacity={1} 
                    onPress={() => setFullScreenImage(null)}
                >
                    <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 }} onPress={() => setFullScreenImage(null)}>
                        <Ionicons name="close" size={32} color="#fff" />
                    </TouchableOpacity>
                    {fullScreenImage && (
                        <Image 
                            source={{ uri: fullScreenImage }} 
                            style={{ width: '90%', height: '80%', resizeMode: 'contain' }} 
                        />
                    )}
                </TouchableOpacity>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
    paddingBottom: 100, // Make sure all containers are visible
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : undefined,
    alignSelf: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 400 : undefined,
    alignSelf: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 16,
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  checklist: {
      marginTop: 8,
      padding: 8,
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: 8,
  },
  validationText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      marginTop: 4,
  },
  valid: {
      color: Colors.accent,
  },
  invalid: {
      color: Colors.textSecondary,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 400 : undefined,
    alignSelf: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  linkText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 70, 85, 0.2)', // Light danger color
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 400 : undefined,
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  secondaryButtonText: {
    color: Colors.danger,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : undefined,
    alignSelf: 'center',
    marginBottom: 24,
  },
  statBox: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '31%',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
      color: Colors.textPrimary,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 18,
      marginBottom: 12,
      alignSelf: 'flex-start',
      marginTop: 24,
  },
  genderRow: {
      flexDirection: 'row',
      marginTop: 16,
      justifyContent: 'space-between',
  },
  genderBtn: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.05)',
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      marginHorizontal: 4,
  },
  genderBtnActive: {
      backgroundColor: 'rgba(255, 70, 85, 0.2)',
      borderColor: Colors.accent,
  },
  genderText: {
      color: Colors.textSecondary,
      fontFamily: 'Inter_500Medium',
  },
  genderTextActive: {
      color: Colors.accent,
  },
  teamsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
  },
  teamBtn: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      margin: 4,
      width: '30%',
      alignItems: 'center',
  },
  teamBtnActive: {
      backgroundColor: 'rgba(255, 70, 85, 0.2)',
      borderColor: Colors.accent,
  },
  teamBtnText: {
      color: Colors.textSecondary,
      fontFamily: 'Inter_500Medium',
  },
  teamBtnTextActive: {
      color: Colors.accent,
  },
  addFriendSection: {
      width: '100%',
      maxWidth: Platform.OS === 'web' ? 600 : undefined,
      alignSelf: 'center',
      backgroundColor: Colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
  },
  friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
  },
  addButton: {
      backgroundColor: Colors.accent,
      width: 52,
      height: 52,
      borderRadius: 8,
      marginLeft: 8,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
  },
  friendsList: {
      width: '100%',
      maxWidth: Platform.OS === 'web' ? 600 : undefined,
      alignSelf: 'center',
  },
  friendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
  },
  friendAvatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
  },
  friendAvatarText: {
      color: Colors.textPrimary,
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
  },
  friendName: {
      color: Colors.textPrimary,
      fontFamily: 'Inter_500Medium',
      fontSize: 16,
  },
  uidContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
  },
  uidText: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: Colors.textSecondary,
      textAlign: 'center',
  },
  modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 20,
  },
  modalContent: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 20,
      width: '100%',
      maxWidth: Platform.OS === 'web' ? 500 : undefined,
      alignSelf: 'center',
  },
  modalButtons: {
      flexDirection: 'row',
      marginTop: 20,
  },
  editPfpBadgeLarge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      backgroundColor: Colors.accent,
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#000',
  },
  editPfpBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      backgroundColor: Colors.accent,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#000',
  },
  notifHeaderBtn: {
      position: 'absolute',
      top: 16,
      right: 20,
      zIndex: 10,
      padding: 6,
  },
  notifBadge: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: Colors.accent,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
  },
  notifBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
  },
  pendingRequestsSection: {
      width: '100%',
      maxWidth: Platform.OS === 'web' ? 600 : undefined,
      alignSelf: 'center',
      backgroundColor: 'rgba(255, 70, 85, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 70, 85, 0.3)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
  },
  pendingRequestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
  },
  friendAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
  },
  friendSubtext: {
      color: Colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
  },
  acceptButton: {
      backgroundColor: '#10B981',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      marginRight: 6,
  },
  acceptButtonText: {
      color: '#fff',
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
  },
  declineButton: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: 8,
      borderRadius: 8,
  },
  searchResultsContainer: {
      marginTop: 12,
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
  },
  searchLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
  },
  searchLoadingText: {
      color: Colors.textSecondary,
      marginLeft: 8,
      fontSize: 13,
  },
  noResultsText: {
      color: Colors.textSecondary,
      textAlign: 'center',
      padding: 12,
      fontSize: 13,
  },
  searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
  },
  searchAvatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
  },
  searchAvatarText: {
      color: '#fff',
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
  },
  searchUsername: {
      color: Colors.textPrimary,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
  },
  searchUid: {
      color: Colors.textSecondary,
      fontSize: 12,
  },
  badgeFriends: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#10B981',
  },
  badgeFriendsText: {
      color: '#10B981',
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
  },
  badgePending: {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#F59E0B',
  },
  badgePendingText: {
      color: '#F59E0B',
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
  },
  btnAcceptMini: {
      backgroundColor: '#10B981',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
  },
  btnAcceptMiniText: {
      color: '#fff',
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
  },
  btnAddMini: {
      backgroundColor: Colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
  },
  btnAddMiniText: {
      color: '#fff',
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
  },
  removeFriendBtn: {
      padding: 8,
  },
  notifItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.03)',
      marginBottom: 8,
  },
  notifItemUnread: {
      backgroundColor: 'rgba(255, 70, 85, 0.12)',
      borderLeftWidth: 3,
      borderLeftColor: Colors.accent,
  },
  notifTitle: {
      color: Colors.textPrimary,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
  },
  notifMessage: {
      color: Colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
  },
  notifTime: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 11,
      marginTop: 4,
  },
});
