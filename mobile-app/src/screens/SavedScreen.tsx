import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSaved } from '../contexts/SavedContext';
import { SavedRestaurant } from '../services/supabase';
import { calculateSafetyScore, getScoreColor } from '../utils/scoring';

export default function SavedScreen() {
  const navigation = useNavigation<any>();
  const { savedRestaurants, loading, refreshSaved, toggleSave } = useSaved();
  const [refreshing, setRefreshing] = React.useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshSaved();
    setRefreshing(false);
  }

  async function handleUnsave(restaurant: SavedRestaurant) {
    await toggleSave({
      establishment_id: restaurant.establishment_id,
      establishment_name: restaurant.establishment_name,
      establishment_address: restaurant.establishment_address || undefined,
    });
  }

  function renderItem({ item }: { item: SavedRestaurant }) {
    const score = item.last_score ?? 100;
    const scoreColor = getScoreColor(score);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate('RestaurantDetail', {
            establishmentId: parseInt(item.establishment_id, 10),
            establishmentName: item.establishment_name,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardMain}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.establishment_name}
            </Text>
            {item.establishment_address && (
              <Text style={styles.cardAddress} numberOfLines={1}>
                {item.establishment_address}
              </Text>
            )}
            {item.last_inspection_date && (
              <Text style={styles.cardDate}>
                Last inspected: {new Date(item.last_inspection_date).toLocaleDateString()}
              </Text>
            )}
          </View>

          <View style={styles.cardRight}>
            <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
              <Text style={[styles.scoreText, { color: scoreColor }]}>{score}</Text>
            </View>
            <TouchableOpacity
              style={styles.heartButton}
              onPress={() => handleUnsave(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="heart" size={24} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading && savedRestaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D5A3D" />
        </View>
      </SafeAreaView>
    );
  }

  if (savedRestaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color="#A09A8F" />
          <Text style={styles.emptyTitle}>No saved restaurants</Text>
          <Text style={styles.emptyText}>
            Save your favorite restaurants to get alerts when they're inspected
          </Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Ionicons name="search" size={20} color="#FFFFFF" />
            <Text style={styles.searchButtonText}>Find Restaurants</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={savedRestaurants}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2D5A3D"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Saved Restaurants</Text>
            <Text style={styles.headerSubtitle}>
              {savedRestaurants.length} restaurant{savedRestaurants.length !== 1 ? 's' : ''}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D5A3D',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B665C',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardMain: {
    flex: 1,
    marginRight: 12,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cardAddress: {
    fontSize: 13,
    color: '#6B665C',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#A09A8F',
  },
  cardRight: {
    alignItems: 'center',
    gap: 8,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
  },
  heartButton: {
    padding: 4,
  },
});
