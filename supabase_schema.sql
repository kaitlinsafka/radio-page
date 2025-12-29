-- 1. Profiles Table (Extended User Data)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Preferences (Genres)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  genres JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Saved Stations (Global & Local)
CREATE TABLE IF NOT EXISTS public.saved_stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  station_uuid TEXT NOT NULL,
  station_data JSONB NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  shared_from_user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Station Requests (Moderation Queue)
CREATE TABLE IF NOT EXISTS public.station_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  genre TEXT,
  city TEXT,
  country TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Shared Playlists
CREATE TABLE IF NOT EXISTS public.shared_playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  stations JSONB NOT NULL, -- Array of station data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_playlists ENABLE ROW LEVEL SECURITY;

-- Governance Policies (Idempotent)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own saved stations" ON public.saved_stations;
CREATE POLICY "Users can view own saved stations" ON public.saved_stations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own saved stations" ON public.saved_stations;
CREATE POLICY "Users can manage own saved stations" ON public.saved_stations FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own requests" ON public.station_requests;
CREATE POLICY "Users can view own requests" ON public.station_requests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create requests" ON public.station_requests;
CREATE POLICY "Users can create requests" ON public.station_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all requests" ON public.station_requests;
CREATE POLICY "Admins can view all requests" ON public.station_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

DROP POLICY IF EXISTS "Anyone can view shared playlists" ON public.shared_playlists;
CREATE POLICY "Anyone can view shared playlists" ON public.shared_playlists FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create shared playlists" ON public.shared_playlists;
CREATE POLICY "Anyone can create shared playlists" ON public.shared_playlists FOR INSERT WITH CHECK (
  auth.uid() = user_id OR user_id IS NULL
);

DROP POLICY IF EXISTS "Users can manage own shared playlists" ON public.shared_playlists;
CREATE POLICY "Users can manage own shared playlists" ON public.shared_playlists FOR ALL USING (auth.uid() = user_id);
