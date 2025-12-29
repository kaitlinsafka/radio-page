import React from "react";
import { ChevronLeft, ChevronRight, Play, Pause, Heart, Volume2, Sun, Moon, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
import { NowPlaying } from "@/components/NowPlaying";
import { RadioStation, getCountryFlag } from "@/services/radioBrowserApi";
import SavedStations from "@/components/SavedStations";
import { UserAuth } from "@/components/UserAuth";

interface RadioInterfaceProps {
    currentStation: RadioStation | null;
    isPlaying: boolean;
    loading: boolean;
    isConnecting: boolean;
    streamMetadata: string | null;
    volume: number;
    setVolume: (v: number) => void;

    onPlayPause: () => void;
    onNext: () => void;
    onPrevious: () => void;
    onSave: (e?: React.MouseEvent) => void;
    onShare: () => void;
    isSaved: boolean;

    mood: string;
    setMood: (m: string) => void;

    // Dialog/Overlay Controls
    showMapDialog: boolean;
    setShowMapDialog: (show: boolean) => void;
    region: string;
    setRegion: (r: string) => void;
    regionToCountries: Record<string, string[]>;
    onRegionSelect: (r: string) => void;

    showSavedStations: boolean;
    setShowSavedStations: (show: boolean) => void;
    onPlaySavedStation: (s: RadioStation) => void;

    isDarkMode: boolean;
    setIsDarkMode: (dark: boolean) => void;

    // Optional: Minimize for Explore mode
    onMinimize?: () => void;
    isExploreMode?: boolean;
    onCountrySelect?: (country: string) => void;
    selectedCountry?: string | null;
    audioRef?: React.RefObject<HTMLAudioElement>;
}

export const RadioInterface: React.FC<RadioInterfaceProps> = ({
    currentStation,
    isPlaying,
    loading,
    isConnecting,
    streamMetadata,
    volume,
    setVolume,
    onPlayPause,
    onNext,
    onPrevious,
    onSave,
    onShare,
    isSaved,
    mood,
    setMood,
    showMapDialog,
    setShowMapDialog,
    region,
    regionToCountries,
    onRegionSelect,
    showSavedStations,
    setShowSavedStations,
    onPlaySavedStation,
    isDarkMode,
    setIsDarkMode,
    onMinimize,
    isExploreMode = false,
    onCountrySelect,
    selectedCountry,
    audioRef
}) => {
    // Helper for Country Names
    const getCountryName = (code: string) => {
        if (!code) return "COUNTRY";
        try {
            return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
        } catch (e) {
            return code;
        }
    };

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto relative">

            {/* Radio Body with side-mounted handle */}
            <div className="relative">
                {/* Left Handle Post */}
                <div className="absolute -left-4 top-4 w-6 h-28 bg-[#8A9AA0] dark:bg-[#6b7a85] rounded-l-lg z-10"
                    style={{ borderRadius: '8px 4px 4px 8px' }} />

                {/* Right Handle Post */}
                <div className="absolute -right-4 top-4 w-6 h-28 bg-[#8A9AA0] dark:bg-[#6b7a85] rounded-r-lg z-10"
                    style={{ borderRadius: '4px 8px 8px 4px' }} />

                {/* Curved Handle Bar */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[calc(100%+2rem)] h-16 border-[12px] border-[#8A9AA0] dark:border-[#6b7a85] rounded-t-[3rem] z-20"
                    style={{ borderBottom: 'none' }} />

                {/* Main Body */}
                <div className="bg-[#F9F9FB] dark:bg-[#3d4a5a] rounded-[3rem] border-8 border-[#E0CDCE] dark:border-[#5a6878] p-8 md:p-12 aspect-[1.4/1] md:aspect-[1.6/1] flex flex-col relative overflow-hidden shadow-2xl">

                    {/* Minimize Button Removed */}

                    {/* Grill Section */}
                    <div className="w-full h-[35%] bg-[#D3E1E6] dark:bg-[#4d5a68] rounded-2xl mb-6 relative overflow-hidden border-4 border-[#E0CDCE] dark:border-[#3d4a5a] shadow-inner">
                        <div className="absolute inset-0 opacity-30 dark:opacity-20"
                            style={{
                                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, #331F21 4px, #331F21 5px)'
                            }}
                        />
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-[#331F21] dark:bg-[#1a1f28] text-[#F9F9FB] px-4 py-1 rounded-full text-xs font-bold tracking-widest border border-[#E0CDCE] dark:border-[#3d4a5a]">
                            NOW PLAYING
                        </div>
                    </div>

                    {/* Display & Info Section */}
                    <div className="flex-1 flex flex-col items-center justify-start relative z-10">

                        {/* Station Display Box */}
                        <div className="bg-[#F9F9FB] dark:bg-[#1a202c] border-4 border-[#331F21] dark:border-[#718096] rounded-xl px-4 py-2 mb-4 w-full flex flex-col items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] relative">
                            <h3 className="text-xl md:text-2xl font-bold text-[#331F21] dark:text-[#f7fafc] tracking-tight leading-tight truncate w-full text-center font-mono">
                                {loading ? "LOADING..." : currentStation?.name || "SELECT STATION"}
                            </h3>
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

                        {/* Visualizer */}
                        <div className="mb-8 w-full max-w-md">
                            <NowPlaying
                                streamMetadata={streamMetadata}
                                isPlaying={isPlaying}
                                stationName={currentStation?.name || ''}
                                audioRef={audioRef || { current: null }}
                            />
                        </div>

                        {/* Controls Section */}
                        <div className="w-full flex items-center justify-between px-6 md:px-24 mt-auto">

                            {/* Left Dial (Previous) */}
                            <button
                                onClick={onPrevious}
                                className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[#331F21] bg-[#E0CDCE] flex items-center justify-center shadow-[0_4px_0_#331F21] active:shadow-none active:translate-y-1 transition-all group flex-shrink-0"
                                aria-label="Previous Station"
                            >
                                <ChevronLeft className="w-10 h-10 text-[#331F21] group-hover:scale-110 transition-transform" />
                            </button>

                            {/* Center Control Panel */}
                            <div className="flex items-center gap-6 md:gap-10 mx-6">

                                {/* Left Side Buttons */}
                                <div className="flex flex-col gap-3">
                                    {/* Mood Select (Hidden in Explore Mode) or Country Select (Shown in Explore Mode) */}
                                    {!isExploreMode ? (
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
                                    ) : (
                                        <Select value={selectedCountry || undefined} onValueChange={(val) => onCountrySelect && onCountrySelect(val)}>
                                            <SelectTrigger className="h-10 px-4 border-2 border-[#331F21] dark:border-[#1a202c] bg-[#F9F9FB] dark:bg-[#D3E1E6] rounded-md font-bold text-xs text-[#331F21] dark:text-[#1a202c] hover:bg-[#E0CDCE] dark:hover:bg-[#E0CDCE] transition-colors shadow-[2px_2px_0_#331F21] dark:shadow-[2px_2px_0_#1a202c]">
                                                <span className="truncate max-w-[100px] uppercase">
                                                    {selectedCountry ? getCountryName(selectedCountry) : "COUNTRY"}
                                                </span>
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[300px] z-[200]">
                                                {Object.entries(regionToCountries)
                                                    .filter(([_, countries]) => countries.length > 0)
                                                    .map(([region, countries]) => (
                                                        <React.Fragment key={region}>
                                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                                                                {region.replace('-', ' ')}
                                                            </div>
                                                            {countries.sort().map((c) => (
                                                                <SelectItem key={c} value={c}>
                                                                    {getCountryName(c)}
                                                                </SelectItem>
                                                            ))}
                                                        </React.Fragment>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    )}

                                    {/* Location Button - if in explore mode, maybe disable or change behavior? */}
                                    <Button
                                        variant="outline"
                                        onClick={() => onMinimize ? onMinimize() : setShowMapDialog(true)}
                                        className="h-10 px-4 border-2 border-[#331F21] dark:border-[#1a202c] bg-[#F9F9FB] dark:bg-[#D3E1E6] rounded-md font-bold text-xs text-[#331F21] dark:text-[#1a202c] hover:bg-[#E0CDCE] dark:hover:bg-[#E0CDCE] transition-colors shadow-[2px_2px_0_#331F21] dark:shadow-[2px_2px_0_#1a202c]"
                                    >
                                        {isExploreMode ? 'BACK TO MAP' : 'LOCATION'}
                                    </Button>
                                </div>

                                {/* Dotted Lines */}
                                <div className="hidden md:flex flex-col gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#331F21] opacity-50" />
                                    <div className="w-2 h-2 rounded-full bg-[#331F21] opacity-50" />
                                </div>

                                {/* Main Play Button */}
                                <button
                                    onClick={onPlayPause}
                                    className={`w-20 h-20 md:w-24 md:h-24 border-4 border-[#331F21] rounded-xl flex items-center justify-center shadow-[4px_4px_0_#331F21] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all ${isPlaying ? 'bg-[#E9EFE4]' : 'bg-[#D3E1E6]'}`}
                                >
                                    {isPlaying ? (
                                        <Pause className="w-10 h-10 text-[#331F21]" fill="currentColor" />
                                    ) : (
                                        <Play className="w-10 h-10 text-[#331F21] ml-1" fill="currentColor" />
                                    )}
                                </button>

                                {/* Dotted Lines */}
                                <div className="hidden md:flex flex-col gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#331F21] opacity-50" />
                                    <div className="w-2 h-2 rounded-full bg-[#331F21] opacity-50" />
                                </div>

                                {/* Right Side Buttons */}
                                <div className="flex flex-col gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={onSave}
                                        className={`h-10 px-4 border-2 border-[#331F21] dark:border-[#1a202c] rounded-md font-bold text-xs text-[#331F21] dark:text-[#1a202c] hover:bg-[#E0CDCE] dark:hover:bg-[#E0CDCE] transition-colors shadow-[2px_2px_0_#331F21] dark:shadow-[2px_2px_0_#1a202c] ${isSaved ? 'bg-[#E0CDCE]' : 'bg-[#F9F9FB] dark:bg-[#D3E1E6]'}`}
                                    >
                                        SAVE <Heart className={`w-3 h-3 ml-1 ${isSaved ? 'fill-[#331F21] dark:fill-[#1a202c]' : ''}`} />
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={onShare}
                                        className="h-10 px-4 border-2 border-[#331F21] dark:border-[#1a202c] bg-[#F9F9FB] dark:bg-[#D3E1E6] rounded-md font-bold text-xs text-[#331F21] dark:text-[#1a202c] hover:bg-[#E0CDCE] dark:hover:bg-[#E0CDCE] transition-colors shadow-[2px_2px_0_#331F21] dark:shadow-[2px_2px_0_#1a202c]"
                                    >
                                        SHARE
                                    </Button>
                                </div>
                            </div>

                            {/* Right Dial (Next) */}
                            <button
                                onClick={onNext}
                                className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[#331F21] bg-[#E0CDCE] flex items-center justify-center shadow-[0_4px_0_#331F21] active:shadow-none active:translate-y-1 transition-all group flex-shrink-0"
                                aria-label="Next Station"
                            >
                                <ChevronRight className="w-10 h-10 text-[#331F21] group-hover:scale-110 transition-transform" />
                            </button>

                        </div>
                    </div>
                </div>
            </div>

            {/* Volume Slider & Smart Skip - Centered */}
            <div className="w-full max-w-md mt-8 px-8 mx-auto flex flex-col items-center gap-6">
                <Slider
                    value={[volume]}
                    onValueChange={(value) => setVolume(value[0])}
                    max={100}
                    step={1}
                    className="w-full"
                />
            </div>

            {/* Dialogs */}
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
                                onClick={() => onRegionSelect(r)}
                                className={`h-16 text-lg border-2 border-[#331F21] dark:border-border shadow-[4px_4px_0_#331F21] dark:shadow-[4px_4px_0_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#331F21] transition-all ${region === r ? 'bg-[#331F21] text-[#F9F9FB]' : 'bg-[#F9F9FB] dark:bg-card text-[#331F21] dark:text-foreground'}`}
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

            <Dialog open={showSavedStations} onOpenChange={setShowSavedStations}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#F9F9FB] dark:bg-card border-4 border-[#331F21] dark:border-border">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-[#331F21] dark:text-foreground font-mono">YOUR SAVED STATIONS</DialogTitle>
                        <DialogDescription className="sr-only">Your list of saved radio stations</DialogDescription>
                    </DialogHeader>
                    <SavedStations onPlayStation={onPlaySavedStation} />
                </DialogContent>
            </Dialog>
        </div>
    );
};
