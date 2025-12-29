export interface Coordinates {
    lat: number;
    lng: number;
}

// Minimal country-to-coordinate map for geocoding fallback
// Data for major countries to ensure most stations find a home on the map
export const countryCoordinates: Record<string, Coordinates> = {
    'US': { lat: 37.0902, lng: -95.7129 },
    'GB': { lat: 55.3781, lng: -3.4360 },
    'CA': { lat: 56.1304, lng: -106.3468 },
    'AU': { lat: -25.2744, lng: 133.7751 },
    'DE': { lat: 51.1657, lng: 10.4515 },
    'FR': { lat: 46.2276, lng: 2.2137 },
    'IT': { lat: 41.8719, lng: 12.5674 },
    'ES': { lat: 40.4637, lng: -3.7492 },
    'BR': { lat: -14.2350, lng: -51.9253 },
    'JP': { lat: 36.2048, lng: 138.2529 },
    'IN': { lat: 20.5937, lng: 78.9629 },
    'EE': { lat: 58.5953, lng: 25.0136 }, // Estonia (Tallinn fallback)
    'NL': { lat: 52.1326, lng: 5.2913 },
    'BE': { lat: 50.5039, lng: 4.4699 },
    'SE': { lat: 60.1282, lng: 18.6435 },
    'NO': { lat: 60.4720, lng: 8.4689 },
    'DK': { lat: 56.2639, lng: 9.5018 },
    'FI': { lat: 61.9241, lng: 25.7482 },
    'PT': { lat: 39.3999, lng: -8.2245 },
    'IE': { lat: 53.4129, lng: -8.2439 },
    'CH': { lat: 46.8182, lng: 8.2275 },
    'AT': { lat: 47.5162, lng: 14.5501 },
    'GR': { lat: 39.0742, lng: 21.8243 },
    'TR': { lat: 38.9637, lng: 35.2433 },
    'RU': { lat: 61.5240, lng: 105.3188 },
    'CN': { lat: 35.8617, lng: 104.1954 },
    'MX': { lat: 23.6345, lng: -102.5528 },
    'AR': { lat: -38.4161, lng: -63.6167 },
    'CL': { lat: -35.6751, lng: -71.5430 },
    'ZA': { lat: -30.5595, lng: 22.9375 },
};

// US State Centers for fallback
export const stateCoordinates: Record<string, Coordinates> = {
    'Alabama': { lat: 32.3182, lng: -86.9023 },
    'Alaska': { lat: 63.5888, lng: -154.4931 },
    'Arizona': { lat: 34.0489, lng: -111.0937 },
    'Arkansas': { lat: 35.2010, lng: -91.8318 },
    'California': { lat: 36.7783, lng: -119.4179 },
    'Colorado': { lat: 39.5501, lng: -105.7821 },
    'Connecticut': { lat: 41.6032, lng: -73.0877 },
    'Delaware': { lat: 38.9108, lng: -75.5277 },
    'Florida': { lat: 27.6648, lng: -81.5158 },
    'Georgia': { lat: 32.1656, lng: -82.9001 },
    'Hawaii': { lat: 19.8968, lng: -155.5828 },
    'Idaho': { lat: 44.0682, lng: -114.7420 },
    'Illinois': { lat: 40.6331, lng: -89.3985 },
    'Indiana': { lat: 40.2672, lng: -86.1349 },
    'Iowa': { lat: 41.8780, lng: -93.0977 },
    'Kansas': { lat: 39.0119, lng: -98.4842 },
    'Kentucky': { lat: 37.8393, lng: -84.2700 },
    'Louisiana': { lat: 30.9843, lng: -91.9623 },
    'Maine': { lat: 45.2538, lng: -69.4455 },
    'Maryland': { lat: 39.0458, lng: -76.6413 },
    'Massachusetts': { lat: 42.4072, lng: -71.3824 },
    'Michigan': { lat: 44.3148, lng: -85.6024 },
    'Minnesota': { lat: 46.7296, lng: -94.6859 },
    'Mississippi': { lat: 32.3547, lng: -89.3985 },
    'Missouri': { lat: 37.9643, lng: -91.8318 },
    'Montana': { lat: 46.8797, lng: -110.3626 },
    'Nebraska': { lat: 41.4925, lng: -99.9018 },
    'Nevada': { lat: 38.8026, lng: -116.4194 },
    'New Hampshire': { lat: 43.1939, lng: -71.5724 },
    'New Jersey': { lat: 40.0583, lng: -74.4057 },
    'New Mexico': { lat: 34.5199, lng: -105.8701 },
    'New York': { lat: 40.7128, lng: -74.0060 },
    'North Carolina': { lat: 35.7596, lng: -79.0193 },
    'North Dakota': { lat: 47.5506, lng: -101.0020 },
    'Ohio': { lat: 40.4173, lng: -82.9071 },
    'Oklahoma': { lat: 35.0078, lng: -97.0929 },
    'Oregon': { lat: 43.8041, lng: -120.5542 },
    'Pennsylvania': { lat: 41.2033, lng: -77.1945 },
    'Rhode Island': { lat: 41.5801, lng: -71.4774 },
    'South Carolina': { lat: 33.8361, lng: -81.1637 },
    'South Dakota': { lat: 44.3683, lng: -100.3510 },
    'Tennessee': { lat: 35.5175, lng: -86.5804 },
    'Texas': { lat: 31.9686, lng: -99.9018 },
    'Utah': { lat: 39.3210, lng: -111.0937 },
    'Vermont': { lat: 44.5588, lng: -72.5778 },
    'Virginia': { lat: 37.4316, lng: -78.6569 },
    'Washington': { lat: 47.7511, lng: -120.7401 },
    'West Virginia': { lat: 38.5976, lng: -80.4549 },
    'Wisconsin': { lat: 43.7844, lng: -88.7879 },
    'Wyoming': { lat: 43.0760, lng: -107.2903 },
};

/**
 * Tries to estimate coordinates for a station based on its city, state or country.
 * In a real app, this might call a geocoding API like Nominatim or Mapbox.
 * For this demo, we use a curated fallback map.
 */
export const geocodeStation = (station: { city?: string; state?: string; countrycode?: string; country?: string }): Coordinates | null => {
    // 1. Try state fallback (for US/large countries)
    if (station.state && stateCoordinates[station.state]) {
        const base = stateCoordinates[station.state];
        return {
            lat: base.lat + (Math.random() - 0.5) * 1, // +/- 0.5 degree
            lng: base.lng + (Math.random() - 0.5) * 1
        };
    }

    // 2. Try country code fallback
    if (station.countrycode && countryCoordinates[station.countrycode]) {
        // Add small randomization to prevent multiple stations from stacking exactly on top of each other
        const base = countryCoordinates[station.countrycode];
        return {
            lat: base.lat + (Math.random() - 0.5) * 2, // +/- 1 degree
            lng: base.lng + (Math.random() - 0.5) * 2
        };
    }

    // 2. Default to world center if nothing else
    return null;
};
