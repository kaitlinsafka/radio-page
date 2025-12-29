import { useState, useRef, useEffect } from "react";
import { Mic, Music2, Disc3, Loader2, X, Play, Pause, ExternalLink, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { identifySong, getAnalyserNode, type SongInfo } from "@/services/songIdentification";
import { toast } from "sonner";

/**
 * Small canvas-based visualizer for song identification
 */
export const WaveformVisualizer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationRef: number;
    let isActive = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startDraw = async () => {
      if (!isActive) return;

      const analyser = getAnalyserNode();
      if (!analyser) {
        // If analyser isn't ready, wait and try again
        animationRef = requestAnimationFrame(startDraw);
        return;
      }

      // Requirement: Resume Context check inside the loop/init
      const audioCtx = analyser.context as AudioContext;
      if (audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch (e) {
          console.warn('[Visualizer] Context resume failed:', e);
        }
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Use a persistent array for smoothed values to slow down movement
      const smoothedData = new Float32Array(16); // 16 discrete retro bars
      const SMOOTHING_FACTOR = 0.15; // Lower = slower/smoother

      const draw = () => {
        if (!isActive) return;
        animationRef = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#F9F9FB';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = 4;
        const gap = 2;
        const barCount = 16;
        const totalWidth = (barWidth + gap) * barCount;
        const startX = (canvas.width - totalWidth) / 2;

        ctx.fillStyle = '#331F21';

        for (let i = 0; i < barCount; i++) {
          // Average multiple frequency bins for each bar
          const binStart = Math.floor(i * (bufferLength / 2 / barCount));
          const binEnd = Math.floor((i + 1) * (bufferLength / 2 / barCount));
          let sum = 0;
          for (let j = binStart; j < binEnd; j++) {
            sum += dataArray[j];
          }
          const average = sum / (binEnd - binStart);

          // Apply smoothing logic
          const targetH = (average / 255) * canvas.height * 0.4; // Max half height
          smoothedData[i] += (targetH - smoothedData[i]) * SMOOTHING_FACTOR;

          const x = startX + i * (barWidth + gap);
          const y = canvas.height / 2;

          // Draw symmetrical pulsing bar from center with rounded caps
          const finalH = Math.max(2, smoothedData[i]);

          ctx.beginPath();
          ctx.lineWidth = barWidth;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#331F21';
          ctx.moveTo(x + barWidth / 2, y - finalH);
          ctx.lineTo(x + barWidth / 2, y + finalH);
          ctx.stroke();
        }
      };

      draw();
    };

    startDraw();

    return () => {
      isActive = false;
      if (animationRef) {
        cancelAnimationFrame(animationRef);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={100}
      height={32}
      className="opacity-90"
      title="Digital Audio Tap Active"
    />
  );
};

interface NowPlayingProps {
  streamMetadata: string | null;
  isPlaying: boolean;
  stationName: string;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export const NowPlaying = ({ streamMetadata, isPlaying, stationName, audioRef }: NowPlayingProps) => {
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
      // Pass audioRef to skip microphone and use internal capture
      const result = await identifySong(undefined, (progress) => {
        setIdentifyProgress(progress);
      }, audioRef.current || undefined);

      if (result) {
        setIdentifiedSong(result);
        toast.success(`Song identified: ${result.title} by ${result.artist}`);
      } else {
        toast.error("Could not identify the song. The stream might be in a commercial break or no match was found.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Identification failed";
      console.error("Identification error:", message);
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
        <div className="flex items-center gap-4 bg-[#F9F9FB] border-2 border-[#331F21] rounded-full py-2 pl-8 pr-2 shadow-[6px_6px_0_#331F21] max-w-sm mx-auto h-[72px]">
          <div className="whitespace-nowrap">
            <span className="text-base font-bold text-[#331F21] tracking-tight">
              {identifyProgress?.includes('Analyzing') ? 'Analyzing...' : 'Listening...'}
            </span>
          </div>

          <div className="h-full bg-white border-2 border-[#331F21] rounded-full px-6 flex items-center justify-center min-w-[140px]">
            <WaveformVisualizer />
          </div>

          {identifyProgress && !identifyProgress.includes('Analyzing') && !identifyProgress.includes('Listening') && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-[10px] uppercase font-bold text-[#331F21]/40">
                {identifyProgress}
              </span>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleIdentifySong}
          disabled={!isPlaying}
          className="flex items-center gap-2 border-2 border-[#331F21] rounded-full px-6 py-2 bg-[#F9F9FB] hover:bg-[#E0CDCE] text-[#331F21] font-bold text-sm transition-all shadow-[2px_2px_0_#331F21] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
        >
          <Music2 className="w-4 h-4" />
          What Song Is That?
        </button>
      )}
    </div>
  );
};
