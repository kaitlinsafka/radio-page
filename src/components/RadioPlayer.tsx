import { useEffect, useRef, useCallback } from "react";

interface RadioPlayerProps {
  isPlaying: boolean;
  streamUrl: string;
  volume: number;
  onStreamError?: () => void;
  onStreamReady?: () => void;
  onMetadataChange?: (metadata: string | null) => void;
  onLoadingStart?: () => void;
  onLoadingEnd?: () => void;
}

// Connection timeout in milliseconds (5 seconds)
const CONNECTION_TIMEOUT_MS = 5000;

export const RadioPlayer = ({
  isPlaying,
  streamUrl,
  volume,
  onStreamError,
  onStreamReady,
  onLoadingStart,
  onLoadingEnd,
  onMetadataChange,
}: RadioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const metadataIntervalRef = useRef<number | null>(null);
  const connectionTimeoutRef = useRef<number | null>(null);
  const isConnectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const currentStreamUrlRef = useRef<string>('');

  // Clear connection timeout
  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  // Try to extract metadata from the audio element
  const checkMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Check for media session metadata (set by some streams)
    if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
      const meta = navigator.mediaSession.metadata;
      if (meta.title || meta.artist) {
        const metaString = meta.artist ? `${meta.artist} - ${meta.title}` : meta.title;
        onMetadataChange?.(metaString);
        return;
      }
    }

    // For audio elements, we can't directly read ICY metadata due to browser limitations
    // Instead, we signal that no metadata is available so the UI shows the Identify button
    onMetadataChange?.(null);
  }, [onMetadataChange]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Handle play/pause and stream URL changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Handle successful connection
    const handleCanPlay = () => {
      console.log('Stream ready:', streamUrl);
      clearConnectionTimeout();
      isConnectingRef.current = false;
      hasConnectedRef.current = true;
      onLoadingEnd?.();
      onStreamReady?.();
      checkMetadata();
    };

    // Handle stream errors
    const handleError = (e: Event) => {
      console.error('Stream error for URL:', streamUrl, e);
      if (!hasConnectedRef.current && !connectionTimeoutRef.current) {
        clearConnectionTimeout();
        isConnectingRef.current = false;
        onLoadingEnd?.();
        onStreamError?.();
      }
    };

    // Handle stream stalled
    const handleStalled = () => {
      console.warn('Stream stalled:', streamUrl);
    };

    const handleLoadedMetadata = () => {
      checkMetadata();
    };

    // Handle playing event (stream is definitely working)
    const handlePlaying = () => {
      console.log('Stream playing:', streamUrl);
      clearConnectionTimeout();
      isConnectingRef.current = false;
      hasConnectedRef.current = true;
      onLoadingEnd?.();
    };

    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('playing', handlePlaying);

    // Only change stream if URL changed or play state changed
    if (isPlaying && streamUrl) {
      // Check if we need to load a new stream
      if (currentStreamUrlRef.current !== streamUrl) {
        // New stream URL - load it
        currentStreamUrlRef.current = streamUrl;
        hasConnectedRef.current = false;
        isConnectingRef.current = true;

        onLoadingStart?.();

        clearConnectionTimeout();
        connectionTimeoutRef.current = window.setTimeout(() => {
          if (!hasConnectedRef.current && isConnectingRef.current) {
            console.log('Connection timeout reached for:', streamUrl);
            isConnectingRef.current = false;
            onLoadingEnd?.();
            onStreamError?.();
          }
        }, CONNECTION_TIMEOUT_MS);

        audio.src = streamUrl;
        audio.load();
      }

      // Always try to play
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
      });

      // Start metadata check interval if not already running
      if (!metadataIntervalRef.current) {
        metadataIntervalRef.current = window.setInterval(checkMetadata, 10000);
      }
    } else {
      // Stop playback
      clearConnectionTimeout();
      isConnectingRef.current = false;
      audio.pause();
      onLoadingEnd?.();

      if (metadataIntervalRef.current) {
        clearInterval(metadataIntervalRef.current);
        metadataIntervalRef.current = null;
      }
    }

    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('playing', handlePlaying);
    };
  }, [isPlaying, streamUrl, onStreamError, onStreamReady, onLoadingStart, onLoadingEnd, checkMetadata, clearConnectionTimeout]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      clearConnectionTimeout();
      if (metadataIntervalRef.current) {
        clearInterval(metadataIntervalRef.current);
      }
    };
  }, [clearConnectionTimeout]);

  return <audio ref={audioRef} crossOrigin="anonymous" />;
};
