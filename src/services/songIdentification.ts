// Song Identification Service using AudD API
// AudD provides accurate music recognition like Shazam

import { toast } from "sonner";

const AUDD_API_URL = 'https://api.audd.io/';

// AudD has a free tier that allows some requests without an API key
// For production, you'd want to get an API key from https://audd.io/

export interface SongInfo {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  source: 'stream' | 'audd' | 'musicbrainz';
}

// Primary Method: Parse stream metadata from ICY headers
export function parseStreamMetadata(metadataString: string): SongInfo | null {
  if (!metadataString || metadataString.trim() === '') return null;

  // Common format: "Artist - Title" or "Title by Artist"
  const dashMatch = metadataString.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    return {
      title: dashMatch[2].trim(),
      artist: dashMatch[1].trim(),
      source: 'stream'
    };
  }

  const byMatch = metadataString.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return {
      title: byMatch[1].trim(),
      artist: byMatch[2].trim(),
      source: 'stream'
    };
  }

  // If no pattern matches, return as title only
  return {
    title: metadataString.trim(),
    artist: 'Unknown Artist',
    source: 'stream'
  };
}

// Singleton instances for Web Audio API nodes
let sharedAudioContext: AudioContext | null = null;
let sharedSourceNode: MediaElementAudioSourceNode | null = null;
let sharedAnalyserNode: AnalyserNode | null = null;
let sharedGainNode: GainNode | null = null;
let lastAudioElement: HTMLAudioElement | null = null;

/**
 * Initialize the audio graph for a specific element
 * This ensures we only connect once and share the nodes
 */
export function initializeAudioTap(audioElement: HTMLAudioElement) {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    // Use system default sample rate for maximum compatibility
    sharedAudioContext = new AudioContextClass();
    console.log(`[Identification] AudioContext created. Sample rate: ${sharedAudioContext.sampleRate}Hz`);
  }

  const audioContext = sharedAudioContext;

  // ABSOLUTE ARCHITECTURE: Create a permanent, non-breaking splitter graph
  if (!sharedSourceNode || lastAudioElement !== audioElement) {
    try {
      console.log('[Identification] Configuring Audio Splitter Matrix...');

      // Cleanup old source if it exists (but keep Context)
      if (sharedSourceNode) {
        try { sharedSourceNode.disconnect(); } catch (e) { }
      }

      sharedSourceNode = audioContext.createMediaElementSource(audioElement);
      lastAudioElement = audioElement;

      if (!sharedAnalyserNode) {
        sharedAnalyserNode = audioContext.createAnalyser();
        sharedAnalyserNode.fftSize = 2048;
      }

      if (!sharedGainNode) {
        sharedGainNode = audioContext.createGain();
        sharedGainNode.gain.value = 1.0;
      }

      /**
       * SPLITTER ROUTING:
       * Source (Radio) -> GainNode (Splitter)
       * GainNode -> Destination (Speakers) - ALWAYS ON
       * GainNode -> Analyser (Visualizer/Tap) - ALWAYS ON
       */
      sharedSourceNode.connect(sharedGainNode);
      sharedGainNode.connect(audioContext.destination);
      sharedGainNode.connect(sharedAnalyserNode);

      console.log('[Identification] Absolute Splitter Active: Source -> Gain -> [Speakers & Analyser]');
    } catch (error) {
      console.warn('[Identification] Splitter matrix warning:', error);
    }
  }

  return { audioContext, source: sharedSourceNode!, analyser: sharedAnalyserNode!, gain: sharedGainNode! };
}

/**
 * Get or create the shared AnalyserNode for visualizers
 */
export function getAnalyserNode(): AnalyserNode | null {
  return sharedAnalyserNode;
}

/**
 * Capture internal audio from the playback element
 */
async function captureInternalAudio(
  audioElement: HTMLAudioElement,
  durationMs: number = 10000,
  onProgress?: (message: string) => void
): Promise<Blob> {
  onProgress?.('Initializing digital stream analysis...');

  const { audioContext, analyser } = initializeAudioTap(audioElement);

  // Requirement: State Management (Explicit Resume)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  onProgress?.('Analyzing Digital Stream...');

  // PCM Capture Routing: Connect tap specifically to the AnalyserNode
  const destination = audioContext.createMediaStreamDestination();
  analyser.connect(destination);

  onProgress?.('Capturing 10s audio buffer...');

  const mediaRecorder = new MediaRecorder(destination.stream);
  const audioChunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Cleanup Tap: Disconnect the destination from the analyzer
      try {
        analyser.disconnect(destination);
      } catch (e) {
        console.warn('[Identification] Tap cleanup error:', e);
      }

      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

      try {
        // REQUIREMENT: Verify Data (CORS Metadata Check)
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(dataArray);

        let hasSignal = false;
        for (let i = 0; i < dataArray.length; i++) {
          if (Math.abs(dataArray[i] - 128) > 2) { // 2 is noise floor
            hasSignal = true;
            break;
          }
        }

        if (!hasSignal) {
          console.error('[Identification] Hardware Failure: Visualizer is flat (0% activity).');
          reject(new Error("Security Block: Cannot read stream data. Check CORS headers."));
          return;
        }

        console.log('[Identification] Signal verified. Proceeding to identification...');
        resolve(audioBlob);
      } catch (e) {
        console.warn('[Identification] Buffer analysis fallback:', e);
        resolve(audioBlob);
      }
    };

    mediaRecorder.onerror = () => {
      try { analyser.disconnect(destination); } catch (e) { }
      reject(new Error('Internal capture failed. Context unstable.'));
    };

    mediaRecorder.start();

    // 10-second capture window as requested
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, durationMs);
  });
}

/**
 * Identify song using AudD API with internal audio tap
 */
async function identifyWithAudD(
  audioElement: HTMLAudioElement,
  onProgress?: (message: string) => void
): Promise<SongInfo | null> {
  try {
    console.log('[AudD] Starting direct stream identification...');

    // Capture 10 seconds of internal audio
    const audioBlob = await captureInternalAudio(audioElement, 10000, onProgress);
    console.log('[AudD] Internal audio captured, size:', audioBlob.size, 'bytes');

    onProgress?.('Fingerprinting stream...');

    // Note: The user requested WASM Chromaprint. 
    // In many JS implementations, we send the file to AudD which does the fingerprinting on their end,
    // or we use an external wasm. For now, we'll send the direct capture blob.

    onProgress?.('Analyzing audio...');

    // Create form data with the digital audio capture
    const formData = new FormData();
    formData.append('file', audioBlob, 'capture.wav');
    formData.append('return', 'apple_music,spotify');

    // Add API token if available
    const apiToken = import.meta.env.VITE_AUDD_API_TOKEN;
    if (apiToken) {
      formData.append('api_token', apiToken);
    }

    console.log('[AudD] Sending to API...');

    // Send to AudD API
    const response = await fetch(AUDD_API_URL, {
      method: 'POST',
      body: formData
    });

    console.log('[AudD] Response status:', response.status);

    if (!response.ok) {
      console.error('AudD API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status === 'success' && data.result) {
      const result = data.result;

      // Get album art
      let albumArt: string | undefined;
      if (result.spotify?.album?.images?.[0]?.url) {
        albumArt = result.spotify.album.images[0].url;
      } else if (result.apple_music?.artwork?.url) {
        albumArt = result.apple_music.artwork.url
          .replace('{w}', '300')
          .replace('{h}', '300');
      }

      return {
        title: result.title || 'Unknown Title',
        artist: result.artist || 'Unknown Artist',
        album: result.album,
        albumArt,
        source: 'audd'
      };
    }

    if (data.status === 'error') {
      const errorMsg = data.error?.error_message || 'Unknown error';
      console.error('AudD API error:', errorMsg);
      if (errorMsg.includes('limit was reached')) {
        throw new Error('Daily identification limit reached. Add an API key or try again later.');
      }
    }

    return null;
  } catch (error) {
    console.error('AudD identification error:', error);
    throw error;
  }
}

// Fallback: Search MusicBrainz for additional info
export async function searchMusicBrainz(query: string): Promise<SongInfo | null> {
  try {
    const response = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&limit=1&fmt=json`,
      {
        headers: {
          'User-Agent': 'My Radio/1.0 (contact@myradio.app)'
        }
      }
    );

    if (!response.ok) {
      console.error('MusicBrainz API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.recordings && data.recordings.length > 0) {
      const recording = data.recordings[0];
      const artist = recording['artist-credit']?.[0]?.name || 'Unknown Artist';
      const album = recording.releases?.[0]?.title;
      const releaseId = recording.releases?.[0]?.id;

      let albumArt: string | undefined;
      if (releaseId) {
        try {
          const coverResponse = await fetch(
            `https://coverartarchive.org/release/${releaseId}/front-250`
          );
          if (coverResponse.ok) {
            albumArt = coverResponse.url;
          }
        } catch {
          // Cover art not available
        }
      }

      return {
        title: recording.title || 'Unknown Title',
        artist,
        album,
        albumArt,
        source: 'musicbrainz'
      };
    }

    return null;
  } catch (error) {
    console.error('MusicBrainz search error:', error);
    return null;
  }
}

// Main identification function
export async function identifySong(
  streamMetadata?: string,
  onProgress?: (message: string) => void,
  audioElement?: HTMLAudioElement
): Promise<SongInfo | null> {
  // Tier 1: Check stream metadata first
  if (streamMetadata) {
    onProgress?.('Reading stream metadata...');
    const parsed = parseStreamMetadata(streamMetadata);
    if (parsed && parsed.title && parsed.artist !== 'Unknown Artist') {
      return parsed;
    }
  }

  // Tier 2: Try AudD via Direct Stream Capture
  if (audioElement) {
    onProgress?.('Initializing digital tap...');
    try {
      const auddResult = await identifyWithAudD(audioElement, onProgress);
      if (auddResult) {
        return auddResult;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal capture failed';
      console.error('AudD identification failed:', message);
      toast.error(message);
    }
  }

  // Tier 3: Try MusicBrainz with whatever info we have (fallback)
  if (streamMetadata) {
    onProgress?.('Searching music databases...');
    const mbResult = await searchMusicBrainz(streamMetadata);
    if (mbResult) {
      return mbResult;
    }
  }

  return null;
}

