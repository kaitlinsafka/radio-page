import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAudio } from "@/context/AudioContext";
import { useSavedLibrary } from "@/hooks/useSavedLibrary";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronUp, ChevronDown } from "lucide-react";
import { WaveformVisualizer } from "./NowPlaying";
import { Slider } from "@/components/ui/slider";
import { RadioInterface } from "./RadioInterface";
import { regionToCountries as initialRegionToCountries, getStationsByCountry, getAllCountries } from "@/services/radioBrowserApi";
import { toast } from "sonner";
import { useEffect } from "react";

interface FloatingPlayerProps {
    isDarkMode?: boolean;
}

export const FloatingPlayer = ({ isDarkMode = false }: FloatingPlayerProps) => {
    const {
        currentStation,
        isPlaying,
        loading,
        isConnecting,
        streamMetadata,
        togglePlay,
        nextStation,
        prevStation,
        volume,
        setVolume,
        setStations,
        playStation,
        activeMode,
        homeRadio,
        exploreRadio,
        audioRef
    } = useAudio();

    const location = useLocation();
    const isExplorePage = location.pathname === '/explore';

    const { isStationSaved, saveStation, removeStation } = useSavedLibrary();
    const [isExpanded, setIsExpanded] = useState(false);
    const [dummyMood, setDummyMood] = useState('all');
    const [dummyRegion, setDummyRegion] = useState('all');
    const [showMapDialog, setShowMapDialog] = useState(false);
    const [showSavedStations, setShowSavedStations] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [dynamicRegions, setDynamicRegions] = useState<Record<string, string[]>>(initialRegionToCountries);

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const allCountries = await getAllCountries();
                if (allCountries && allCountries.length > 0) {
                    const countryCodes = allCountries.map(c => c.countrycode);
                    setDynamicRegions({
                        ...initialRegionToCountries,
                        'all-countries': countryCodes
                    });
                }
            } catch (err) {
                console.error("Failed to fetch all countries", err);
            }
        };
        fetchCountries();
    }, []);

    if (!currentStation) return null;

    const handleSave = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (isStationSaved(currentStation.stationuuid)) {
            removeStation(currentStation.stationuuid);
            toast.info("Removed from library");
        } else {
            saveStation(currentStation);
            toast.success("Saved to library");
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(currentStation.url_resolved);
        toast.success("Link copied!");
    };

    const handleCountrySelect = async (country: string) => {
        setSelectedCountry(country);
        toast.info(`Traveling to ${country}...`);
        try {
            const stations = await getStationsByCountry(country);
            if (stations && stations.length > 0) {
                setStations(stations, 'explore');
                playStation(stations[0], 'explore');
                toast.success(`Arrived in ${country}!`);
            } else {
                toast.error(`No stations found in ${country}.`);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch stations.");
        }
    };

    // Expanded View (Full Radio)
    if (isExpanded) {
        return (
            <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300 overflow-y-auto">
                {/* Minimize Button - Absolute Position at Top Right */}
                <div className="absolute top-6 right-6 z-[110]">
                    <Button variant="ghost" className="gap-2" onClick={() => setIsExpanded(false)}>
                        MINIMIZE <ChevronDown className="w-4 h-4" />
                    </Button>
                </div>

                <div className="container max-w-7xl mx-auto px-6 py-24 flex flex-col items-center">
                    {/* Select state based on current page context */}
                    {(() => {
                        const drawerMode = isExplorePage ? 'explore' : 'home';
                        const radioState = isExplorePage ? exploreRadio : homeRadio;

                        return (
                            <RadioInterface
                                currentStation={radioState.station || (isExplorePage ? null : currentStation)}
                                isPlaying={radioState.isPlaying}
                                loading={loading}
                                isConnecting={isConnecting}
                                streamMetadata={radioState.streamMetadata}
                                volume={volume}
                                setVolume={setVolume}
                                onPlayPause={() => togglePlay(drawerMode)}
                                onNext={() => nextStation(drawerMode)}
                                onPrevious={() => prevStation(drawerMode)}
                                onSave={handleSave}
                                onShare={handleShare}
                                isSaved={radioState.station ? isStationSaved(radioState.station.stationuuid) : false}
                                mood={dummyMood}
                                setMood={setDummyMood}
                                showMapDialog={showMapDialog}
                                setShowMapDialog={setShowMapDialog}
                                region={dummyRegion}
                                setRegion={setDummyRegion}
                                regionToCountries={dynamicRegions}
                                onRegionSelect={() => { }}
                                showSavedStations={showSavedStations}
                                setShowSavedStations={setShowSavedStations}
                                onPlaySavedStation={() => { }}
                                isDarkMode={isDarkMode}
                                setIsDarkMode={() => { }}
                                onMinimize={() => setIsExpanded(false)}
                                isExploreMode={isExplorePage}
                                onCountrySelect={handleCountrySelect}
                                selectedCountry={selectedCountry}
                                audioRef={audioRef}
                            />
                        );
                    })()}
                </div>
            </div>
        );
    }

    // Minimized View (Bottom Bar)
    return (
        <div className="fixed bottom-0 left-0 right-0 z-[100] bg-[#331F21]/95 dark:bg-[#1a1f28]/95 backdrop-blur-md border-t-2 border-[#E0CDCE]/20 px-6 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] transition-all duration-300 animate-in slide-in-from-bottom-full">
            <div className="container max-w-7xl mx-auto flex items-center justify-between gap-6">

                {/* Expansion Trigger */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#331F21] dark:bg-[#1a1f28] rounded-full w-10 h-10 border-t border-l border-r border-[#E0CDCE]/20 hover:scale-110 transition-transform shadow-lg"
                    onClick={() => setIsExpanded(true)}
                >
                    <ChevronUp className="w-6 h-6 text-[#E9EFE4]" />
                </Button>

                {/* Visualizer & Station Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0" onClick={() => setIsExpanded(true)} role="button">
                    <div className="hidden md:flex bg-white/5 rounded-lg px-3 py-1 items-center justify-center border border-white/10">
                        <WaveformVisualizer />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-[#E9EFE4] font-bold text-sm truncate uppercase tracking-widest">{currentStation.name}</h4>
                        <p className="text-[#E9EFE4]/60 text-[10px] truncate uppercase">{currentStation.country || 'Unknown'}</p>
                    </div>
                </div>


                {/* Main Controls */}
                <div className="flex items-center gap-2 md:gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => prevStation()}
                        className="text-[#E9EFE4] hover:bg-white/10"
                    >
                        <SkipBack className="w-5 h-5 fill-current" />
                    </Button>

                    <button
                        onClick={() => togglePlay()}
                        className="w-12 h-12 rounded-full bg-[#E9EFE4] text-[#331F21] flex items-center justify-center hover:scale-105 transition-transform active:scale-95 shadow-lg"
                    >
                        {isPlaying ? (
                            <Pause className="w-6 h-6 fill-current" />
                        ) : (
                            <Play className="w-6 h-6 fill-current ml-1" />
                        )}
                    </button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => nextStation()}
                        className="text-[#E9EFE4] hover:bg-white/10"
                    >
                        <SkipForward className="w-5 h-5 fill-current" />
                    </Button>
                </div>

                {/* Volume Control */}
                <div className="flex items-center gap-3 flex-1 justify-end max-w-[200px]">
                    <Volume2 className="w-4 h-4 text-[#E9EFE4]/60" />
                    <Slider
                        value={[volume]}
                        onValueChange={(val) => setVolume(val[0])}
                        max={100}
                        step={1}
                        className="w-24 md:w-32"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setIsExpanded(true)} className="md:hidden text-[#E9EFE4]">
                        <ChevronUp className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
