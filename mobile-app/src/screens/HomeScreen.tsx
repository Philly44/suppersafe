import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getViolationCount, searchRestaurants, Restaurant } from '../services/supabase';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [violationCount, setViolationCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadViolationCount();
  }, []);

  async function loadViolationCount() {
    try {
      const count = await getViolationCount();
      setViolationCount(count);
    } catch (error) {
      console.error('Error loading violation count:', error);
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchRestaurants(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }

  function handleRestaurantSelect(restaurant: Restaurant) {
    setSearchQuery('');
    setSearchResults([]);
    navigation.navigate('RestaurantDetail', {
      establishmentId: restaurant.establishment_id,
      name: restaurant.establishment_name,
      address: restaurant.establishment_address,
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
      >
        {/* Founding Member Banner */}
        <View style={styles.foundingBanner}>
          <Text style={styles.foundingLabel}>FOUNDING MEMBER</Text>
          <Text style={styles.foundingTitle}>Lifetime Free Access</Text>
          <Text style={styles.foundingDesc}>First 100 signups get alerts forever</Text>
        </View>

        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            Know before you eat.
          </Text>
          <View style={styles.statBadge}>
            <Text style={styles.statNumber}>
              {violationCount !== null ? violationCount.toLocaleString() : '...'}
            </Text>
            <Text style={styles.statText}>
              Toronto restaurants failed inspection in the last 30 days
            </Text>
          </View>
        </View>

        {/* Search Section */}
        <View style={styles.searchSection}>
          <Text style={styles.searchLabel}>Is your regular spot clean?</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#A09A8F" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Restaurant name..."
              placeholderTextColor="#A09A8F"
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isSearching && (
              <ActivityIndicator size="small" color="#2D5A3D" />
            )}
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              {searchResults.map((restaurant) => (
                <TouchableOpacity
                  key={restaurant.establishment_id}
                  style={styles.resultItem}
                  onPress={() => handleRestaurantSelect(restaurant)}
                >
                  <Text style={styles.resultName}>{restaurant.establishment_name}</Text>
                  <Text style={styles.resultAddress}>{restaurant.establishment_address}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.dataSource}>
            Data from Toronto Public Health DineSafe
          </Text>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>What you get</Text>

          <View style={styles.featureCard}>
            <Ionicons name="notifications" size={24} color="#2D5A3D" />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Instant alerts</Text>
              <Text style={styles.featureDesc}>Get notified when your saved restaurants get inspected</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Ionicons name="document-text" size={24} color="#2D5A3D" />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Plain English</Text>
              <Text style={styles.featureDesc}>No jargon. Just what actually happened.</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Ionicons name="star" size={24} color="#2D5A3D" />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Your restaurants only</Text>
              <Text style={styles.featureDesc}>Only alerts for places you actually eat.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  scrollView: {
    flex: 1,
  },
  foundingBanner: {
    backgroundColor: '#2D5A3D',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  foundingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  foundingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  foundingDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  statBadge: {
    backgroundColor: 'rgba(180, 90, 60, 0.12)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#B45A3C',
  },
  statText: {
    flex: 1,
    fontSize: 14,
    color: '#6B665C',
    lineHeight: 20,
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F7',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E4DD',
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  resultsContainer: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E4DD',
    overflow: 'hidden',
  },
  resultItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DD',
  },
  resultName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  resultAddress: {
    fontSize: 13,
    color: '#6B665C',
  },
  dataSource: {
    marginTop: 12,
    fontSize: 12,
    color: '#A09A8F',
    textAlign: 'center',
  },
  featuresSection: {
    padding: 20,
    marginTop: 8,
  },
  featuresTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B665C',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: '#6B665C',
    lineHeight: 20,
  },
});
