import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('--- Supabase Init Check ---');
console.log('URL found:', !!supabaseUrl);
console.log('Key found:', !!supabaseAnonKey);
if (supabaseUrl) console.log('URL starts with:', supabaseUrl.substring(0, 10) + '...');
console.log('---------------------------');

const isPlaceholder = !supabaseUrl || supabaseUrl.includes('REPLACE_WITH_YOUR_URL');

if (isPlaceholder) {
    console.warn('⚠️ Supabase URL is missing or set to a placeholder. App features will be limited.');
}

// Ensure URL is valid and key is present to prevent crash
const finalUrl = (supabaseUrl && supabaseUrl.startsWith('http'))
    ? supabaseUrl
    : 'https://placeholder.supabase.co';

const finalKey = supabaseAnonKey || 'placeholder-key';

let supabaseInstance;
try {
    supabaseInstance = createClient(finalUrl, finalKey);
    console.log('Supabase client created successfully');
} catch (e) {
    console.error('CRITICAL: Failed to initialize Supabase client:', e);
    // Fallback to a dumb object to prevent total app crash
    supabaseInstance = {
        auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }) },
        from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) })
    } as any;
}

export const supabase = supabaseInstance;
