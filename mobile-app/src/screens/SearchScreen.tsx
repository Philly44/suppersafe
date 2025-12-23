import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { searchRestaurants, Restaurant } from '../services/supabase';

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debounce = useCallback((func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const data = await searchRestaurants(query);
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback(
    debounce((query: string) => performSearch(query), 300),
    [performSearch]
  );

  function handleSearch(text: string) {
    setSearchQuery(text);
    debouncedSearch(text);
  }

  function handleRestaurantPress(restaurant: Restaurant) {
    navigation.navigate('RestaurantDetail', {
      establishmentId: restaurant.establishment_id,
      name: restaurant.establishment_name,
      address: restaurant.establishment_address,
    });
  }

  function renderRestaurant({ item }: { item: Restaurant }) {
    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleRestaurantPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.resultInfo}>
          <Text style={styles.resultName}>{item.establishment_name}</Text>
          <Text style={styles.resultAddress}>{item.establishment_address}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#A09A8F" />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#A09A8F" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Toronto restaurants..."
            placeholderTextColor="#A09A8F"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#A09A8F" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D5A3D" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderRestaurant}
          keyExtractor={(item) => item.establishment_id.toString()}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : hasSearched ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color="#A09A8F" />
          <Text style={styles.emptyTitle}>No restaurants found</Text>
          <Text style={styles.emptyText}>Try a different search term</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={48} color="#A09A8F" />
          <Text style={styles.emptyTitle}>Search restaurants</Text>
          <Text style={styles.emptyText}>
            Enter at least 2 characters to search Toronto restaurants
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  searchHeader: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DD',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B665C',
  },
  listContent: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  resultAddress: {
    fontSize: 14,
    color: '#6B665C',
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B665C',
    textAlign: 'center',
    lineHeight: 20,
  },
});
