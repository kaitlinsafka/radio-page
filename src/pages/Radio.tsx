import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, ChevronRight, Play, Pause, Heart, Loader, Volume2, Radio as RadioIcon, MapPin, X, Headphones, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioInterface } from "@/components/RadioInterface";
import { searchStationsByGenres, type RadioStation, getCountryFlag, regionToCountries } from "@/services/radioBrowserApi";
import { getApprovedLocalStations } from "@/services/localStationService";
import { toast } from "sonner";
import { StationFeedbackModal } from "@/components/StationFeedbackModal";
import { StaticAudioPlayer } from "@/components/StaticAudioPlayer";
import { RadioPlayer } from "@/components/RadioPlayer";
import { NowPlaying } from "@/components/NowPlaying";
import SavedStations from "@/components/SavedStations";
import { UserAuth } from "@/components/UserAuth";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
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
  DialogDescription,
} from "@/components/ui/dialog";

import { useAudio } from "@/context/AudioContext";
import { useSavedLibrary } from "@/hooks/useSavedLibrary";

const moodToGenres: Record<string, string[]> = {
  all: ['rock', 'jazz', 'electronic', 'folk', 'classical', 'blues', 'indie', 'soul'],
  upbeat: ['electronic', 'hip-hop', 'rock', 'reggae'],
  'dinner-party': ['jazz', 'soul', 'classical', 'folk'],
  'nostalgic-evening': ['blues', 'jazz', 'folk', 'soul'],
  'focus-work': ['classical', 'electronic', 'jazz'],
  'chill-vibes': ['indie', 'folk', 'soul', 'jazz'],
  'energetic': ['rock', 'metal', 'electronic', 'hip-hop'],
};



const Radio = () => {
  const navigate = useNavigate();
  const {
    currentStation,
    isPlaying,
    volume,
    stations,
    loading,
    isConnecting,
    streamMetadata,
    playStation,
    togglePlay,
    nextStation,
    prevStation,
    setVolume,
    setStations,
    currentStationIndex,
    activeMode,
    homeRadio,
    exploreRadio,
    handleStreamError,
    audioRef
  } = useAudio();

  const [mood, setMood] = useState<string>('all');
  const [region, setRegion] = useState<string>('all');
  // Use the global hook for saved library sync
  const { isStationSaved, saveStation, removeStation } = useSavedLibrary();
  const { user } = useAuth();

  const [showMapDialog, setShowMapDialog] = useState(false);

  // Submit station form
  const [submitStationName, setSubmitStationName] = useState("");
  const [submitStationUrl, setSubmitStationUrl] = useState("");

  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage or system preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return false; // Always default to light mode (false) for new users
    }
    return false;
  });

  // Dark mode toggle effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(isDarkMode));
  }, [isDarkMode]);

  const [activeTab, setActiveTab] = useState("player");
  const [offlineStations, setOfflineStations] = useState<Set<string>>(new Set());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStationRef = useRef<RadioStation | null>(null);

  // Check for initial station in URL parameters
  useEffect(() => {
    const urlParam = searchParams.get('url');
    const nameParam = searchParams.get('name');
    const countryParam = searchParams.get('country');

    if (urlParam && nameParam) {
      initialStationRef.current = {
        stationuuid: `param-${Date.now()}`,
        name: nameParam,
        url_resolved: urlParam,
        country: countryParam || 'Unknown',
        countrycode: '',
        tags: '',
        favicon: '',
      };
      console.log('Detected station in URL params:', initialStationRef.current);
    }
  }, []); // Only on mount
  // User preferences from localStorage - CLEARED and RELOADED fresh each time
  const [userPreferences, setUserPreferences] = useState<string[]>([]);

  // Load user preferences from localStorage on mount and when navigating back
  useEffect(() => {
    const loadPreferences = async () => {
      setPreferencesLoaded(false);
      setUserPreferences([]);

      // 1. Try cloud if logged in
      if (user) {
        try {
          const { data, error } = await supabase
            .from('user_preferences')
            .select('genres')
            .eq('user_id', user.id)
            .single();

          if (data?.genres && Array.isArray(data.genres)) {
            console.log('Cloud preferences loaded:', data.genres);
            setUserPreferences(data.genres);
            setPreferencesLoaded(true);
            return;
          }
        } catch (e) {
          console.error('Error loading cloud preferences:', e);
        }
      }

      // 2. Fallback to LocalStorage
      const savedGenres = localStorage.getItem('userGenres');
      if (savedGenres) {
        try {
          const parsed = JSON.parse(savedGenres);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('Local preferences loaded:', parsed);
            setUserPreferences(parsed);
          }
        } catch (e) {
          console.error('Error parsing local preferences:', e);
        }
      }
      setPreferencesLoaded(true);
    };

    loadPreferences();
  }, [user]);

  useEffect(() => {
    // DON'T fetch until preferences have been loaded
    if (!preferencesLoaded) {
      console.log('Waiting for preferences to load...');
      return;
    }

    const fetchStations = async () => {
      // setLoading(true); // Handled by context now
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

      // Fetch both local curated stations and global ones
      const [localData, globalData] = await Promise.all([
        getApprovedLocalStations(genresToFetch),
        searchStationsByGenres(genresToFetch)
      ]);

      // Merge results - PRIORITIZE local/curated stations by putting them first
      let data = [...localData];

      // Add global stations that aren't already represented by a local curated one
      globalData.forEach((gStation) => {
        const isAlreadyLocal = localData.some(l => l.stationuuid === gStation.stationuuid);
        if (!isAlreadyLocal) {
          data.push(gStation);
        }
      });

      // Filter by region if selected
      if (region !== 'all') {
        const countries = regionToCountries[region] || [];
        data = data.filter(station => countries.includes(station.countrycode));
      }

      // If we had a station from URL params, inject it at the start
      if (initialStationRef.current) {
        // Remove it if it already exists in the list (avoid duplicates)
        data = data.filter(s => s.url_resolved !== initialStationRef.current?.url_resolved);
        data = [initialStationRef.current, ...data];

        // Play it immediately
        playStation(initialStationRef.current, 'home');

        // Clear the ref so we don't keep injecting it on mood changes
        initialStationRef.current = null;

        // Also clear URL params so refresh doesn't keep it forever
        setSearchParams({}, { replace: true });
      }

      setStations(data, 'home');
      if (!currentStation && data.length > 0) {
        playStation(data[0], 'home');
      }
    };
    fetchStations();
  }, [mood, region, userPreferences, preferencesLoaded]);

  const handlePlayPause = () => {
    togglePlay('home');
  };

  const handleNext = () => {
    nextStation('home');
  };

  const handlePrevious = () => {
    prevStation('home');
  };

  const handleLoadingStart = () => {
    // setIsConnecting(true); // Handled by context
  };

  const handleLoadingEnd = () => {
    // setIsConnecting(false); // Handled by context
  };

  const handleSaveStation = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!homeRadio.station) return;

    if (isStationSaved(homeRadio.station.stationuuid)) {
      removeStation(homeRadio.station.stationuuid);
      toast.info(`Removed ${homeRadio.station.name} from your collection`);
    } else {
      saveStation(homeRadio.station);
      toast.success(`Saved ${homeRadio.station.name} to your collection!`);
    }
  };

  const isSaved = homeRadio.station && isStationSaved(homeRadio.station.stationuuid);

  const handleRegionSelect = (selectedRegion: string) => {
    setRegion(selectedRegion);
    setShowMapDialog(false);
  };

  const handlePlaySavedStation = (station: RadioStation) => {
    playStation(station, 'home');
    setActiveTab("player");
  };

  // Share Station functionality
  const handleShareStation = async () => {
    if (!homeRadio.station) return;

    // Copy streaming link with friendly message
    const shareMessage = `I think you'd like this station! Give it a listen :)\n${homeRadio.station.url_resolved}`;

    try {
      await navigator.clipboard.writeText(shareMessage);
      toast.success("Station link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  // State for saved stations dialog
  // Moved to Navbar

  // Reset metadata when station changes (handled in context, but keeping here for local reset if needed)
  useEffect(() => {
    // metadata is now handled globally
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
      <Navbar isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

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
                <div className="bg-[#F9F9FB] dark:bg-[#1a202c] border-4 border-[#331F21] dark:border-[#718096] rounded-lg px-8 py-4 mb-4 w-full max-w-md text-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] relative">
                  <h2 className="text-2xl font-bold text-[#331F21] dark:text-[#f7fafc] truncate font-mono">
                    {loading && activeMode === 'home'
                      ? "LOADING..."
                      : homeRadio.station?.name || "SELECT STATION"
                    }
                  </h2>
                  <div className="flex items-center justify-center gap-2 text-[#331F21]/70 dark:text-white mt-1 font-mono text-sm">
                    {isConnecting && activeMode === 'home' ? (
                      <span className="animate-pulse">CONNECTING...</span>
                    ) : (
                      <>
                        <span className="text-lg">{homeRadio.station && getCountryFlag(homeRadio.station.countrycode)}</span>
                        <span>{homeRadio.station?.country || "UNKNOWN LOCATION"}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* What Song Is That? Button (Integrated NowPlaying) */}
                <div className="mb-8">
                  <NowPlaying
                    streamMetadata={homeRadio.streamMetadata}
                    isPlaying={homeRadio.isPlaying}
                    stationName={homeRadio.station?.name || ''}
                    audioRef={audioRef}
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
                      className={`w-20 h-20 md:w-24 md:h-24 border-4 border-[#331F21] rounded-xl flex items-center justify-center shadow-[4px_4px_0_#331F21] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all ${homeRadio.isPlaying ? 'bg-[#E9EFE4]' : 'bg-[#D3E1E6]'
                        }`}
                    >
                      {homeRadio.isPlaying ? (
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

          {/* Volume Slider & Smart Skip (Outside Radio) - Centered */}
          <div className="w-full max-w-md mt-8 px-8 mx-auto flex flex-col items-center gap-6">

            <Slider
              value={[volume]}
              onValueChange={(value) => setVolume(value[0])}
              max={100}
              step={1}
              className="w-full"
            />

            <button
              onClick={() => setShowFeedbackModal(true)}
              className="text-[10px] font-black uppercase text-[#331F21]/40 hover:text-[#331F21] transition-colors underline decoration-2 underline-offset-4"
            >
              Something not sounding right? Let me know!
            </button>
          </div>

          {/* Static Audio Player - plays during loading */}
          <StaticAudioPlayer isPlaying={isConnecting} volume={volume * 0.6} />

          {/* Location Map Dialog */}
          <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
            <DialogContent className="max-w-2xl bg-[#F9F9FB] dark:bg-card border-4 border-[#331F21] dark:border-border">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#331F21] dark:text-foreground font-mono">SELECT REGION</DialogTitle>
                <DialogDescription className="sr-only">Select a region to filter stations</DialogDescription>
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

        </div>
      </div>

      <StationFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        station={homeRadio.station ? { id: homeRadio.station.stationuuid, name: homeRadio.station.name } : null}
      />
    </div>
  );
};

export default Radio;
