import { useState } from "react";
import { Mic, Music2, Disc3, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { identifySong, type SongInfo } from "@/services/songIdentification";
import { toast } from "sonner";

interface NowPlayingProps {
  streamMetadata: string | null;
  isPlaying: boolean;
  stationName: string;
}

export const NowPlaying = ({ streamMetadata, isPlaying, stationName }: NowPlayingProps) => {
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifiedSong, setIdentifiedSong] = useState<SongInfo | null>(null);
  const [identifyProgress, setIdentifyProgress] = useState<string>('');

  const handleIdentifySong = async () => {
    if (!isPlaying) {
      toast.error("Play a station first to identify the song");
      return;
    }

    setIsIdentifying(true);
    setIdentifiedSong(null);

    try {
      // Pass undefined to skip stream metadata parsing and go straight to microphone identification
      const result = await identifySong(undefined, (progress) => {
        setIdentifyProgress(progress);
      });

      if (result) {
        setIdentifiedSong(result);
        toast.success(`Found: ${result.artist} - ${result.title}`);
      } else {
        toast.info("Couldn't identify the song. Try again with clearer audio.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to identify song';
      toast.error(message);
    } finally {
      setIsIdentifying(false);
      setIdentifyProgress('');
    }
  };

  // If we have stream metadata, show it in a retro digital display style
  if (streamMetadata && !identifiedSong) {
    const parts = streamMetadata.split(' - ');
    const artist = parts.length > 1 ? parts[0] : 'Unknown Artist';
    const title = parts.length > 1 ? parts.slice(1).join(' - ') : streamMetadata;

    return (
      <div className="flex items-center justify-center gap-3 bg-[#331F21] text-[#E9EFE4] rounded-md px-4 py-2 mb-4 font-mono text-sm border-2 border-[#E0CDCE] shadow-inner max-w-md mx-auto w-full">
        <div className="flex-1 min-w-0 text-center">
          <p className="font-bold truncate animate-pulse">{title}</p>
          <p className="text-xs opacity-70 truncate">{artist}</p>
        </div>
      </div>
    );
  }

  // If we identified a song, show it like a ticket stub
  if (identifiedSong) {
    return (
      <div className="flex items-center gap-3 bg-[#E0CDCE] border-2 border-[#331F21] rounded-lg p-3 mb-4 shadow-[4px_4px_0_#331F21] max-w-md mx-auto w-full relative group">
        {identifiedSong.albumArt ? (
          <img
            src={identifiedSong.albumArt}
            alt="Album art"
            className="w-12 h-12 rounded border border-[#331F21] object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded border border-[#331F21] bg-[#F9F9FB] flex items-center justify-center">
            <Music2 className="w-6 h-6 text-[#331F21]" />
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold text-[#331F21] truncate">{identifiedSong.title}</p>
          <p className="text-xs text-[#331F21]/80 truncate">{identifiedSong.artist}</p>
          {identifiedSong.album && (
            <p className="text-[10px] text-[#331F21]/60 truncate">{identifiedSong.album}</p>
          )}
        </div>
        <button
          onClick={() => setIdentifiedSong(null)}
          className="absolute -top-2 -right-2 bg-[#331F21] text-[#F9F9FB] rounded-full p-1 hover:scale-110 transition-transform"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // No metadata - show Identify button
  return (
    <div className="flex justify-center w-full">
      {isIdentifying ? (
        <div className="flex items-center gap-2 bg-[#F9F9FB] border-2 border-[#331F21] rounded-full px-6 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#331F21]" />
          <span className="text-sm font-bold text-[#331F21]">{identifyProgress || 'Identifying...'}</span>
        </div>
      ) : (
        <button
          onClick={handleIdentifySong}
          disabled={!isPlaying}
          className="flex items-center gap-2 border-2 border-[#331F21] rounded-full px-6 py-2 bg-[#F9F9FB] hover:bg-[#E0CDCE] text-[#331F21] font-bold text-sm transition-all shadow-[2px_2px_0_#331F21] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
        >
          <Mic className="w-4 h-4" />
          What Song Is That?
        </button>
      )}
    </div>
  );
};
