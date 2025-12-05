import { useState, useEffect } from "react";
import { RadioPlayer } from "@/components/RadioPlayer";
import { GenreSelector } from "@/components/GenreSelector";
import { StationInfo } from "@/components/StationInfo";
import { searchStationsByGenre, getCountryFlag, type RadioStation } from "@/services/radioBrowserApi";

const Index = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('rock');
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [volume, setVolume] = useState(75);
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);

  const currentStation = stations[currentStationIndex];

  useEffect(() => {
    const fetchStations = async () => {
      setLoading(true);
      const data = await searchStationsByGenre(selectedGenre);
      setStations(data);
      setLoading(false);
    };
    fetchStations();
  }, [selectedGenre]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    setCurrentStationIndex(prev => (prev + 1) % stations.length);
    setIsPlaying(true);
  };

  const handleGenreChange = (genre: string) => {
    setSelectedGenre(genre);
    setCurrentStationIndex(0);
    setIsPlaying(false);
  };
  return <div className="min-h-screen bg-background">
      {/* Subtle texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
      backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" /%3E%3C/filter%3E%3Crect width="100" height="100" filter="url(%23noise)" opacity="0.4"/%3E%3C/svg%3E")'
    }} />

      <div className="relative container max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        

        {/* Main Content */}
        <div className="space-y-8">
          {/* Genre Selector */}
          <GenreSelector selectedGenre={selectedGenre} onGenreChange={handleGenreChange} />

          {loading ? (
            <div className="text-center text-foreground/60 py-12">Loading stations...</div>
          ) : stations.length === 0 ? (
            <div className="text-center text-foreground/60 py-12">No stations found for this genre</div>
          ) : (
            <>
              {/* Radio Player */}
              <RadioPlayer 
                isPlaying={isPlaying} 
                streamUrl={currentStation.url_resolved}
                volume={volume} 
              />

              {/* Station Info */}
              <div className="flex justify-center">
                <StationInfo 
                  stationName={currentStation.name} 
                  location={currentStation.country} 
                  country={currentStation.country} 
                  countryCode={getCountryFlag(currentStation.countrycode)} 
                  genres={currentStation.tags.split(',').slice(0, 3)} 
                />
              </div>
            </>
          )}
        </div>

        {/* Footer Note */}
        <footer className="mt-16 text-center text-sm text-foreground/40 font-mono">
          <p>Press play to tune in • Switch genres to explore</p>
        </footer>
      </div>
    </div>;
};
export default Index;