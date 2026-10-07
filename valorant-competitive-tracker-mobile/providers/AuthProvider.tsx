import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

interface AuthContextType {
    userId: string | null;
    login: (id: string) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    userProfile: any | null; // Typed loosely for now, you can create a strict type
}

const AuthContext = createContext<AuthContextType>({
    userId: null,
    login: async () => {},
    logout: async () => {},
    isLoading: true,
    userProfile: null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const userProfile = useQuery(api.users.getUserProfile, userId ? { userId: userId as Id<"users"> } : "skip");

    useEffect(() => {
        const loadStoredUser = async () => {
            try {
                const storedId = await AsyncStorage.getItem('userId');
                if (storedId) {
                    setUserId(storedId);
                }
            } catch (e) {
                console.error("Failed to load user ID from storage", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadStoredUser();
    }, []);

    const login = async (id: string) => {
        setUserId(id);
        await AsyncStorage.setItem('userId', id);
    };

    const logout = async () => {
        setUserId(null);
        await AsyncStorage.removeItem('userId');
    };

    return (
        <AuthContext.Provider value={{ userId, login, logout, isLoading, userProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
