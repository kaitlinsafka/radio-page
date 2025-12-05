const API_BASE = 'https://de1.api.radio-browser.info/json';

// Countries to exclude
const EXCLUDED_COUNTRIES = ['RU', 'IL'];

// Tags that indicate community/indie/niche stations (prioritized)
const PREFERRED_TAGS = ['community', 'indie', 'college', 'local', 'independent', 'underground', 'alternative', 'public radio', 'non-commercial'];

// Tags to deprioritize (Top 40, mainstream)
const DEPRIORITIZED_TAGS = ['top 40', 'hits', 'mainstream', 'pop hits', 'chart'];

// Tags to EXCLUDE completely - stations with these as primary tags should never appear unless explicitly requested
const EXCLUDED_TAGS = ['metal', 'heavy metal', 'death metal', 'black metal', 'thrash', 'hardcore', 'grindcore', 'power metal', 'news', 'talk', 'sports', 'religious'];

// Hardcoded stream URL overrides for known broken stations
const STREAM_URL_OVERRIDES: Record<string, string> = {
  // SomaFM stations often have outdated URLs in the database
  'somafm-indiepop': 'https://ice2.somafm.com/indiepop-256-mp3',
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

// Expanded genre tag map with multiple variations for better matching
const genreTagMap: Record<string, string[]> = {
  rock: ['rock', 'classic rock', 'rock and roll'],
  jazz: ['jazz', 'smooth jazz', 'bebop', 'swing'],
  electronic: ['electronic', 'techno', 'house', 'edm', 'dance', 'trance', 'ambient'],
  'hip-hop': ['hip hop', 'hip-hop', 'rap', 'hiphop'],
  folk: ['folk', 'americana', 'acoustic', 'singer-songwriter', 'singer songwriter'],
  world: ['world music', 'world', 'latin', 'african', 'international', 'reggae'],
  classical: ['classical', 'orchestra', 'symphony', 'baroque', 'opera'],
  blues: ['blues', 'delta blues', 'chicago blues', 'rhythm and blues'],
  indie: ['indie', 'indie rock', 'indie pop', 'alternative', 'alt rock'],
  soul: ['soul', 'r&b', 'rnb', 'rhythm and blues', 'motown', 'funk'],
  metal: ['metal', 'heavy metal', 'hard rock'],
  reggae: ['reggae', 'ska', 'dub', 'dancehall'],
  country: ['country', 'bluegrass', 'western'],
};

// Normalize a tag for comparison (lowercase, trim, handle special chars)
const normalizeTag = (tag: string): string => {
  return tag.toLowerCase().trim().replace(/[&]/g, 'and').replace(/[-_]/g, ' ');
};

// Check if a station's tags contain any of the preferred tags
const stationMatchesPreferences = (station: RadioStation, preferredTags: string[]): boolean => {
  const stationTags = normalizeTag(station.tags);
  return preferredTags.some(tag => stationTags.includes(normalizeTag(tag)));
};

// Count how many preference tags match a station
const countMatchingTags = (station: RadioStation, preferredTags: string[]): number => {
  const stationTags = normalizeTag(station.tags);
  return preferredTags.filter(tag => stationTags.includes(normalizeTag(tag))).length;
};

// Check if station has excluded primary tags (and wasn't explicitly requested)
const hasExcludedPrimaryTag = (station: RadioStation, requestedGenres: string[]): boolean => {
  const stationTags = normalizeTag(station.tags);

  // Check if any excluded tag is prominent in the station's tags
  for (const excludedTag of EXCLUDED_TAGS) {
    const normalizedExcluded = normalizeTag(excludedTag);

    // If the excluded tag is in station tags
    if (stationTags.includes(normalizedExcluded)) {
      // But check if user explicitly requested this genre
      const userRequestedThis = requestedGenres.some(genre => {
        const genreTags = genreTagMap[genre] || [genre];
        return genreTags.some(gt => normalizeTag(gt).includes(normalizedExcluded));
      });

      // Exclude only if user didn't request it
      if (!userRequestedThis) {
        return true;
      }
    }
  }

  return false;
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

// Filter out excluded countries
const filterExcludedCountries = (stations: RadioStation[]): RadioStation[] => {
  return stations.filter(station => !EXCLUDED_COUNTRIES.includes(station.countrycode));
};

// Score stations based on preference matching and quality signals
const scoreStationForPreferences = (station: RadioStation, preferredTags: string[]): number => {
  const tags = station.tags.toLowerCase();
  let score = 0;

  // Primary score: number of matching preference tags (most important)
  const matchCount = countMatchingTags(station, preferredTags);
  score += matchCount * 50; // Heavy weight for matching preferences

  // Boost for community/indie/niche
  PREFERRED_TAGS.forEach(tag => {
    if (tags.includes(tag)) score += 10;
  });

  // Penalty for mainstream/top 40
  DEPRIORITIZED_TAGS.forEach(tag => {
    if (tags.includes(tag)) score -= 15;
  });

  // Small boost for stations with moderate votes (not too popular, not too obscure)
  const votes = station.votes || 0;
  if (votes > 100 && votes < 10000) score += 5;
  if (votes > 10000 && votes < 50000) score += 2;

  return score;
};

// Sort and curate stations with strict preference matching
const curateStationsWithStrictMatching = (
  stations: RadioStation[],
  preferredTags: string[],
  requestedGenres: string[]
): RadioStation[] => {
  // STEP 1: Filter to only stations that match at least one preference
  const matchingStations = stations.filter(station =>
    stationMatchesPreferences(station, preferredTags)
  );

  // STEP 2: Exclude stations with non-requested excluded primary tags
  const filteredStations = matchingStations.filter(station =>
    !hasExcludedPrimaryTag(station, requestedGenres)
  );

  // STEP 3: Score remaining stations
  const scored = filteredStations.map(station => ({
    station,
    score: scoreStationForPreferences(station, preferredTags),
    matchCount: countMatchingTags(station, preferredTags)
  }));

  // STEP 4: Sort by match count first, then by score
  scored.sort((a, b) => {
    if (b.matchCount !== a.matchCount) {
      return b.matchCount - a.matchCount; // More matching tags first
    }
    return b.score - a.score; // Then by overall score
  });

  // STEP 5: Shuffle within tiers to add variety while preserving quality order
  const highMatch = scored.filter(s => s.matchCount >= 2);
  const singleMatch = scored.filter(s => s.matchCount === 1);

  const shuffledHigh = shuffleArray(highMatch).map(s => s.station);
  const shuffledSingle = shuffleArray(singleMatch).map(s => s.station);

  return [...shuffledHigh, ...shuffledSingle];
};

export const searchStationsByGenre = async (genre: string): Promise<RadioStation[]> => {
  // Get all tag variations for this genre
  const tags = genreTagMap[genre] || [genre];

  try {
    // Fetch stations for each tag variation
    const promises = tags.map(tag =>
      fetch(`${API_BASE}/stations/bytag/${encodeURIComponent(tag.trim())}?limit=200&order=votes&reverse=true`)
        .then(res => res.json())
        .catch(() => []) // Handle individual tag fetch failures gracefully
    );

    const results = await Promise.all(promises);
    let stations: RadioStation[] = results.flat();

    // Filter excluded countries
    stations = filterExcludedCountries(stations);

    // Remove duplicates
    const unique = stations.filter((station, index, self) =>
      index === self.findIndex(s => s.stationuuid === station.stationuuid)
    );

    // Fix known broken station URLs
    return unique.slice(0, 200).map(fixStationUrl);
  } catch (error) {
    console.error('Error fetching stations:', error);
    return [];
  }
};

export const searchStationsByGenres = async (genres: string[]): Promise<RadioStation[]> => {
  try {
    // Build complete list of preferred tags from all requested genres
    const allPreferredTags: string[] = [];
    genres.forEach(genre => {
      const tags = genreTagMap[genre] || [genre];
      allPreferredTags.push(...tags);
    });

    // Fetch stations for all genres
    const allStations = await Promise.all(genres.map(genre => searchStationsByGenre(genre)));
    let combined = allStations.flat();

    // Filter excluded countries
    combined = filterExcludedCountries(combined);

    // Remove duplicates
    const unique = combined.filter((station, index, self) =>
      index === self.findIndex(s => s.stationuuid === station.stationuuid)
    );

    // Apply STRICT curation with preference matching
    const curated = curateStationsWithStrictMatching(unique, allPreferredTags, genres);

    // Log for debugging
    console.log(`Genre filtering: ${genres.join(', ')} -> Found ${unique.length} stations, ${curated.length} after strict filtering`);

    // Fix known broken station URLs and return
    return curated.slice(0, 300).map(fixStationUrl);
  } catch (error) {
    console.error('Error fetching stations:', error);
    return [];
  }
};

export const searchStationsByName = async (query: string): Promise<RadioStation[]> => {
  try {
    const response = await fetch(`${API_BASE}/stations/search?name=${encodeURIComponent(query)}&limit=100&order=votes&reverse=true`);
    let stations: RadioStation[] = await response.json();

    // Filter excluded countries
    stations = filterExcludedCountries(stations);

    // Fix known broken station URLs
    return stations.map(fixStationUrl);
  } catch (error) {
    console.error('Error searching stations:', error);
    return [];
  }
};

export const getStationsByCountry = async (countryCode: string): Promise<RadioStation[]> => {
  try {
    const response = await fetch(`${API_BASE}/stations/bycountrycodeexact/${encodeURIComponent(countryCode)}?limit=100&order=votes&reverse=true`);
    let stations: RadioStation[] = await response.json();

    // Filter excluded countries (shouldn't be needed but for safety)
    stations = filterExcludedCountries(stations);

    // Fix known broken station URLs
    return stations.map(fixStationUrl);
  } catch (error) {
    console.error('Error fetching stations by country:', error);
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
