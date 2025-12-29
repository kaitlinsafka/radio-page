import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { Headphones, Search, ArrowLeft, Play, Heart, Map, X, Sun, Moon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchStationsByName,
  type RadioStation,
  getCountryFlag,
  getStationsByCountry,
  getStationsByState,
  genreTagMap
} from "@/services/radioBrowserApi";
import { MapboxMoonlight } from "@/components/MapboxMoonlight";
import { FloatingPlayer } from "@/components/FloatingPlayer";
import { Navbar } from "@/components/Navbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAudio } from "@/context/AudioContext";
import { useSavedLibrary } from "@/hooks/useSavedLibrary";
import { toast } from 'sonner';

const Explore = () => {
  const navigate = useNavigate();
  const { playStation, setStations } = useAudio();
  const { isStationSaved, saveStation, removeStation } = useSavedLibrary();
  const [stations, setLocalStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const results = await searchStationsByName(searchQuery);
    setLocalStations(results);
    setHasActiveSearch(true);
    setLoading(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedGenre('all');
    setLocalStations([]);
    setHasActiveSearch(false);
  };

  const handleResetMap = () => {
    setLocalStations([]);
    setHasActiveSearch(false);
    toast.info("Map reset to Global View");
  };

  const handleRegionSelect = async (countryCode: string, stateName?: string) => {
    setLoading(true);
    let results: RadioStation[] = [];

    if (results.length > 0 || true) { // Logic preservation context
      if (stateName) {
        toast.info(`Exploring stations in ${stateName}...`);
        results = await getStationsByState(stateName, countryCode);
      } else {
        toast.info(`Exploring stations in ${countryCode}...`);
        results = await getStationsByCountry(countryCode);
      }
    }

    if (results.length > 0) {
      setLocalStations(results);
      setHasActiveSearch(true);
    } else {
      toast.error("No stations found in this region. Try another one!");
    }
    setLoading(false);
  };

  const filteredStations = selectedGenre === 'all'
    ? stations
    : stations.filter(s => {
      const targetTags = genreTagMap[selectedGenre] || [selectedGenre];
      const stationTags = (s.tags || '').toLowerCase();
      return targetTags.some(t => stationTags.includes(t.toLowerCase()));
    });

  const handleStationClick = (station: RadioStation) => {
    setStations(filteredStations, 'explore');
    playStation(station, 'explore');
  };

  const toggleSave = (e: React.MouseEvent, station: RadioStation) => {
    e.stopPropagation();
    if (isStationSaved(station.stationuuid)) {
      removeStation(station.stationuuid);
    } else {
      saveStation(station);
      toast.success("Added to your library");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 transition-colors duration-500">
      <Navbar isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

      {/* Filters Section */}
      <div className="container max-w-7xl mx-auto px-6 py-6 border-b border-border bg-card/50">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Global Discovery: Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-12 bg-muted/50 border-2 border-transparent focus:border-primary/30 transition-all rounded-xl shadow-inner font-medium"
              />
            </div>
            <Button onClick={handleSearch} className="h-12 px-8 rounded-xl shadow-glow hover:scale-[1.02] transition-transform">
              SEARCH
            </Button>
          </div>
          <div className="flex gap-2">
            <Select value={selectedGenre} onValueChange={(value) => {
              setSelectedGenre(value);
              if (value !== 'all') setHasActiveSearch(true);
            }}>
              <SelectTrigger className="w-48 h-12 rounded-xl border-2">
                <SelectValue placeholder="All Genres" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2">
                <SelectItem value="all">ALL GENRES</SelectItem>
                {['Rock', 'Jazz', 'Electronic', 'Hip Hop', 'Folk', 'Punk', 'Classical', 'Blues', 'Indie', 'Soul'].map(g => (
                  <SelectItem key={g} value={g.toLowerCase()}>{g.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(hasActiveSearch || selectedGenre !== 'all' || searchQuery) && (
              <Button onClick={handleClearSearch} variant="destructive" className="h-12 rounded-xl gap-2 shadow-lg">
                <X className="w-5 h-5" />
                CLEAR
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {filteredStations.length} STATIONS SYNCED TO CURRENT VIEW
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowMap(!showMap)}
            className="gap-2 rounded-full border-2 px-6 shadow-soft"
          >
            <Map className="w-4 h-4" />
            {showMap ? 'MINIMIZE MAP' : 'EXPAND MAP'}
          </Button>
        </div>

        {showMap && (
          <div className="mb-12">
            <MapboxMoonlight
              stations={filteredStations}
              onStationClick={handleStationClick}
              onRegionSelect={handleRegionSelect}
              onReset={handleResetMap}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredStations.map((station) => (
            <div
              key={station.stationuuid}
              className="bg-card rounded-2xl p-6 shadow-medium hover:shadow-glow transition-all border-2 border-transparent hover:border-primary/40 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 overflow-hidden">
                  <h3 className="font-semibold text-lg leading-tight mb-1 truncate">{station.name}</h3>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                    <span className="text-base">{getCountryFlag(station.countrycode)}</span>
                    <span className="truncate">{station.country}</span>
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => toggleSave(e, station)}
                  className={`flex-shrink-0 -mt-2 -mr-2 transition-all ${isStationSaved(station.stationuuid) ? 'text-red-500 opacity-100' : 'opacity-20 group-hover:opacity-100 hover:text-red-500'}`}
                >
                  <Heart className={`w-5 h-5 ${isStationSaved(station.stationuuid) ? 'fill-current' : ''}`} />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-6">
                {station.tags?.split(',').slice(0, 3).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-muted rounded-md text-[9px] font-medium uppercase text-muted-foreground/80">
                    {tag.trim()}
                  </span>
                ))}
              </div>
              <Button
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg hover:translate-y-[-2px] transition-transform"
                onClick={() => handleStationClick(station)}
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                PLAY STATION
              </Button>
            </div>
          ))}
        </div>
      </div>

      <FloatingPlayer isDarkMode={isDarkMode} />
    </div>
  );
};

export default Explore;
