import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export function ScreenWrapper({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Image 
          source={require('../BG.jpg')} 
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} 
          blurRadius={20} 
          resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.65)' }]} />
      {children}
    </View>
  );
}
