import { supabase } from "@/lib/supabase";
import { RadioStation } from "./radioBrowserApi";

export const getApprovedLocalStations = async (genres: string[]): Promise<RadioStation[]> => {
    try {
        if (!genres || genres.length === 0) return [];

        // Build OR query for genres
        // We look for any station where the genre column contains one of the requested genres
        const genreFilters = genres.map(g => `genre.ilike.%${g}%`).join(',');

        const { data, error } = await supabase
            .from('station_requests')
            .select('*')
            .eq('status', 'approved')
            .or(genreFilters);

        if (error) throw error;

        return (data || []).map(item => ({
            stationuuid: item.stationuuid || `local-${item.id}`,
            name: item.name,
            url_resolved: item.url,
            country: item.country || 'Unknown',
            countrycode: '', // We don't necessarily have this for local manual entries
            tags: item.genre || '',
            favicon: '',
            votes: 1000, // Prioritize local stations in sorting
            clickcount: 0
        }));
    } catch (err) {
        console.error("Error fetching local approved stations:", err);
        return [];
    }
};
