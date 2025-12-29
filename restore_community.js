import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function restore() {
    console.log("Restoring community status for stations with requesters...");
    const { data, error } = await supabase
        .from('station_requests')
        .update({ is_user_submission: true })
        .not('user_id', 'is', null)
        .eq('is_user_submission', false);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Restored successfully.");
    }
}

restore();
