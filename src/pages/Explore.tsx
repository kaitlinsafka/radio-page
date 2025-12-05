import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Headphones, Search, ArrowLeft, Play, Heart, Map, X, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchStationsByGenres, searchStationsByName, type RadioStation, getCountryFlag } from "@/services/radioBrowserApi";
import StationMap from "@/components/StationMap";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Explore = () => {
  const navigate = useNavigate();
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [originalStations, setOriginalStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [playingStation, setPlayingStation] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [hasActiveSearch, setHasActiveSearch] = useState(false);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Apply dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const fetchStations = async () => {
      setLoading(true);
      const savedGenres = localStorage.getItem('userGenres');
      const genres = savedGenres ? JSON.parse(savedGenres) : ['rock', 'jazz', 'electronic'];
      const data = await searchStationsByGenres(genres);
      setStations(data);
      setOriginalStations(data);
      setLoading(false);
    };
    fetchStations();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const results = await searchStationsByName(searchQuery);
    setStations(results);
    setHasActiveSearch(true);
    setLoading(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedGenre('all');
    setStations(originalStations);
    setHasActiveSearch(false);
  };

  const filteredStations = selectedGenre === 'all'
    ? stations
    : stations.filter(s => s.tags.toLowerCase().includes(selectedGenre.toLowerCase()));

  const handleStationClick = (station: RadioStation) => {
    localStorage.setItem('selectedStation', JSON.stringify(station));
    navigate('/radio');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/radio')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Headphones className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-bold text-primary">RadioScope</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground">Explore Stations</h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="border-2"
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-700" />
                )}
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search stations by name or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
            <Select value={selectedGenre} onValueChange={(value) => {
              setSelectedGenre(value);
              if (value !== 'all') setHasActiveSearch(true);
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                <SelectItem value="rock">Rock</SelectItem>
                <SelectItem value="jazz">Jazz</SelectItem>
                <SelectItem value="electronic">Electronic</SelectItem>
                <SelectItem value="hip hop">Hip Hop</SelectItem>
                <SelectItem value="folk">Folk</SelectItem>
                <SelectItem value="world">World</SelectItem>
                <SelectItem value="classical">Classical</SelectItem>
                <SelectItem value="blues">Blues</SelectItem>
                <SelectItem value="indie">Indie</SelectItem>
                <SelectItem value="soul">Soul/R&B</SelectItem>
              </SelectContent>
            </Select>
            {/* Clear Search Button - highly visible */}
            {(hasActiveSearch || selectedGenre !== 'all' || searchQuery) && (
              <Button
                onClick={handleClearSearch}
                variant="destructive"
                className="gap-2 font-semibold"
              >
                <X className="w-4 h-4" />
                Clear Search
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-24">
            <div className="animate-pulse text-muted-foreground">Loading stations...</div>
          </div>
        ) : filteredStations.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-muted-foreground">No stations found</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                Showing {filteredStations.length} stations
              </p>
              <Button
                variant="outline"
                onClick={() => setShowMap(!showMap)}
                className="gap-2"
              >
                <Map className="w-4 h-4" />
                {showMap ? 'Hide Map' : 'Show Map'}
              </Button>
            </div>

            {/* Map View */}
            {showMap && (
              <div className="mb-8">
                <StationMap
                  stations={filteredStations.filter(s => s.geo_lat && s.geo_long)}
                  onStationClick={handleStationClick}
                />
              </div>
            )}

            {/* Station Grid */}
            <div className="grid grid-cols-4 gap-5">
              {filteredStations.map((station) => (
                <div
                  key={station.stationuuid}
                  className="bg-card rounded-xl p-5 shadow-soft hover:shadow-medium transition-all border-2 border-transparent hover:border-primary/30 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-semibold text-foreground mb-1 truncate">{station.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <span className="text-lg">{getCountryFlag(station.countrycode)}</span>
                        <span className="truncate">{station.country}</span>
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {station.tags.split(',').slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground truncate">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                  <Button
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                    onClick={() => handleStationClick(station)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Play Station
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Explore;
