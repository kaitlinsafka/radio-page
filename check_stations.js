import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("Checking station_requests table...");
    const { data, error, count } = await supabase
        .from('station_requests')
        .select('*', { count: 'exact' });

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Total rows: ${count}`);
        console.log("Sample rows (pending):", data.filter(r => r.status === 'pending'));
    }
}

check();
