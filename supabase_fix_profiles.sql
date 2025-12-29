-- 1. Ensure the profiles table exists (from schema.sql)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Backfill existing users from auth.users into public.profiles
INSERT INTO public.profiles (id, name, email, country, is_admin)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'name', 'User'), 
    email, 
    COALESCE(raw_user_meta_data->>'country', 'Unknown'), 
    FALSE
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. Re-apply the trigger (from trigger.sql) to ensure future signups work
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, country, is_admin)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'country', 'Unknown'),
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
