import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../providers/AuthProvider';
import { Platform } from 'react-native';

export default function TabLayout() {
  const { userId } = useAuth();
  const accountTabTitle = userId ? 'Profile' : 'Account';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(30, 30, 30, 0.85)', // Semi-transparent for blur effect
          borderTopWidth: 0,
          elevation: 5,
          position: 'absolute', // Ensures it floats over the background image
          bottom: 24,
          left: Platform.OS === 'web' ? undefined : 40,
          right: Platform.OS === 'web' ? undefined : 40,
          alignSelf: 'center',
          width: Platform.OS === 'web' ? '100%' : undefined,
          maxWidth: Platform.OS === 'web' ? 720 : undefined,
          borderRadius: 24,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: accountTabTitle,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
