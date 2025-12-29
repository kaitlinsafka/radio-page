/**
 * Ad Detection Watchdog Service
 * 
 * Two-Factor automatic ad detection using:
 * 1. ICY Metadata monitoring for suspicious patterns
 * 2. Audio amplitude (RMS) analysis for loudness spikes
 */

import { getAnalyserNode } from './songIdentification';
import { smartSkipAI } from './smartSkipAIService';

// Suspicious keyword patterns (case-insensitive)
const SUSPICIOUS_KEYWORDS = [
    'commercial', 'break', 'ad ', 'ads ', 'sponsor', 'jingle', 'promo',
    'advertisement', 'brought to you', 'message from', 'word from',
    'traffic', 'weather', 'news update', 'station id'
];

// Configuration
const CONFIG = {
    POLL_INTERVAL_MS: 2000,           // Metadata check frequency
    RMS_CHECK_INTERVAL_MS: 500,       // Amplitude check frequency
    AI_CHECK_INTERVAL_MS: 15000,      // AI check frequency (normal)
    AI_SKIP_CHECK_INTERVAL_MS: 10000, // AI check frequency (skip mode)
    LOUDNESS_SPIKE_THRESHOLD: 0.20,   // 20% increase triggers flag
    LOUDNESS_SPIKE_DURATION_MS: 4000, // Must sustain for 4 seconds
    AI_CONFIDENCE_THRESHOLD: 0.85,    // 85% probability
    DEBOUNCE_MS: 2000,                // 2 second debounce
    STATIC_METADATA_TIMEOUT_MS: 180000, // 3 minutes
    MIN_CONFIDENCE_TO_SKIP: 60,       // Confidence threshold
    CONFIDENCE_DECAY_MS: 10000,       // Confidence decays over time
    PREROLL_GRACE_PERIOD_MS: 0,       // No grace period - start immediately
};

// Confidence weights
const WEIGHTS = {
    SUSPICIOUS_KEYWORD: 40,
    METADATA_MATCHES_STATION: 30,
    STATIC_METADATA: 20,
    LOUDNESS_SPIKE: 30,
    NON_STANDARD_FORMAT: 20,
    VOICE_CONTENT: 50, // High weight for voice detection
    AI_SPEECH_DETECTION: 45, // Reduced from 90 to require multiple signals or hits
};

export interface WatchdogState {
    isActive: boolean;
    confidenceScore: number;
    lastMetadata: string | null;
    metadataChangedAt: number;
    baselineRMS: number;
    currentRMS: number;
    loudnessSpikeStartedAt: number | null;
    isInAdBreak: boolean;
    startedAt: number;
    hasReceivedMetadata: boolean;
    voiceRatio: number; // Ratio of mid-freq (voice) to total energy
    baselineVoiceRatio: number; // Normal voice ratio for music
    voiceSpikeStartedAt: number | null;
    aiSpeechProb: number;
    aiMusicProb: number;
    aiSpeechHitCount: number;
    aiMusicHitCount: number;
}

export type WatchdogCallback = (event: 'AD_DETECTED' | 'AD_FINISHED', state: WatchdogState) => void;

class AdDetectionWatchdog {
    private state: WatchdogState = {
        isActive: false,
        confidenceScore: 0,
        lastMetadata: null,
        metadataChangedAt: Date.now(),
        baselineRMS: 0.1,
        currentRMS: 0,
        loudnessSpikeStartedAt: null,
        isInAdBreak: false,
        startedAt: 0,
        hasReceivedMetadata: false,
        voiceRatio: 0,
        baselineVoiceRatio: 0.3, // Typical music has ~30% mid-freq energy
        voiceSpikeStartedAt: null,
        aiSpeechProb: 0,
        aiMusicProb: 1,
        aiSpeechHitCount: 0,
        aiMusicHitCount: 0,
    };

    private metadataInterval: number | null = null;
    private rmsInterval: number | null = null;
    private aiInterval: number | null = null;
    private callback: WatchdogCallback | null = null;
    private stationName: string = '';
    private rmsHistory: number[] = [];
    private debounceTimer: number | null = null;

    /**
     * Start the watchdog monitoring
     */
    start(stationName: string, callback: WatchdogCallback) {
        if (this.state.isActive) {
            console.log('[AdWatchdog] Already running, restarting...');
            this.stop();
        }

        console.log('[AdWatchdog] Starting automatic ad detection for:', stationName);
        this.stationName = stationName;
        this.callback = callback;
        this.state.isActive = true;
        this.state.isInAdBreak = false;
        this.state.confidenceScore = 0;
        this.state.startedAt = Date.now();
        this.state.aiSpeechProb = 0;
        this.state.aiMusicProb = 1;
        this.state.aiSpeechHitCount = 0;
        this.state.aiMusicHitCount = 0;
        this.rmsHistory = []; // Reset history

        // Start metadata monitoring
        this.metadataInterval = window.setInterval(() => {
            this.checkMetadata();
        }, CONFIG.POLL_INTERVAL_MS);

        // Start RMS monitoring
        this.rmsInterval = window.setInterval(() => {
            this.checkRMS();
        }, CONFIG.RMS_CHECK_INTERVAL_MS);

        // Start AI monitoring
        this.scheduleAIInference();

        // Periodic status log for debugging
        console.log('[AdWatchdog] Watchdog intervals started. AI check every 15s.');
    }

    /**
     * Stop the watchdog
     */
    stop() {
        console.log('[AdWatchdog] Stopping ad detection');
        this.state.isActive = false;

        if (this.metadataInterval) {
            clearInterval(this.metadataInterval);
            this.metadataInterval = null;
        }
        if (this.rmsInterval) {
            clearInterval(this.rmsInterval);
            this.rmsInterval = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.aiInterval) {
            clearTimeout(this.aiInterval);
            this.aiInterval = null;
        }
    }

    /**
     * Update the current stream metadata
     */
    updateMetadata(metadata: string | null) {
        if (metadata && metadata !== this.state.lastMetadata) {
            console.log('[AdWatchdog] Metadata updated:', metadata);
            this.state.lastMetadata = metadata;
            this.state.metadataChangedAt = Date.now();
            this.state.hasReceivedMetadata = true;
        }
    }

    /**
     * Check metadata for suspicious patterns
     */
    private checkMetadata() {
        // Skip during pre-roll grace period
        const timeSinceStart = Date.now() - this.state.startedAt;
        if (timeSinceStart < CONFIG.PREROLL_GRACE_PERIOD_MS) {
            console.log(`[AdWatchdog] In grace period (${Math.ceil((CONFIG.PREROLL_GRACE_PERIOD_MS - timeSinceStart) / 1000)}s remaining)`);
            return;
        }

        // Note: Auto-return logic removed - now handled by voice detection ending

        const metadata = this.state.lastMetadata;
        let score = 0;

        // Factor 1: Check for suspicious keywords
        if (metadata) {
            const lowerMeta = metadata.toLowerCase();
            const hasKeyword = SUSPICIOUS_KEYWORDS.some(kw => lowerMeta.includes(kw));
            if (hasKeyword) {
                score += WEIGHTS.SUSPICIOUS_KEYWORD;
                console.log('[AdWatchdog] Suspicious keyword detected in:', metadata);
            }

            // Factor 2: Metadata matches station name
            if (this.stationName && lowerMeta.includes(this.stationName.toLowerCase())) {
                score += WEIGHTS.METADATA_MATCHES_STATION;
                console.log('[AdWatchdog] Metadata matches station name');
            }

            // Factor 3: Check for non-standard "Artist - Song" format
            const hasStandardFormat = /^.+\s*[-–—]\s*.+$/.test(metadata);
            if (!hasStandardFormat) {
                score += WEIGHTS.NON_STANDARD_FORMAT;
                console.log('[AdWatchdog] Non-standard metadata format:', metadata);
            }
        }

        // Factor 4: Static metadata timeout - ONLY if we've ever received metadata
        if (this.state.hasReceivedMetadata) {
            const timeSinceChange = Date.now() - this.state.metadataChangedAt;
            if (timeSinceChange > CONFIG.STATIC_METADATA_TIMEOUT_MS) {
                score += WEIGHTS.STATIC_METADATA;
                console.log('[AdWatchdog] Metadata static for', Math.floor(timeSinceChange / 60000), 'minutes');
            }
        }

        // Always log current state every 10 seconds for debugging
        if (Date.now() % 10000 < CONFIG.POLL_INTERVAL_MS) {
            console.log(`[AdWatchdog] Status: metadata="${metadata || 'null'}" confidence=${this.state.confidenceScore} inAdBreak=${this.state.isInAdBreak}`);
        }

        // Update confidence (combine with RMS score, don't replace)
        this.updateConfidence(score, 'metadata');
    }

    /**
     * Calculate RMS and Spectral Voice Ratio
     */
    private checkRMS() {
        // Skip during pre-roll grace period
        const timeSinceStart = Date.now() - this.state.startedAt;
        if (timeSinceStart < CONFIG.PREROLL_GRACE_PERIOD_MS) {
            return; // Already logged in checkMetadata
        }

        const analyser = getAnalyserNode();
        if (!analyser) {
            console.log('[AdWatchdog] No analyser node available');
            return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const binCount = dataArray.length;
        const sampleRate = analyser.context.sampleRate;
        const nyquist = sampleRate / 2;

        // Frequency band boundaries
        // Voice range: 300Hz - 3000Hz (where human speech is strongest)
        // Bass: 0-300Hz, Mids: 300-3000Hz, Highs: 3000Hz+
        const bassEndBin = Math.floor((300 / nyquist) * binCount);
        const midsEndBin = Math.floor((3000 / nyquist) * binCount);

        let bassSum = 0, midsSum = 0, highsSum = 0, totalSum = 0;

        for (let i = 0; i < binCount; i++) {
            const value = dataArray[i];
            totalSum += value;
            if (i < bassEndBin) {
                bassSum += value;
            } else if (i < midsEndBin) {
                midsSum += value;
            } else {
                highsSum += value;
            }
        }

        // Calculate voice ratio (mid-freq / total)
        const voiceRatio = totalSum > 0 ? midsSum / totalSum : 0;
        this.state.voiceRatio = voiceRatio;

        // Update baseline voice ratio using rolling average
        if (this.rmsHistory.length > 10) {
            // MUCH slower baseline adaptation - only update during likely-music periods
            // Only adapt baseline when current ratio is LOW (likely music)
            if (voiceRatio < 0.30) {
                this.state.baselineVoiceRatio = this.state.baselineVoiceRatio * 0.99 + voiceRatio * 0.01;
            }
        }

        // Calculate RMS for overall loudness
        let rmsSum = 0;
        for (let i = 0; i < binCount; i++) {
            const normalized = dataArray[i] / 255;
            rmsSum += normalized * normalized;
        }
        const rms = Math.sqrt(rmsSum / binCount);
        this.state.currentRMS = rms;

        // Maintain RMS history
        this.rmsHistory.push(rms);
        if (this.rmsHistory.length > 20) {
            this.rmsHistory.shift();
        }

        // Check for voice-heavy content (potential ad/speech)
        // RAISED threshold: 50% absolute to avoid false positives with vocal music
        const voiceThreshold = 0.50;
        const isVoiceHeavy = voiceRatio > voiceThreshold;

        // Log spectral values periodically
        if (Date.now() % 5000 < CONFIG.RMS_CHECK_INTERVAL_MS) {
            console.log(`[AdWatchdog] 🎵 Voice: ${(voiceRatio * 100).toFixed(1)}% | Baseline: ${(this.state.baselineVoiceRatio * 100).toFixed(1)}% | Threshold: ${(voiceThreshold * 100).toFixed(1)}% | VoiceHeavy: ${isVoiceHeavy}`);
            console.log(`[AdWatchdog] 📊 Bass: ${(bassSum / totalSum * 100).toFixed(0)}% | Mids: ${(midsSum / totalSum * 100).toFixed(0)}% | Highs: ${(highsSum / totalSum * 100).toFixed(0)}%`);
        }

        let score = 0;

        // Voice detection scoring with tolerance for fluctuation
        if (isVoiceHeavy) {
            if (!this.state.voiceSpikeStartedAt) {
                this.state.voiceSpikeStartedAt = Date.now();
                console.log('[AdWatchdog] 🗣️ Voice-heavy content detected! Ratio:', (voiceRatio * 100).toFixed(1) + '%');
            }

            const voiceDuration = Date.now() - this.state.voiceSpikeStartedAt;
            if (voiceDuration >= 1500) { // Reduced to 1.5 seconds for faster response
                score = WEIGHTS.VOICE_CONTENT;
                console.log('[AdWatchdog] 🚨 Sustained voice content! Duration:', Math.floor(voiceDuration / 1000), 's, Score:', score);
            }
        } else {
            // Add tolerance: only reset if voice has been low for a while
            if (this.state.voiceSpikeStartedAt) {
                const timeSinceDetection = Date.now() - this.state.voiceSpikeStartedAt;
                // Keep the spike alive for 2 more seconds to handle fluctuations
                if (timeSinceDetection > 5000) {
                    console.log('[AdWatchdog] 🎵 Voice content ended - back to music');
                    this.state.voiceSpikeStartedAt = null;
                }
            }
        }

        this.updateConfidence(score, 'rms');
    }

    /**
     * Update confidence score and potentially trigger events
     */
    private updateConfidence(additionalScore: number, source: 'metadata' | 'rms') {
        // Combine scores (prevent double-counting within same check cycle)
        if (source === 'metadata') {
            // Decay confidence more aggressively to prevent slow buildup
            this.state.confidenceScore = Math.max(0, this.state.confidenceScore * 0.7);
        }
        this.state.confidenceScore = Math.min(100, this.state.confidenceScore + additionalScore);

        // Log confidence changes
        if (additionalScore > 0) {
            console.log(`[AdWatchdog] Confidence: ${this.state.confidenceScore} (+${additionalScore} from ${source})`);
        }

        // Check if we should trigger AD_DETECTED
        if (!this.state.isInAdBreak && this.state.confidenceScore >= CONFIG.MIN_CONFIDENCE_TO_SKIP) {
            this.triggerAdDetected();
        }

        // Check if we should trigger AD_FINISHED
        if (this.state.isInAdBreak && this.state.confidenceScore < 20) {
            this.triggerAdFinished();
        }
    }

    /**
     * Trigger AD_DETECTED with debounce
     */
    private triggerAdDetected() {
        if (this.debounceTimer) return; // Already debouncing

        this.debounceTimer = window.setTimeout(() => {
            // Re-check confidence after debounce
            if (this.state.confidenceScore >= CONFIG.MIN_CONFIDENCE_TO_SKIP) {
                console.log('[AdWatchdog] 🚨 AD_DETECTED triggered! Confidence:', this.state.confidenceScore);
                this.state.isInAdBreak = true;
                this.callback?.('AD_DETECTED', { ...this.state });
            }
            this.debounceTimer = null;
        }, CONFIG.DEBOUNCE_MS);
    }

    /**
     * Trigger AD_FINISHED
     */
    private triggerAdFinished() {
        console.log('[AdWatchdog] ✅ AD_FINISHED triggered! Music resumed.');
        this.state.isInAdBreak = false;
        this.state.confidenceScore = 0;
        this.callback?.('AD_FINISHED', { ...this.state });
    }

    /**
     * Schedule next AI inference call
     */
    private scheduleAIInference() {
        if (!this.state.isActive) return;

        const interval = this.state.isInAdBreak
            ? CONFIG.AI_SKIP_CHECK_INTERVAL_MS
            : CONFIG.AI_CHECK_INTERVAL_MS;

        if (this.aiInterval) clearTimeout(this.aiInterval);

        this.aiInterval = window.setTimeout(async () => {
            await this.runAIInference();
            this.scheduleAIInference();
        }, interval);
    }

    /**
     * Run AI inference on a 2-second capture
     */
    private async runAIInference() {
        if (!this.state.isActive) return;

        console.log('[AdWatchdog] 🤖 Running AI inference...');

        try {
            const buffer = await this.captureBuffer(2000);
            if (!buffer) return;

            const analyser = getAnalyserNode();
            const results = await smartSkipAI.classify(buffer, analyser?.context.sampleRate || 44100);

            this.state.aiSpeechProb = results.speech;
            this.state.aiMusicProb = results.music;

            // Decision Logic: Speech-vs-Music Ratio
            const isSpeech = results.speech > CONFIG.AI_CONFIDENCE_THRESHOLD && results.speech > results.music * 1.5;
            const isMusic = results.music > CONFIG.AI_CONFIDENCE_THRESHOLD;

            console.log(`[AdWatchdog] 🤖 AI Scan: Speech=${(results.speech * 100).toFixed(1)}% | Music=${(results.music * 100).toFixed(1)}% | Decision: ${isSpeech ? 'SPEECH' : isMusic ? 'MUSIC' : 'UNCERTAIN'}`);

            if (isSpeech) {
                this.state.aiSpeechHitCount++;
                this.state.aiMusicHitCount = 0;

                // Requirement: 2 consecutive hits OR high confidence + other signals
                if (this.state.aiSpeechHitCount >= 2) {
                    console.log('[AdWatchdog] 🚨 AI confirmed SPEECH (2 consecutive hits)');
                    this.updateConfidence(WEIGHTS.AI_SPEECH_DETECTION, 'rms');
                } else {
                    console.log('[AdWatchdog] 🤖 AI detected SPEECH (hit 1/2), waiting for confirmation...');
                    // Add a small confidence boost for the first hit
                    this.updateConfidence(20, 'rms');
                }
            } else if (isMusic) {
                this.state.aiMusicHitCount++;
                this.state.aiSpeechHitCount = 0;

                if (this.state.isInAdBreak && this.state.aiMusicHitCount >= 2) {
                    console.log('[AdWatchdog] ✅ AI confirmed MUSIC (2 consecutive hits)');
                    this.state.confidenceScore = 0;
                    this.triggerAdFinished();
                } else if (this.state.isInAdBreak) {
                    console.log('[AdWatchdog] 🤖 AI detected MUSIC (hit 1/2), waiting for confirmation...');
                }
            } else {
                // Reset counters on uncertain result to ensure "consecutive" means what it says
                this.state.aiSpeechHitCount = 0;
                this.state.aiMusicHitCount = 0;
            }
        } catch (error) {
            console.error('[AdWatchdog] 🤖 AI inference failed:', error);
        }
    }

    /**
     * Capture audio buffer for AI
     */
    private async captureBuffer(durationMs: number): Promise<Float32Array | null> {
        const analyser = getAnalyserNode();
        if (!analyser) return null;

        const ctx = analyser.context as AudioContext;
        let destination: MediaStreamAudioDestinationNode | null = null;
        let mediaRecorder: MediaRecorder | null = null;
        let timeoutId: number | null = null;

        return new Promise((resolve) => {
            try {
                destination = ctx.createMediaStreamDestination();
                analyser.connect(destination);

                mediaRecorder = new MediaRecorder(destination.stream);
                const chunks: Blob[] = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                mediaRecorder.onerror = (e) => {
                    console.error('[AdWatchdog] MediaRecorder error:', e);
                    cleanup();
                    resolve(null);
                };

                mediaRecorder.onstop = async () => {
                    try {
                        if (chunks.length === 0) {
                            resolve(null);
                            return;
                        }
                        const blob = new Blob(chunks, { type: 'audio/wav' });
                        const arrayBuffer = await blob.arrayBuffer();
                        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                        resolve(audioBuffer.getChannelData(0));
                    } catch (e) {
                        console.warn('[AdWatchdog] Capture buffer decode failed:', e);
                        resolve(null);
                    } finally {
                        cleanup();
                    }
                };

                const cleanup = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (analyser && destination) {
                        try { analyser.disconnect(destination); } catch (e) { }
                    }
                };

                mediaRecorder.start();

                timeoutId = window.setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state === 'recording') {
                        try { mediaRecorder.stop(); } catch (e) { resolve(null); }
                    }
                }, durationMs);

            } catch (error) {
                console.error('[AdWatchdog] Failed to start MediaRecorder:', error);
                if (analyser && destination) {
                    try { analyser.disconnect(destination); } catch (e) { }
                }
                resolve(null);
            }
        });
    }

    /**
     * Get current state for debugging
     */
    getState(): WatchdogState {
        return { ...this.state };
    }
}

// Singleton instance
export const adWatchdog = new AdDetectionWatchdog();
