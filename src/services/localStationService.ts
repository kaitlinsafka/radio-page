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

        return (data || []).map(mapToRadioStation);
    } catch (err) {
        console.error("Error fetching local approved stations:", err);
        return [];
    }
};

export const searchLocalApprovedStations = async (query: string): Promise<RadioStation[]> => {
    try {
        const { data, error } = await supabase
            .from('station_requests')
            .select('*')
            .eq('status', 'approved')
            .or(`name.ilike.%${query}%,genre.ilike.%${query}%,city.ilike.%${query}%,country.ilike.%${query}%`);

        if (error) throw error;
        return (data || []).map(mapToRadioStation);
    } catch (err) {
        console.error("Error searching local approved stations:", err);
        return [];
    }
};

export const getLocalApprovedStationsByCountry = async (countryCode: string): Promise<RadioStation[]> => {
    try {
        const { data, error } = await supabase
            .from('station_requests')
            .select('*')
            .eq('status', 'approved')
            .ilike('country', `%${countryCode}%`); // We might need a better mapping if country names are used instead of codes

        if (error) throw error;
        return (data || []).map(mapToRadioStation);
    } catch (err) {
        console.error("Error fetching local stations by country:", err);
        return [];
    }
};

const mapToRadioStation = (item: any): RadioStation => ({
    stationuuid: item.stationuuid || `local-${item.id}`,
    name: item.name,
    url_resolved: item.url,
    country: item.country || 'Unknown',
    countrycode: '', // We don't necessarily have this for local manual entries
    tags: item.genre || '',
    favicon: item.favicon || '',
    votes: 0,
    clickcount: 0,
    isManual: true
});
