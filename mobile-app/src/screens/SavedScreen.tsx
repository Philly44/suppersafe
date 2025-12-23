import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function SavedScreen() {
  // TODO: Implement saved restaurants with AsyncStorage or Supabase

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={64} color="#A09A8F" />
        <Text style={styles.emptyTitle}>No saved restaurants</Text>
        <Text style={styles.emptyText}>
          Save your favorite restaurants to get alerts when they're inspected
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B665C',
    textAlign: 'center',
    lineHeight: 22,
  },
});
