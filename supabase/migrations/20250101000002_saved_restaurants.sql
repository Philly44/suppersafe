-- Create saved_restaurants table for users to save their favorite restaurants
CREATE TABLE IF NOT EXISTS saved_restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_id TEXT NOT NULL,
  establishment_name TEXT NOT NULL,
  establishment_address TEXT,
  last_inspection_date DATE,
  last_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, establishment_id)
);

-- Enable RLS
ALTER TABLE saved_restaurants ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved restaurants
CREATE POLICY "Users can view own saved restaurants"
  ON saved_restaurants FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own saved restaurants
CREATE POLICY "Users can save restaurants"
  ON saved_restaurants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved restaurants
CREATE POLICY "Users can unsave restaurants"
  ON saved_restaurants FOR DELETE
  USING (auth.uid() = user_id);

-- Users can update their own saved restaurants
CREATE POLICY "Users can update saved restaurants"
  ON saved_restaurants FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_saved_restaurants_user_id ON saved_restaurants(user_id);
CREATE INDEX idx_saved_restaurants_establishment_id ON saved_restaurants(establishment_id);
