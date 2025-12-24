import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://txxkimndpqprbqhlknrk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGtpbW5kcHFwcmJxaGxrbnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxOTE1ODgsImV4cCI6MjA3OTc2NzU4OH0.4Zm1ShwG-_kc_E0tkltEBnNzfWdVeb7gRDh6b3-pCb8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface Restaurant {
  establishment_id: number;
  establishment_name: string;
  establishment_address: string;
  establishment_status?: string;
  inspection_date?: string;
}

export interface Inspection {
  id: number;
  inspection_id: number;
  establishment_id: number;
  establishment_name: string;
  establishment_address: string;
  establishment_status: string;
  inspection_date: string;
  severity: string;
  infraction_details: string;
}

// Search restaurants by name
export async function searchRestaurants(query: string): Promise<Restaurant[]> {
  if (query.length < 2) return [];

  const { data, error } = await supabase
    .from('dinesafe')
    .select('establishment_id, establishment_name, establishment_address')
    .ilike('establishment_name', `%${query}%`)
    .order('establishment_name')
    .limit(50);

  if (error) throw error;

  // Deduplicate by establishment_id
  const unique: Restaurant[] = [];
  const seen = new Set<number>();

  for (const item of data || []) {
    if (!seen.has(item.establishment_id)) {
      seen.add(item.establishment_id);
      unique.push(item);
    }
  }

  return unique.slice(0, 10);
}

// Get restaurant inspection details
export async function getRestaurantInspections(establishmentId: number): Promise<Inspection[]> {
  const { data, error } = await supabase
    .from('dinesafe')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('inspection_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get violation count for last 30 days
export async function getViolationCount(): Promise<number> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('dinesafe')
    .select('establishment_id')
    .gte('inspection_date', thirtyDaysAgo)
    .or('severity.ilike.C%,severity.ilike.S%');

  if (error) throw error;

  const uniqueEstablishments = new Set((data || []).map(d => d.establishment_id));
  return uniqueEstablishments.size;
}

// Get recent inspections for ticker/feed
export async function getRecentInspections(): Promise<Inspection[]> {
  const { data, error } = await supabase
    .from('dinesafe')
    .select('*')
    .order('inspection_date', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

// Saved restaurants types and functions
export interface SavedRestaurant {
  id: string;
  user_id: string;
  establishment_id: string;
  establishment_name: string;
  establishment_address: string | null;
  last_inspection_date: string | null;
  last_score: number | null;
  created_at: string;
}

// Get all saved restaurants for current user
export async function getSavedRestaurants(): Promise<SavedRestaurant[]> {
  const { data, error } = await supabase
    .from('saved_restaurants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Check if a restaurant is saved
export async function isRestaurantSaved(establishmentId: string | number): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_restaurants')
    .select('id')
    .eq('establishment_id', String(establishmentId))
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// Save a restaurant
export async function saveRestaurant(restaurant: {
  establishment_id: string | number;
  establishment_name: string;
  establishment_address?: string;
  last_inspection_date?: string;
  last_score?: number;
}): Promise<SavedRestaurant> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to save restaurants');

  const { data, error } = await supabase
    .from('saved_restaurants')
    .insert({
      user_id: user.id,
      establishment_id: String(restaurant.establishment_id),
      establishment_name: restaurant.establishment_name,
      establishment_address: restaurant.establishment_address || null,
      last_inspection_date: restaurant.last_inspection_date || null,
      last_score: restaurant.last_score || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Unsave a restaurant
export async function unsaveRestaurant(establishmentId: string | number): Promise<void> {
  const { error } = await supabase
    .from('saved_restaurants')
    .delete()
    .eq('establishment_id', String(establishmentId));

  if (error) throw error;
}

// Toggle save status
export async function toggleSaveRestaurant(restaurant: {
  establishment_id: string | number;
  establishment_name: string;
  establishment_address?: string;
  last_inspection_date?: string;
  last_score?: number;
}): Promise<boolean> {
  const isSaved = await isRestaurantSaved(restaurant.establishment_id);

  if (isSaved) {
    await unsaveRestaurant(restaurant.establishment_id);
    return false;
  } else {
    await saveRestaurant(restaurant);
    return true;
  }
}
