
export interface RadioStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  country: string;
  countrycode: string;
  tags: string;
  favicon: string;
  geo_lat?: number;
  geo_long?: number;
  votes?: number;
  clickcount?: number;
  isOffline?: boolean;
}

// Hardcoded fallbacks in case discovery fails
const FALLBACK_MIRRORS = [
  'https://at1.api.radio-browser.info/json',
  'https://de1.api.radio-browser.info/json',
  'https://nl1.api.radio-browser.info/json'
];

let cachedMirrors: string[] | null = null;

// Dynamic Server Discovery
async function getApiMirrors(): Promise<string[]> {
  if (cachedMirrors && cachedMirrors.length > 0) return cachedMirrors;

  try {
    // Attempt to discover active servers
    const response = await fetch('https://all.api.radio-browser.info/json/servers');
    if (response.ok) {
      const data = await response.json();
      // data is [{ name: "at1...", ip: "..." }, ...]
      const discovered = data.map((server: any) => `https://${server.name}/json`);
      // Shuffle them to distribute load
      cachedMirrors = [...discovered.sort(() => Math.random() - 0.5), ...FALLBACK_MIRRORS];
      console.log('[Radio API] Discovered servers:', cachedMirrors);
      return cachedMirrors;
    }
  } catch (error) {
    console.warn('[Radio API] Server discovery failed, using fallbacks:', error);
  }

  cachedMirrors = FALLBACK_MIRRORS;
  return cachedMirrors;
}

async function fetchWithFailover(endpoint: string): Promise<any> {
  const mirrors = await getApiMirrors();

  for (const mirror of mirrors) {
    try {
      const url = `${mirror}${endpoint}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      // console.warn(`Failed to fetch from ${mirror}:`, error);
      // Continue to next mirror
    }
  }
  console.error('All API mirrors failed. Check your network connection or DNS.');
  throw new Error('All API mirrors failed');
}

// Countries to exclude
const EXCLUDED_COUNTRIES = ['RU', 'IL'];

// Tags that indicate community/indie/niche stations (Prioritized)
const PREFERRED_TAGS = [
  'community', 'indie', 'college', 'university', 'student',
  'local', 'independent', 'underground', 'alternative',
  'public radio', 'non-commercial', 'diy', 'avant-garde',
  'experimental', 'eclectic'
];

// Tags to deprioritize (Mainstream/Commercial)
const DEPRIORITIZED_TAGS = [
  'top 40', 'hits', 'mainstream', 'pop hits', 'chart',
  'billboard', 'commercial', 'best of', '100'
];

// Tags to EXCLUDE completely
const EXCLUDED_TAGS = ['metal', 'heavy metal', 'death metal', 'black metal', 'thrash', 'hardcore', 'grindcore', 'power metal', 'news', 'talk', 'sports', 'religious'];

// Hardcoded stream URL overrides for known broken stations
const STREAM_URL_OVERRIDES: Record<string, string> = {
  'somafm-indiepop': 'https://ice2.somafm.com/indiepop-256-mp3',
};

// Expanded genre tag map with multiple variations for better matching
export const genreTagMap: Record<string, string[]> = {
  rock: ['rock', 'classic rock', 'rock and roll'],
  jazz: ['jazz', 'smooth jazz', 'bebop', 'swing'],
  electronic: ['electronic', 'techno', 'house', 'edm', 'dance', 'trance', 'ambient'],
  'hip-hop': ['hip hop', 'hip-hop', 'rap', 'hiphop'],
  folk: ['folk', 'americana', 'acoustic', 'singer-songwriter', 'singer songwriter'],
  punk: ['punk', 'post-punk', 'alternative rock', 'screamo', 'math rock', 'midwest emo', 'emo', 'hardcore', 'shoegaze', 'noise rock', 'no wave', 'riot grrrl', 'garage rock', 'post-hardcore', 'grunge', 'anarcho-punk'],
  classical: ['classical', 'orchestra', 'symphony', 'baroque', 'opera'],
  blues: ['blues', 'delta blues', 'chicago blues', 'rhythm and blues'],
  indie: ['indie', 'indie rock', 'indie pop', 'alternative', 'alt rock'],
  soul: ['soul', 'r&b', 'rnb', 'rhythm and blues', 'motown', 'funk'],
  metal: ['metal', 'heavy metal', 'hard rock'],
  reggae: ['reggae', 'ska', 'dub', 'dancehall'],
  country: ['country', 'bluegrass', 'western'],
};

// Mapped regions
export const regionToCountries: Record<string, string[]> = {
  all: [],
  'north-america': [
    'US', 'CA', 'MX', 'CU', 'DO', 'PR', 'GT', 'CR', 'PA', 'JM', 'HT', 'BS',
    'BZ', 'SV', 'HN', 'NI', 'TT', 'BB'
  ],
  'south-america': [
    'BR', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR'
  ],
  'europe': [
    'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'SE', 'BE', 'CH', 'AT', 'PT',
    'IE', 'NO', 'FI', 'DK', 'GR', 'TR', 'CZ', 'HU', 'RO', 'UA', 'IS', 'BG',
    'SK', 'HR', 'LT', 'LV', 'EE', 'SI', 'CY', 'LU', 'MT', 'AL', 'BA', 'MD',
    'ME', 'MK', 'RS', 'AM', 'GE', 'AZ'
  ],
  'asia': [
    'JP', 'KR', 'CN', 'IN', 'TH', 'ID', 'VN', 'PH', 'MY', 'SG', 'PK', 'BD',
    'AE', 'SA', 'IR', 'TW', 'HK', 'IL', 'LB', 'JO', 'QA', 'KW', 'OM', 'UZ',
    'KZ', 'MN', 'LK', 'MM', 'KH', 'NP', 'AF'
  ],
  'africa': [
    'ZA', 'NG', 'KE', 'EG', 'MA', 'DZ', 'TN', 'GH', 'SN', 'ET', 'UG', 'TZ',
    'CI', 'AO', 'CM', 'ZM', 'ZW', 'MW', 'ML', 'BF', 'NE', 'MG', 'RW', 'LY'
  ],
  'oceania': ['AU', 'NZ', 'FJ', 'PG', 'NC', 'PF', 'VU', 'WS', 'TO', 'KI'],
};

// --- HELPER FUNCTIONS (Must be defined before use) ---

// Normalize a tag for comparison
const normalizeTag = (tag: string): string => {
  return (tag || '').toLowerCase().trim().replace(/[&]/g, 'and').replace(/[-_]/g, ' ');
};

// Fix station URL if it's a known broken station
const fixStationUrl = (station: RadioStation): RadioStation => {
  const nameLower = station.name.toLowerCase();

  // SomaFM Indie Pop Rocks fix
  if ((nameLower.includes('soma') || nameLower.includes('somafm')) &&
    nameLower.includes('indie') &&
    (nameLower.includes('pop') || nameLower.includes('indiepop'))) {
    return {
      ...station,
      url_resolved: 'https://ice2.somafm.com/indiepop-256-mp3'
    };
  }

  return station;
};

// Filter out excluded countries
const filterExcludedCountries = (stations: RadioStation[]): RadioStation[] => {
  return stations.filter(station => !EXCLUDED_COUNTRIES.includes(station.countrycode));
};

// Fisher-Yates shuffle algorithm
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Count how many preference tags match a station
const countMatchingTags = (station: RadioStation, preferredTags: string[]): number => {
  const stationTags = normalizeTag(station.tags);
  return preferredTags.filter(tag => stationTags.includes(normalizeTag(tag))).length;
};

// --- SCORING & ALGORITHM ---

// Score stations based on "Indie" weighted ranking
const scoreStationForPreferences = (station: RadioStation, requestedGenres: string[]): number => {
  const tags = normalizeTag(station.tags);
  const name = station.name.toLowerCase();
  let score = 0;

  // 1. GENRE INTEGRITY (Baseline)
  const genreMatchCount = countMatchingTags(station, requestedGenres);
  score += genreMatchCount * 50;

  // 2. INDIE PROMOTION (Heavy Weight)
  let indieBonus = 0;
  PREFERRED_TAGS.forEach(tag => {
    if (tags.includes(tag) || name.includes(tag)) {
      indieBonus += 25;
    }
  });
  score += Math.min(indieBonus, 100);

  // 3. MAINSTREAM PENALTY (Heavy Penalty)
  DEPRIORITIZED_TAGS.forEach(tag => {
    if (tags.includes(tag) || name.includes(tag)) {
      score -= 50;
    }
  });

  // 4. QUALITY SIGNALS (Subtle)
  const votes = station.votes || 0;
  if (votes > 50 && votes < 5000) score += 10;
  if (votes > 50000) score -= 5;

  // 5. RANDOM NOISE (Freshness)
  score += Math.random() * 5;

  return score;
};

// INDIE SHUFFLE ALGORITHM
const curateStationsIndieShuffle = (
  stations: RadioStation[],
  requestedGenres: string[]
): RadioStation[] => {

  // Step 1: Score all stations
  const scored = stations.map(station => ({
    station,
    score: scoreStationForPreferences(station, requestedGenres)
  }));

  // Step 2: Sort by Score Descending
  scored.sort((a, b) => b.score - a.score);

  // Step 3: The "Top-Tier Shuffle"
  const totalCount = scored.length;
  if (totalCount === 0) return [];

  const topTierCount = Math.max(10, Math.floor(totalCount * 0.3));
  const topTier = scored.slice(0, topTierCount);
  const bottomTier = scored.slice(topTierCount);

  // Shuffle the Top Tier
  const shuffledTopTier = shuffleArray(topTier).map(s => s.station);

  // Keep Bottom Tier roughly sorted
  const sortedBottomTier = bottomTier.map(s => s.station);

  return [...shuffledTopTier, ...sortedBottomTier];
};

// --- EXPORTED API FUNCTIONS ---

export const searchStationsByGenre = async (genre: string): Promise<RadioStation[]> => {
  const tags = genreTagMap[genre] || [genre];

  try {
    const promises = tags.map(tag =>
      fetchWithFailover(`/stations/bytag/${encodeURIComponent(tag.trim())}?limit=200&order=votes&reverse=true`)
        .catch(() => [])
    );

    const results = await Promise.all(promises);
    let stations: RadioStation[] = results.flat();

    stations = filterExcludedCountries(stations);

    const unique = stations.filter((station, index, self) =>
      index === self.findIndex(s => s.stationuuid === station.stationuuid)
    );

    // --- SOUL LOGIC GATE ---
    // If browsing "RnB/Soul", strictly exclude stations that are also "Jazz".
    // Jazz takes priority for any station having both.
    let finalStations = unique;
    if (genre === 'soul') {
      finalStations = unique.filter(s => !normalizeTag(s.tags).includes('jazz'));
      console.log(`[Genre Filter] Applied Soul Logic Gate: ${unique.length} -> ${finalStations.length} (Filtered out Jazz overlaps)`);
    }

    return finalStations.slice(0, 200).map(fixStationUrl);
  } catch (error) {
    console.error('Error fetching stations:', error);
    return [];
  }
};

export const searchStationsByGenres = async (genres: string[]): Promise<RadioStation[]> => {
  try {
    const allPreferredTags: string[] = [];
    genres.forEach(genre => {
      const tags = genreTagMap[genre] || [genre];
      allPreferredTags.push(...tags);
    });

    const allStations = await Promise.all(genres.map(genre => searchStationsByGenre(genre)));
    let combined = allStations.flat();

    combined = filterExcludedCountries(combined);

    const unique = combined.filter((station, index, self) =>
      index === self.findIndex(s => s.stationuuid === station.stationuuid)
    );

    // Apply INDIE SHUFFLE ALGORITHM
    const curated = curateStationsIndieShuffle(unique, genres);

    console.log(`Genre filtering: ${genres.join(', ')} -> Found ${unique.length} stations, ${curated.length} after indie shuffle`);

    return curated.slice(0, 300).map(fixStationUrl);
  } catch (error) {
    console.error('Error fetching stations:', error);
    return [];
  }
};

export const getStationsByBounds = async (
  lat_sw: number,
  lon_sw: number,
  lat_ne: number,
  lon_ne: number,
  limit = 100
): Promise<RadioStation[]> => {
  try {
    let stations: RadioStation[] = await fetchWithFailover(
      `/stations/bybounds/${lat_sw}/${lon_sw}/${lat_ne}/${lon_ne}?limit=${limit}&order=votes&reverse=true`
    );
    stations = filterExcludedCountries(stations);
    // Apply Indie Shuffle with default 'all' weighting
    const curated = curateStationsIndieShuffle(stations, ['all']);
    return curated.map(fixStationUrl);
  } catch (error) {
    console.error('Error fetching stations by bounds:', error);
    return [];
  }
};

export const getStationsByState = async (state: string, countryCode = 'US', limit = 100): Promise<RadioStation[]> => {
  try {
    let stations: RadioStation[] = await fetchWithFailover(
      `/stations/search?state=${encodeURIComponent(state)}&countrycode=${countryCode}&limit=${limit}&order=votes&reverse=true`
    );
    stations = filterExcludedCountries(stations);
    // Apply Indie Shuffle
    const curated = curateStationsIndieShuffle(stations, ['all']);
    return curated.map(fixStationUrl);
  } catch (error) {
    console.error('Error fetching stations by state:', error);
    return [];
  }
};

export const searchStationsByName = async (query: string): Promise<RadioStation[]> => {
  try {
    let stations: RadioStation[] = await fetchWithFailover(`/stations/search?name=${encodeURIComponent(query)}&limit=100&order=votes&reverse=true`);
    stations = filterExcludedCountries(stations);
    const curated = curateStationsIndieShuffle(stations, ['all']);
    return curated.map(fixStationUrl);
  } catch (error) {
    console.error('Error searching stations:', error);
    return [];
  }
};

export const getStationsByCountry = async (countryCode: string): Promise<RadioStation[]> => {
  try {
    let stations: RadioStation[] = await fetchWithFailover(`/stations/bycountrycodeexact/${encodeURIComponent(countryCode)}?limit=100&order=votes&reverse=true`);
    stations = filterExcludedCountries(stations);
    // Apply Indie Shuffle
    const curated = curateStationsIndieShuffle(stations, ['all']);
    return curated.map(fixStationUrl);
  } catch (error) {
    console.error('Error fetching stations by country:', error);
    return [];
  }
};

export const searchStationsByLocation = async (query: string): Promise<RadioStation[]> => {
  try {
    // Search by country or state
    let stations: RadioStation[] = await fetchWithFailover(`/stations/search?country=${encodeURIComponent(query)}&limit=100&order=votes&reverse=true`);
    if (stations.length === 0) {
      stations = await fetchWithFailover(`/stations/search?state=${encodeURIComponent(query)}&limit=100&order=votes&reverse=true`);
    }
    stations = filterExcludedCountries(stations);
    const curated = curateStationsIndieShuffle(stations, ['all']);
    return curated.map(fixStationUrl);
  } catch (error) {
    console.error('Error searching stations by location:', error);
    return [];
  }
};

export const searchStationsByTag = async (query: string): Promise<RadioStation[]> => {
  try {
    let stations: RadioStation[] = await fetchWithFailover(`/stations/search?tag=${encodeURIComponent(query)}&limit=100&order=votes&reverse=true`);
    stations = filterExcludedCountries(stations);
    const curated = curateStationsIndieShuffle(stations, ['all']);
    return curated.map(fixStationUrl);
  } catch (error) {
    console.error('Error searching stations by tag:', error);
    return [];
  }
};

export interface CountryInfo {
  name: string;
  countrycode: string;
  stationcount: number;
}

export const getAllCountries = async (): Promise<CountryInfo[]> => {
  try {
    const countries: CountryInfo[] = await fetchWithFailover('/countries');
    return countries
      .filter(c => c.countrycode && c.countrycode.length === 2 && !EXCLUDED_COUNTRIES.includes(c.countrycode))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching countries:', error);
    return [];
  }
};

export const getCountryFlag = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};
