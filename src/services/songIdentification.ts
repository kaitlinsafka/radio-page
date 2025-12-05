// Song Identification Service using AudD API
// AudD provides accurate music recognition like Shazam

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

/**
 * Capture microphone audio and return as a Blob
 */
async function captureMicrophoneAudio(
  durationMs: number = 8000,
  onProgress?: (message: string) => void
): Promise<Blob> {
  onProgress?.('Requesting microphone access...');

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
      sampleRate: 44100
    }
  });

  onProgress?.(`Listening (${durationMs / 1000} seconds)...`);

  // Use MediaRecorder to capture audio
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

  const mediaRecorder = new MediaRecorder(stream, { mimeType });
  const audioChunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      resolve(audioBlob);
    };

    mediaRecorder.onerror = (event) => {
      stream.getTracks().forEach(track => track.stop());
      reject(new Error('Recording failed'));
    };

    mediaRecorder.start();

    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, durationMs);
  });
}

/**
 * Identify song using AudD API
 */
async function identifyWithAudD(
  onProgress?: (message: string) => void
): Promise<SongInfo | null> {
  try {
    console.log('[AudD] Starting identification...');

    // Capture 8 seconds of audio
    const audioBlob = await captureMicrophoneAudio(8000, onProgress);
    console.log('[AudD] Audio captured, size:', audioBlob.size, 'bytes');

    onProgress?.('Analyzing audio...');

    // Create form data with the audio
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('return', 'apple_music,spotify');

    // Add API token if available (gives you more requests)
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

      // Get album art from Spotify or Apple Music if available
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

    // If no result, try checking error
    if (data.status === 'error') {
      const errorMsg = data.error?.error_message || 'Unknown error';
      console.error('AudD API error:', errorMsg);

      // Check for rate limit error
      if (errorMsg.includes('limit was reached')) {
        throw new Error('Daily identification limit reached. Add an API key in .env or try again tomorrow.');
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
          'User-Agent': 'RadioScope/1.0 (contact@radioscope.app)'
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
  onProgress?: (message: string) => void
): Promise<SongInfo | null> {
  // Tier 1: Check stream metadata first (Primary Method)
  if (streamMetadata) {
    onProgress?.('Reading stream metadata...');
    const parsed = parseStreamMetadata(streamMetadata);
    if (parsed && parsed.title && parsed.artist !== 'Unknown Artist') {
      return parsed;
    }
  }

  // Tier 2: Try AudD via microphone (Secondary Method)
  onProgress?.('Preparing to listen...');
  try {
    const auddResult = await identifyWithAudD(onProgress);
    if (auddResult) {
      return auddResult;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Microphone access denied';
    console.error('AudD identification failed:', message);
    // Continue to fallback
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
