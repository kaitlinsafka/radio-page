import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, ChevronRight, Play, Pause, Heart, Loader, Volume2, Radio as RadioIcon, MapPin, X, Headphones, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchStationsByGenres, type RadioStation, getCountryFlag } from "@/services/radioBrowserApi";
import { toast } from "sonner";
import { StaticAudioPlayer } from "@/components/StaticAudioPlayer";
import { RadioPlayer } from "@/components/RadioPlayer";
import { NowPlaying } from "@/components/NowPlaying";
import SavedStations from "@/components/SavedStations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const moodToGenres: Record<string, string[]> = {
  all: ['rock', 'jazz', 'electronic', 'folk', 'classical', 'blues', 'indie', 'soul'],
  upbeat: ['electronic', 'hip-hop', 'rock', 'reggae'],
  'dinner-party': ['jazz', 'soul', 'classical', 'folk'],
  'nostalgic-evening': ['blues', 'jazz', 'folk', 'soul'],
  'focus-work': ['classical', 'electronic', 'jazz'],
  'chill-vibes': ['indie', 'folk', 'soul', 'jazz'],
  'energetic': ['rock', 'metal', 'electronic', 'hip-hop'],
};

const regionToCountries: Record<string, string[]> = {
  all: [],
  'north-america': ['US', 'CA', 'MX'],
  'south-america': ['BR', 'AR', 'CO', 'CL', 'PE'],
  'europe': ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'SE'],
  'asia': ['JP', 'KR', 'CN', 'IN', 'TH', 'ID'],
  'africa': ['ZA', 'NG', 'KE', 'EG', 'MA'],
  'oceania': ['AU', 'NZ'],
};

const Radio = () => {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [volume, setVolume] = useState(75);
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState<string>('all');
  const [region, setRegion] = useState<string>('all');
  const [savedStations, setSavedStations] = useState<string[]>([]);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("player");
  const [offlineStations, setOfflineStations] = useState<Set<string>>(new Set());
  const [streamMetadata, setStreamMetadata] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // User preferences from localStorage - CLEARED and RELOADED fresh each time
  const [userPreferences, setUserPreferences] = useState<string[]>([]);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage or system preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Submit station form
  const [submitStationName, setSubmitStationName] = useState("");
  const [submitStationUrl, setSubmitStationUrl] = useState("");

  const currentStation = stations[currentStationIndex];
  const isCurrentOffline = currentStation && offlineStations.has(currentStation.stationuuid);

  // Dark mode toggle effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const saved = localStorage.getItem('savedStations');
    if (saved) {
      setSavedStations(JSON.parse(saved));
    }
  }, []);

  // Load user preferences from localStorage on mount and when navigating back
  // Track if we've loaded preferences to prevent race conditions
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    const loadPreferences = () => {
      // COMPLETELY CLEAR the state before loading
      setUserPreferences([]);

      const savedGenres = localStorage.getItem('userGenres');
      if (savedGenres) {
        try {
          const parsed = JSON.parse(savedGenres);
          // Only use if it's a valid, non-empty array
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('User preferences loaded:', parsed);
            setUserPreferences(parsed);
          }
        } catch (e) {
          console.error('Error parsing user preferences:', e);
        }
      }
      // Mark as loaded AFTER processing
      setPreferencesLoaded(true);
    };

    loadPreferences();
  }, []); // Only run once on mount

  useEffect(() => {
    // DON'T fetch until preferences have been loaded
    if (!preferencesLoaded) {
      console.log('Waiting for preferences to load...');
      return;
    }

    const fetchStations = async () => {
      setLoading(true);
      setOfflineStations(new Set());

      // PRIORITY: Determine which genres to use - CLEAR LOGIC
      let genresToFetch: string[];

      if (mood !== 'all') {
        // If a specific mood is selected, use ONLY those genres (ignore stored preferences)
        genresToFetch = moodToGenres[mood] || [];
        console.log(`Using mood genres ONLY (${mood}):`, genresToFetch);
      } else if (userPreferences.length > 0) {
        // If mood is 'all' but user has saved preferences, use ONLY those
        genresToFetch = [...userPreferences]; // Clone to avoid mutations
        console.log('Using user preferences EXCLUSIVELY:', genresToFetch);
      } else {
        // Fallback to default broad mix ONLY if no preferences
        genresToFetch = moodToGenres.all;
        console.log('Using default genres (no preferences):', genresToFetch);
      }

      // Fetch stations with the determined genres
      let data = await searchStationsByGenres(genresToFetch);

      // Filter by region if selected
      if (region !== 'all') {
        const countries = regionToCountries[region] || [];
        data = data.filter(station => countries.includes(station.countrycode));
      }

      setStations(data);
      setCurrentStationIndex(0);
      setLoading(false);
    };
    fetchStations();
  }, [mood, region, userPreferences, preferencesLoaded]); // Include preferencesLoaded

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (stations.length > 0) {
      let nextIndex = (currentStationIndex + 1) % stations.length;
      // Skip offline stations
      let attempts = 0;
      while (offlineStations.has(stations[nextIndex]?.stationuuid) && attempts < stations.length) {
        nextIndex = (nextIndex + 1) % stations.length;
        attempts++;
      }
      setCurrentStationIndex(nextIndex);
      setIsPlaying(true);
    }
  };

  const handlePrevious = () => {
    if (stations.length > 0) {
      let prevIndex = (currentStationIndex - 1 + stations.length) % stations.length;
      // Skip offline stations
      let attempts = 0;
      while (offlineStations.has(stations[prevIndex]?.stationuuid) && attempts < stations.length) {
        prevIndex = (prevIndex - 1 + stations.length) % stations.length;
        attempts++;
      }
      setCurrentStationIndex(prevIndex);
      setIsPlaying(true);
    }
  };

  const handleStreamError = () => {
    if (currentStation) {
      setOfflineStations(prev => new Set(prev).add(currentStation.stationuuid));
      toast.error(`${currentStation.name} is offline after 5 seconds. Skipping...`);
      // Auto-skip to next station
      setTimeout(() => handleNext(), 1500);
    }
  };

  const handleLoadingStart = () => {
    setIsConnecting(true);
  };

  const handleLoadingEnd = () => {
    setIsConnecting(false);
  };

  const handleSaveStation = () => {
    if (!currentStation) return;

    const newSaved = savedStations.includes(currentStation.stationuuid)
      ? savedStations.filter(id => id !== currentStation.stationuuid)
      : [...savedStations, currentStation.stationuuid];

    setSavedStations(newSaved);
    localStorage.setItem('savedStations', JSON.stringify(newSaved));

    // Also save station data for the saved stations view
    const savedData = JSON.parse(localStorage.getItem('savedStationsData') || '[]');
    if (!savedStations.includes(currentStation.stationuuid)) {
      savedData.push(currentStation);
      localStorage.setItem('savedStationsData', JSON.stringify(savedData));
      toast.success(`Saved ${currentStation.name} to your collection!`);
    } else {
      toast.info(`Removed ${currentStation.name} from your collection`);
    }
  };

  const isSaved = currentStation && savedStations.includes(currentStation.stationuuid);

  const handleRegionSelect = (selectedRegion: string) => {
    setRegion(selectedRegion);
    setShowMapDialog(false);
  };

  const handlePlaySavedStation = (station: RadioStation) => {
    const index = stations.findIndex(s => s.stationuuid === station.stationuuid);
    if (index >= 0) {
      setCurrentStationIndex(index);
    } else {
      setStations(prev => [station, ...prev]);
      setCurrentStationIndex(0);
    }
    setIsPlaying(true);
    setActiveTab("player");
  };

  // Share Station functionality
  const handleShareStation = async () => {
    if (!currentStation) return;

    // Copy streaming link with friendly message
    const shareMessage = `I think you'd like this station! Give it a listen :)\n${currentStation.url_resolved}`;

    try {
      await navigator.clipboard.writeText(shareMessage);
      toast.success("Station link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  // State for saved stations dialog
  const [showSavedStations, setShowSavedStations] = useState(false);

  // Handle metadata change from stream
  const handleMetadataChange = (metadata: string | null) => {
    setStreamMetadata(metadata);
  };

  // Reset metadata when station changes
  useEffect(() => {
    setStreamMetadata(null);
  }, [currentStationIndex]);

  // Submit local station
  const handleSubmitStation = () => {
    if (!submitStationName.trim() || !submitStationUrl.trim()) {
      toast.error("Please fill in both station name and URL");
      return;
    }

    // Log submission (in production, this would go to a backend)
    console.log("Station submission:", {
      name: submitStationName,
      url: submitStationUrl,
      submittedAt: new Date().toISOString(),
    });

    toast.success("Thank you! Your station has been submitted for review.");
    setSubmitStationName("");
    setSubmitStationUrl("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Navigation */}
      <header className="border-b border-border bg-card sticky top-0 z-50 shadow-md">
        <div className="container max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <Headphones className="w-7 h-7 text-primary" />
              <h1 className="text-xl font-bold text-foreground">RadioScope</h1>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate('/explore')}
                className="text-foreground/70 hover:text-foreground hover:bg-muted"
              >
                Explore
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/onboarding')}
                className="text-foreground/70 hover:text-foreground hover:bg-muted"
              >
                Preferences
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowSavedStations(true)}
                className="text-foreground/70 hover:text-foreground hover:bg-muted"
              >
                <Heart className="w-4 h-4 mr-1" />
                Saved
              </Button>
            </nav>

            {/* Dark Mode Toggle */}
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
      </header>

      {/* Main Radio Container - more top margin for gap from header */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="relative w-full max-w-4xl mx-auto mt-16">

          {/* Radio Body with side-mounted handle */}
          <div className="relative">
            {/* Left Handle Post - comes out of left side of radio */}
            <div className="absolute -left-4 top-4 w-6 h-28 bg-[#8A9AA0] dark:bg-[#6b7a85] rounded-l-lg z-10"
              style={{ borderRadius: '8px 4px 4px 8px' }} />

            {/* Right Handle Post - comes out of right side of radio */}
            <div className="absolute -right-4 top-4 w-6 h-28 bg-[#8A9AA0] dark:bg-[#6b7a85] rounded-r-lg z-10"
              style={{ borderRadius: '4px 8px 8px 4px' }} />

            {/* Curved Handle Bar Over Top */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[calc(100%+2rem)] h-16 border-[12px] border-[#8A9AA0] dark:border-[#6b7a85] rounded-t-[3rem] z-20"
              style={{ borderBottom: 'none' }} />



            {/* Radio Body - improved dark mode contrast */}
            <div className="bg-[#F9F9FB] dark:bg-[#3d4a5a] rounded-[3rem] border-8 border-[#E0CDCE] dark:border-[#5a6878] p-8 md:p-12 aspect-[1.4/1] md:aspect-[1.6/1] flex flex-col relative overflow-hidden">

              {/* Grill Section */}
              <div className="w-full h-[35%] bg-[#D3E1E6] dark:bg-[#4d5a68] rounded-2xl mb-6 relative overflow-hidden border-4 border-[#E0CDCE] dark:border-[#3d4a5a] shadow-inner">
                {/* Grill Lines Pattern */}
                <div className="absolute inset-0 opacity-30 dark:opacity-20"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, #331F21 4px, #331F21 5px)'
                  }}
                />

                {/* Now Playing Badge */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-[#331F21] dark:bg-[#1a1f28] text-[#F9F9FB] px-4 py-1 rounded-full text-xs font-bold tracking-widest border border-[#E0CDCE] dark:border-[#5a6878]">
                  NOW PLAYING
                </div>
              </div>

              {/* Display & Info Section */}
              <div className="flex-1 flex flex-col items-center justify-start relative z-10">

                {/* Station Display Box - rotation removed */}
                <div className="bg-[#F9F9FB] dark:bg-[#1a202c] border-4 border-[#331F21] dark:border-[#718096] rounded-lg px-8 py-4 mb-4 w-full max-w-md text-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
                  <h2 className="text-2xl font-bold text-[#331F21] dark:text-[#f7fafc] truncate font-mono">
                    {loading ? "LOADING..." : currentStation?.name || "SELECT STATION"}
                  </h2>
                  <div className="flex items-center justify-center gap-2 text-[#331F21]/70 dark:text-white mt-1 font-mono text-sm">
                    {isConnecting ? (
                      <span className="animate-pulse">CONNECTING...</span>
                    ) : (
                      <>
                        <span className="text-lg">{currentStation && getCountryFlag(currentStation.countrycode)}</span>
                        <span>{currentStation?.country || "UNKNOWN LOCATION"}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* What Song Is That? Button (Integrated NowPlaying) */}
                <div className="mb-8">
                  <NowPlaying
                    streamMetadata={streamMetadata}
                    isPlaying={isPlaying}
                    stationName={currentStation?.name || ''}
                  />
                </div>

                {/* Controls Section */}
                <div className="w-full flex items-center justify-between px-4 md:px-12 mt-auto">

                  {/* Left Dial (Previous) */}
                  <button
                    onClick={handlePrevious}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[#331F21] bg-[#E0CDCE] flex items-center justify-center shadow-[0_4px_0_#331F21] active:shadow-none active:translate-y-1 transition-all group"
                    aria-label="Previous Station"
                  >
                    <ChevronLeft className="w-10 h-10 text-[#331F21] group-hover:scale-110 transition-transform" />
                  </button>

                  {/* Center Control Panel */}
                  <div className="flex items-center gap-4 md:gap-6">

                    {/* Left Side Buttons (Mood & Location) */}
                    <div className="flex flex-col gap-3">
                      <Select value={mood} onValueChange={setMood}>
                        <SelectTrigger className="h-10 px-4 border-2 border-[#331F21] dark:border-[#1a202c] bg-[#F9F9FB] dark:bg-[#D3E1E6] rounded-md font-bold text-xs text-[#331F21] dark:text-[#1a202c] hover:bg-[#E0CDCE] dark:hover:bg-[#E0CDCE] transition-colors shadow-[2px_2px_0_#331F21] dark:shadow-[2px_2px_0_#1a202c]">
                          <span className="truncate max-w-[80px]">MOOD</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Moods</SelectItem>
                          <SelectItem value="upbeat">Upbeat</SelectItem>
                          <SelectItem value="dinner-party">Dinner Party</SelectItem>
                          <SelectItem value="nostalgic-evening">Nostalgic</SelectItem>
                          <SelectItem value="focus-work">Focus</SelectItem>
                          <SelectItem value="chill-vibes">Chill</SelectItem>
                          <SelectItem value="energetic">Energetic</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        onClick={() => setShowMapDialog(true)}
                        className="h-10 px-4 border-2 border-[#331F21] dark:border-[#1a202c] bg-[#F9F9FB] dark:bg-[#D3E1E6] rounded-md font-bold text-xs text-[#331F21] dark:text-[#1a202c] hover:bg-[#E0CDCE] dark:hover:bg-[#E0CDCE] transition-colors shadow-[2px_2px_0_#331F21] dark:shadow-[2px_2px_0_#1a202c]"
                      >
                        LOCATION
                      </Button>
                    </div>

                    {/* Dotted Lines Left */}
                    <div className="hidden md:flex flex-col gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#331F21] opacity-50" />
                      <div className="w-2 h-2 rounded-full bg-[#331F21] opacity-50" />
                    </div>

                    {/* Main Play Button */}
                    <button
                      onClick={handlePlayPause}
                      className={`w-20 h-20 md:w-24 md:h-24 border-4 border-[#331F21] rounded-xl flex items-center justify-center shadow-[4px_4px_0_#331F21] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all ${isPlaying ? 'bg-[#E9EFE4]' : 'bg-[#D3E1E6]'
                        }`}
                    >
                      {isPlaying ? (
                        <Pause className="w-10 h-10 text-[#331F21]" fill="currentColor" />
                      ) : (
                        <Play className="w-10 h-10 text-[#331F21] ml-1" fill="currentColor" />
                      )}
                    </button>

                    {/* Dotted Lines Right */}
                    <div className="hidden md:flex flex-col gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#331F21] opacity-50" />
                      <div className="w-2 h-2 rounded-full bg-[#331F21] opacity-50" />
                    </div>

                    {/* Right Side Buttons (Save & Share) */}
                    <div className="flex flex-col gap-3">
                      <Button
                        variant="outline"
                        onClick={handleSaveStation}
                        className={`h-10 px-4 border-2 border-[#331F21] dark:border-[#1a202c] rounded-md font-bold text-xs text-[#331F21] dark:text-[#1a202c] hover:bg-[#E0CDCE] dark:hover:bg-[#E0CDCE] transition-colors shadow-[2px_2px_0_#331F21] dark:shadow-[2px_2px_0_#1a202c] ${isSaved ? 'bg-[#E0CDCE]' : 'bg-[#F9F9FB] dark:bg-[#D3E1E6]'
                          }`}
                      >
                        SAVE <Heart className={`w-3 h-3 ml-1 ${isSaved ? 'fill-[#331F21] dark:fill-[#1a202c]' : ''}`} />
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleShareStation}
                        className="h-10 px-4 border-2 border-[#331F21] dark:border-[#1a202c] bg-[#F9F9FB] dark:bg-[#D3E1E6] rounded-md font-bold text-xs text-[#331F21] dark:text-[#1a202c] hover:bg-[#E0CDCE] dark:hover:bg-[#E0CDCE] transition-colors shadow-[2px_2px_0_#331F21] dark:shadow-[2px_2px_0_#1a202c]"
                      >
                        SHARE
                      </Button>
                    </div>

                  </div>

                  {/* Right Dial (Next) */}
                  <button
                    onClick={handleNext}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[#331F21] bg-[#E0CDCE] flex items-center justify-center shadow-[0_4px_0_#331F21] active:shadow-none active:translate-y-1 transition-all group"
                    aria-label="Next Station"
                  >
                    <ChevronRight className="w-10 h-10 text-[#331F21] group-hover:scale-110 transition-transform" />
                  </button>

                </div>
              </div>
            </div>
          </div>

          {/* Volume Slider (Outside Radio) - Centered */}
          <div className="w-full max-w-md mt-8 px-8 mx-auto">
            <Slider
              value={[volume]}
              onValueChange={(value) => setVolume(value[0])}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Static Audio Player - plays during loading */}
          <StaticAudioPlayer isPlaying={isConnecting} volume={volume * 0.6} />

          {/* Hidden Audio Element */}
          {currentStation && (
            <RadioPlayer
              isPlaying={isPlaying}
              streamUrl={currentStation.url_resolved}
              volume={volume}
              onStreamError={handleStreamError}
              onLoadingStart={handleLoadingStart}
              onLoadingEnd={handleLoadingEnd}
              onMetadataChange={handleMetadataChange}
            />
          )}

          {/* Location Map Dialog */}
          <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
            <DialogContent className="max-w-2xl bg-[#F9F9FB] dark:bg-card border-4 border-[#331F21] dark:border-border">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#331F21] dark:text-foreground font-mono">SELECT REGION</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {Object.keys(regionToCountries).map((r) => (
                  <Button
                    key={r}
                    variant={region === r ? 'default' : 'outline'}
                    onClick={() => handleRegionSelect(r)}
                    className={`h-16 text-lg border-2 border-[#331F21] dark:border-border shadow-[4px_4px_0_#331F21] dark:shadow-[4px_4px_0_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#331F21] transition-all ${region === r ? 'bg-[#331F21] text-[#F9F9FB]' : 'bg-[#F9F9FB] dark:bg-card text-[#331F21] dark:text-foreground'
                      }`}
                  >
                    {r === 'all' ? '🌍 Worldwide' :
                      r === 'north-america' ? '🌎 North America' :
                        r === 'south-america' ? '🌎 South America' :
                          r === 'europe' ? '🌍 Europe' :
                            r === 'asia' ? '🌏 Asia' :
                              r === 'africa' ? '🌍 Africa' : '🌏 Oceania'}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* Saved Stations Dialog */}
          <Dialog open={showSavedStations} onOpenChange={setShowSavedStations}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#F9F9FB] dark:bg-card border-4 border-[#331F21] dark:border-border">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#331F21] dark:text-foreground font-mono">YOUR SAVED STATIONS</DialogTitle>
              </DialogHeader>
              <SavedStations onPlayStation={handlePlaySavedStation} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Radio;
