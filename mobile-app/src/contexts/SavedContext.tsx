import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SavedRestaurant,
  getSavedRestaurants,
  saveRestaurant,
  unsaveRestaurant,
} from '../services/supabase';
import { useAuth } from './AuthContext';

interface SavedContextType {
  savedRestaurants: SavedRestaurant[];
  savedIds: Set<string>;
  loading: boolean;
  refreshSaved: () => Promise<void>;
  toggleSave: (restaurant: {
    establishment_id: string | number;
    establishment_name: string;
    establishment_address?: string;
    last_inspection_date?: string;
    last_score?: number;
  }) => Promise<boolean>;
  isSaved: (establishmentId: string | number) => boolean;
}

const SavedContext = createContext<SavedContextType | undefined>(undefined);

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [savedRestaurants, setSavedRestaurants] = useState<SavedRestaurant[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refreshSaved = useCallback(async () => {
    if (!user) {
      setSavedRestaurants([]);
      setSavedIds(new Set());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const restaurants = await getSavedRestaurants();
      setSavedRestaurants(restaurants);
      setSavedIds(new Set(restaurants.map(r => r.establishment_id)));
    } catch (error) {
      console.error('Error fetching saved restaurants:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  const isSaved = useCallback((establishmentId: string | number): boolean => {
    return savedIds.has(String(establishmentId));
  }, [savedIds]);

  const toggleSave = useCallback(async (restaurant: {
    establishment_id: string | number;
    establishment_name: string;
    establishment_address?: string;
    last_inspection_date?: string;
    last_score?: number;
  }): Promise<boolean> => {
    const id = String(restaurant.establishment_id);
    const currentlySaved = savedIds.has(id);

    try {
      if (currentlySaved) {
        // Optimistic update
        setSavedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setSavedRestaurants(prev => prev.filter(r => r.establishment_id !== id));

        await unsaveRestaurant(id);
        return false;
      } else {
        // Optimistic update
        setSavedIds(prev => new Set(prev).add(id));

        const saved = await saveRestaurant(restaurant);
        setSavedRestaurants(prev => [saved, ...prev]);
        return true;
      }
    } catch (error) {
      // Revert on error
      await refreshSaved();
      throw error;
    }
  }, [savedIds, refreshSaved]);

  return (
    <SavedContext.Provider
      value={{
        savedRestaurants,
        savedIds,
        loading,
        refreshSaved,
        toggleSave,
        isSaved,
      }}
    >
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const context = useContext(SavedContext);
  if (context === undefined) {
    throw new Error('useSaved must be used within a SavedProvider');
  }
  return context;
}
