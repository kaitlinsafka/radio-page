import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import { getAnalyserNode } from "@/services/songIdentification";

interface RadioPlayerProps {
  isPlaying: boolean;
  streamUrl: string;
  volume: number;
  audioRef: React.RefObject<HTMLAudioElement>;
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
  audioRef,
  onStreamError,
  onStreamReady,
  onLoadingStart,
  onLoadingEnd,
  onMetadataChange,
}: RadioPlayerProps) => {
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
        currentStreamUrlRef.current = streamUrl;
        hasConnectedRef.current = false;

        // Define the stages
        const STAGE_PROXY = 1;
        const STAGE_DIRECT_ANON = 2;
        const STAGE_DIRECT_UNRESTRICTED = 3;

        let currentStage = STAGE_PROXY;

        const attemptConnection = (stage: number) => {
          if (hasConnectedRef.current || !isPlaying) return;

          isConnectingRef.current = true;
          onLoadingStart?.();

          let finalUrl = streamUrl;

          if (stage === STAGE_PROXY) {
            audio.crossOrigin = 'anonymous';
            audio.setAttribute('crossorigin', 'anonymous');
            finalUrl = `/api/proxy?url=${encodeURIComponent(streamUrl)}`;
            console.log('[RadioPlayer] Stage 1: Attempting Proxied Anonymous connect...');
          } else if (stage === STAGE_DIRECT_ANON) {
            audio.crossOrigin = 'anonymous';
            audio.setAttribute('crossorigin', 'anonymous');
            finalUrl = streamUrl;
            console.log('[RadioPlayer] Stage 2: Attempting Direct Anonymous connect...');
          } else {
            audio.removeAttribute('crossorigin');
            audio.crossOrigin = null;
            finalUrl = streamUrl;
            console.log('[RadioPlayer] Stage 3 (Final): Attempting Unrestricted connect...');
          }

          clearConnectionTimeout();
          connectionTimeoutRef.current = window.setTimeout(() => {
            if (!hasConnectedRef.current && isConnectingRef.current) {
              console.warn(`[RadioPlayer] Stage ${stage} failed/timed out.`);

              if (stage < STAGE_DIRECT_UNRESTRICTED) {
                // Try next stage
                attemptConnection(stage + 1);
              } else {
                // All stages failed
                console.error('[RadioPlayer] All connection stages failed.');
                isConnectingRef.current = false;
                onLoadingEnd?.();
                onStreamError?.();
              }
            }
          }, 3000); // 3 seconds per stage

          audio.src = finalUrl;
          audio.load();
          audio.play().catch(e => {
            if (e.name === 'NotSupportedError' || e.name === 'SecurityError') {
              console.warn(`[RadioPlayer] Stage ${stage} playback rejected.`, e.name);
              if (stage < STAGE_DIRECT_UNRESTRICTED) {
                attemptConnection(stage + 1);
              }
            }
          });
        };

        attemptConnection(STAGE_PROXY);
      } else {
        // Just resume if URL is the same
        audio.play().catch(() => { });
      }

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

    // --- Silence Detection & Auto-Skip Logic ---
    const silenceTimeoutRef = window.setInterval(() => {
      const analyser = getAnalyserNode();
      if (!analyser || !isPlaying || !hasConnectedRef.current) return;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);

      let hasSignal = false;
      for (let i = 0; i < dataArray.length; i++) {
        // Offset 128 is the 'zero' for ByteTimeDomainData
        if (Math.abs(dataArray[i] - 128) > 2) { // 2 is noise floor threshold
          hasSignal = true;
          break;
        }
      }

      if (!hasSignal) {
        // Increment silence counter (stored in a ref outside this effect if needed, 
        // or just use a local count since setInterval is persistent)
        if (!window.hasOwnProperty('_silenceCount')) (window as any)._silenceCount = 0;
        (window as any)._silenceCount += 1;

        if ((window as any)._silenceCount >= 7) { // 7 seconds (since interval is 1s)
          console.warn('[RadioPlayer] 7s silence detected. Skipping station...');
          (window as any)._silenceCount = 0;
          onStreamError?.();
        }
      } else {
        (window as any)._silenceCount = 0;
      }
    }, 1000);

    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('playing', handlePlaying);
      window.clearInterval(silenceTimeoutRef);
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

  return <audio ref={audioRef} />;
};
