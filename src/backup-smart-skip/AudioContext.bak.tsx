import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { RadioStation } from '@/services/radioBrowserApi';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getAnalyserNode, initializeAudioTap } from "@/services/songIdentification";
import { adWatchdog } from '@/services/adDetectionService';

export interface RadioState {
    station: RadioStation | null;
    isPlaying: boolean;
    streamMetadata: string | null;
    stations: RadioStation[];
    currentStationIndex: number;
}

interface AudioContextType {
    // Shared / Sink State
    volume: number;
    loading: boolean;
    isConnecting: boolean;
    activeMode: 'home' | 'explore';

    // Mode States
    homeRadio: RadioState;
    exploreRadio: RadioState;

    // Active Radio Values (Sink Pointers)
    currentStation: RadioStation | null;
    isPlaying: boolean;
    streamMetadata: string | null;
    stations: RadioStation[];
    currentStationIndex: number;

    // Controls
    playStation: (station: RadioStation, mode?: 'home' | 'explore') => void;
    togglePlay: (mode?: 'home' | 'explore') => void;
    nextStation: (mode?: 'home' | 'explore') => void;
    prevStation: (mode?: 'home' | 'explore') => void;
    setStations: (stations: RadioStation[], mode?: 'home' | 'explore') => void;
    handleStreamError: () => void;
    setVolume: (volume: number) => void;

    // Smart Skip
    smartSkipEnabled: boolean;
    setSmartSkipEnabled: (enabled: boolean) => void;
    isAdSkipping: boolean;
    adSignalStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
    backupStation: RadioStation | null;

    // Audio Element Reference (for song identification)
    audioRef: React.RefObject<HTMLAudioElement>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Mode State
    const [activeMode, setActiveMode] = useState<'home' | 'explore'>('home');

    // Home Radio State
    const [homeRadio, setHomeRadio] = useState<RadioState>(() => {
        const saved = localStorage.getItem('selectedStation');
        return {
            station: saved ? JSON.parse(saved) : null,
            isPlaying: false,
            streamMetadata: null,
            stations: [],
            currentStationIndex: 0
        };
    });

    // Explore Radio State
    const [exploreRadio, setExploreRadio] = useState<RadioState>({
        station: null,
        isPlaying: false,
        streamMetadata: null,
        stations: [],
        currentStationIndex: 0
    });

    const [volume, setVolume] = useState(75);
    const [isConnecting, setIsConnecting] = useState(false);

    // Smart Skip State
    const [smartSkipEnabled, setSmartSkipEnabled] = useState(() => {
        const saved = localStorage.getItem('smartSkipEnabled');
        console.log('[AudioContext] Initial smartSkipEnabled from storage:', saved);
        return saved === 'true';
    });
    const [isAdSkipping, setIsAdSkipping] = useState(false);
    const [backupStation, setBackupStation] = useState<RadioStation | null>(null);
    const [adSignalStatus, setAdSignalStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('DISCONNECTED');

    // Functional Setters with LocalStorage sync for visual components
    const setAdSkippingWithSync = (val: boolean) => {
        setIsAdSkipping(val);
        isAdSkippingRef.current = val; // Update ref immediately for intervals
        localStorage.setItem('isAdSkipping', String(val));
    };

    // Pointer to active/audible radio
    const activeRadio = activeMode === 'home' ? homeRadio : exploreRadio;
    const { station: currentStation, isPlaying, streamMetadata, stations, currentStationIndex } = activeRadio;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const backupAudioRef = useRef<HTMLAudioElement | null>(null);
    const location = useLocation();

    const metadataIntervalRef = useRef<number | null>(null);
    const connectionTimeoutRef = useRef<number | null>(null);
    const hasConnectedRef = useRef(false);
    const currentStreamUrlRef = useRef<string>('');
    const crossfadeLockRef = useRef(false);

    // Refs for Realtime Listener Stability
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;
    const isAdSkippingRef = useRef(isAdSkipping);
    isAdSkippingRef.current = isAdSkipping;
    const stationsRef = useRef(stations);
    stationsRef.current = stations;
    const currentStationRef = useRef(currentStation);
    currentStationRef.current = currentStation;
    const backupStationRef = useRef(backupStation);
    backupStationRef.current = backupStation;

    const clearConnectionTimeout = useCallback(() => {
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }
    }, []);

    const checkMetadata = useCallback(() => {
        if (!audioRef.current) return;
        if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
            const meta = navigator.mediaSession.metadata;
            if (meta.title || meta.artist) {
                const metaString = meta.artist ? `${meta.artist} - ${meta.title} ` : meta.title;
                if (activeMode === 'home') {
                    setHomeRadio(prev => ({ ...prev, streamMetadata: metaString }));
                } else {
                    setExploreRadio(prev => ({ ...prev, streamMetadata: metaString }));
                }
                return;
            }
        }
        if (activeMode === 'home') {
            setHomeRadio(prev => ({ ...prev, streamMetadata: null }));
        } else {
            setExploreRadio(prev => ({ ...prev, streamMetadata: null }));
        }
    }, [activeMode]);

    // Helpers for hooks to update active state
    const setIsPlayingActive = useCallback((val: boolean) => {
        if (activeMode === 'home') {
            setHomeRadio(prev => ({ ...prev, isPlaying: val }));
        } else {
            setExploreRadio(prev => ({ ...prev, isPlaying: val }));
        }
    }, [activeMode]);

    const setStationIndexActive = useCallback((idx: number) => {
        if (activeMode === 'home') {
            setHomeRadio(prev => ({ ...prev, currentStationIndex: idx }));
        } else {
            setExploreRadio(prev => ({ ...prev, currentStationIndex: idx }));
        }
    }, [activeMode]);

    // Initialize Audio Object Once
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.volume = volume / 100;
        }

        const audio = audioRef.current;

        const handleCanPlay = () => {
            console.log('[AudioContext] Stream ready');
            clearConnectionTimeout();
            setIsConnecting(false);
            hasConnectedRef.current = true;
            checkMetadata();
        };

        const handlePlaying = () => {
            console.log('[AudioContext] Stream playing');
            clearConnectionTimeout();
            setIsConnecting(false);
            hasConnectedRef.current = true;
        };

        const handleError = (e: Event) => {
            console.error('[AudioContext] Stream error:', e);
            if (!hasConnectedRef.current && !connectionTimeoutRef.current) {
                clearConnectionTimeout();
                setIsConnecting(false);
            }
        };

        const handleLoadedMetadata = () => checkMetadata();

        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('playing', handlePlaying);
        audio.addEventListener('error', handleError);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);

        return () => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('playing', handlePlaying);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
    }, [checkMetadata, clearConnectionTimeout, volume]);

    // Initialize Backup Audio Object
    useEffect(() => {
        if (!backupAudioRef.current) {
            backupAudioRef.current = new Audio();
            backupAudioRef.current.volume = 0; // Starts silent
        }
    }, []);

    const crossFade = useCallback(async (toBackup: boolean) => {
        console.log(`[AudioContext] crossFade execution. toBackup: ${toBackup}, backupStation: ${backupStation?.name}, isPlaying: ${isPlayingRef.current}`);
        const primary = audioRef.current;
        const backup = backupAudioRef.current;
        if (!primary || !backup) return;

        if (crossfadeLockRef.current) {
            console.log('[AudioContext] Crossfade already in progress, skipping...');
            return;
        }

        crossfadeLockRef.current = true;

        try {
            // Use a function to get current volume to avoid dependency
            const getVol = () => (window as any)._audioVolume || 75;
            const targetVolume = getVol() / 100;

            const duration = 1500; // 1.5s crossfade
            const steps = 30;
            const interval = duration / steps;

            if (toBackup) {
                if (backupStation) {
                    backup.src = backupStation.url_resolved;
                    // Always try to play backup when switching to it
                    backup.play().catch(() => { });

                    for (let i = 0; i <= steps; i++) {
                        const ratio = i / steps;
                        primary.volume = targetVolume * (1 - ratio);
                        backup.volume = targetVolume * ratio;
                        await new Promise(r => setTimeout(r, interval));
                        // Check if ad skip was cancelled mid-fade
                        if (!isAdSkippingRef.current) break;
                    }

                    // Do NOT pause primary if smart skip is enabled, as we need to monitor it
                    if (!smartSkipEnabled) {
                        primary.pause();
                    }

                    // Ensure final state
                    backup.volume = targetVolume;
                    primary.volume = 0;
                    console.log('[AudioContext] crossFade complete: Now playing backup (Primary silent/monitoring)');
                }
            } else {
                // Resume primary
                primary.play().catch(() => { });

                for (let i = 0; i <= steps; i++) {
                    const ratio = i / steps;
                    backup.volume = targetVolume * (1 - ratio);
                    primary.volume = targetVolume * ratio;
                    await new Promise(r => setTimeout(r, interval));
                    // Check if ad skip was re-triggered mid-fade
                    if (isAdSkippingRef.current) break;
                }
                backup.pause();
                backup.src = '';
                // Ensure final state
                primary.volume = targetVolume;
                backup.volume = 0;
                console.log('[AudioContext] crossFade complete: Now playing primary');
            }
        } catch (error) {
            console.error('[AudioContext] Crossfade error:', error);
        } finally {
            crossfadeLockRef.current = false;
        }
    }, [backupStation, smartSkipEnabled]);

    // Realtime Signals
    useEffect(() => {
        if (!smartSkipEnabled) {
            if (isAdSkipping) {
                console.log('[AudioContext] Smart Skip disabled during active skip. Returning to primary.');
                setAdSkippingWithSync(false);
            }
            return;
        }

        console.log('[AudioContext] Initializing stable ad-signals channel...');
        const channel = supabase.channel('ad-signals');

        channel
            .on('broadcast', { event: 'AD_DETECTED' }, (payload) => {
                console.log('[AudioContext] AD_DETECTED signal received:', payload);
                if (!isPlayingRef.current) return;

                console.log('[AudioContext] Initiating backup search...');
                const currentStations = stationsRef.current;
                const otherStations = currentStations.filter(s => {
                    const isOriginal = s.stationuuid === currentStationRef.current?.stationuuid;
                    const isCurrentBackup = s.stationuuid === backupStationRef.current?.stationuuid;
                    const tags = (s.tags || '').toLowerCase();
                    const isExcluded = tags.includes('talk') || tags.includes('news') || tags.includes('speech') ||
                        tags.includes('christian') || tags.includes('religious') || tags.includes('gospel') ||
                        tags.includes('church') || tags.includes('prayer');
                    return !isOriginal && !isCurrentBackup && !isExcluded;
                });

                if (otherStations.length > 0) {
                    const random = otherStations[Math.floor(Math.random() * otherStations.length)];
                    console.log('[AudioContext] Switching to backup station:', random.name);
                    setBackupStation(random);
                    if (!isAdSkippingRef.current) {
                        setAdSkippingWithSync(true);
                    }
                } else {
                    console.warn('[AudioContext] No suitable backup stations available!');
                }
            })
            .on('broadcast', { event: 'AD_FINISHED' }, (payload) => {
                console.log('[AudioContext] AD_FINISHED signal received:', payload);
                if (isAdSkippingRef.current) {
                    console.log('[AudioContext] Ending ad skip...');
                    setAdSkippingWithSync(false);
                }
            })
            .subscribe((status) => {
                console.log('[AudioContext] Ad-signals channel status:', status);
                if (status === 'SUBSCRIBED') setAdSignalStatus('CONNECTED');
                else if (status === 'CLOSED') setAdSignalStatus('DISCONNECTED');
                else setAdSignalStatus('ERROR');
            });

        return () => {
            console.log('[AudioContext] Tearing down stable ad-signals channel');
            supabase.removeChannel(channel);
        };
    }, [smartSkipEnabled]); // Only re-run if toggle changes

    // Automatic Ad Detection Watchdog
    useEffect(() => {
        if (!smartSkipEnabled || !isPlaying || !currentStation) {
            adWatchdog.stop();
            return;
        }

        // Start the watchdog with current station name
        adWatchdog.start(currentStation.name, (event, state) => {
            console.log(`[AudioContext] Watchdog event: ${event}`, state);

            if (event === 'AD_DETECTED') {
                // Same logic as manual signal - find backup station
                const currentStations = stationsRef.current;
                const otherStations = currentStations.filter(s => {
                    const isOriginal = s.stationuuid === currentStationRef.current?.stationuuid;
                    const isCurrentBackup = s.stationuuid === backupStationRef.current?.stationuuid;
                    const tags = (s.tags || '').toLowerCase();
                    const isExcluded = tags.includes('talk') || tags.includes('news') || tags.includes('speech') ||
                        tags.includes('christian') || tags.includes('religious') || tags.includes('gospel') ||
                        tags.includes('church') || tags.includes('prayer');
                    return !isOriginal && !isCurrentBackup && !isExcluded;
                });

                if (otherStations.length > 0) {
                    const random = otherStations[Math.floor(Math.random() * otherStations.length)];
                    console.log('[AudioContext] Watchdog: Switching to backup station:', random.name);
                    setBackupStation(random);
                    if (!isAdSkippingRef.current) {
                        setAdSkippingWithSync(true);
                        toast.info('Ad detected! Switching to music...', { duration: 2000 });
                    }
                }
            } else if (event === 'AD_FINISHED') {
                if (isAdSkippingRef.current) {
                    console.log('[AudioContext] Watchdog: Ad finished, returning to primary');
                    setAdSkippingWithSync(false);
                    toast.success('Music resumed!', { duration: 2000 });
                }
            }
        });

        return () => {
            adWatchdog.stop();
        };
    }, [smartSkipEnabled, isPlaying, currentStation]);

    // Feed metadata to watchdog
    useEffect(() => {
        if (smartSkipEnabled && streamMetadata) {
            adWatchdog.updateMetadata(streamMetadata);
        }
    }, [smartSkipEnabled, streamMetadata]);

    // Handle Skip Transition
    useEffect(() => {
        if (smartSkipEnabled) {
            crossFade(isAdSkipping);
        }
    }, [isAdSkipping, smartSkipEnabled, backupStation, crossFade]);

    const attemptConnection = useCallback((stage: number, streamUrl: string) => {
        const audio = audioRef.current;
        if (!audio || hasConnectedRef.current || !isPlaying) return;

        setIsConnecting(true);
        let finalUrl = streamUrl;

        const STAGE_PROXY = 1;
        const STAGE_DIRECT_ANON = 2;
        const STAGE_DIRECT_UNRESTRICTED = 3;

        if (stage === STAGE_PROXY) {
            audio.crossOrigin = 'anonymous';
            audio.setAttribute('crossorigin', 'anonymous');
            finalUrl = `/ api / proxy ? url = ${encodeURIComponent(streamUrl)} `;
            console.log('[AudioContext] Stage 1: Attempting Proxied Anonymous connect...');
        } else if (stage === STAGE_DIRECT_ANON) {
            audio.crossOrigin = 'anonymous';
            audio.setAttribute('crossorigin', 'anonymous');
            finalUrl = streamUrl;
            console.log('[AudioContext] Stage 2: Attempting Direct Anonymous connect...');
        } else {
            audio.removeAttribute('crossorigin');
            audio.crossOrigin = null;
            finalUrl = streamUrl;
            console.log('[AudioContext] Stage 3: Attempting Unrestricted connect...');
        }

        clearConnectionTimeout();
        connectionTimeoutRef.current = window.setTimeout(() => {
            if (!hasConnectedRef.current && isConnecting) {
                console.warn(`[AudioContext] Stage ${stage} failed / timed out.`);
                if (stage < STAGE_DIRECT_UNRESTRICTED) {
                    attemptConnection(stage + 1, streamUrl);
                } else {
                    console.error('[AudioContext] All connection stages failed.');
                    toast.info("Station unavailable, skipping...");
                    nextStation();
                }
            }
        }, 2000);

        audio.src = finalUrl;
        audio.load();
        audio.play().catch(e => {
            if (e.name === 'NotSupportedError' || e.name === 'SecurityError') {
                console.warn(`[AudioContext] Stage ${stage} playback rejected.`, e.name);
                if (stage < STAGE_DIRECT_UNRESTRICTED) {
                    attemptConnection(stage + 1, streamUrl);
                }
            }
        });
    }, [clearConnectionTimeout, isConnecting, isPlaying]);

    // Handle Playback Logic and Stream Changes
    useEffect(() => {
        if (isPlaying && currentStation) {
            if (currentStreamUrlRef.current !== currentStation.url_resolved) {
                currentStreamUrlRef.current = currentStation.url_resolved;
                hasConnectedRef.current = false;

                // Initialize/Sync Audio Tap for Visualizers
                if (audioRef.current) {
                    initializeAudioTap(audioRef.current);
                }

                attemptConnection(1, currentStation.url_resolved);
            } else {
                if (audioRef.current) {
                    // Keep primary playing even during skip if smart skip is enabled (for monitoring)
                    if (!isAdSkipping || smartSkipEnabled) {
                        audioRef.current.play().catch(() => { });
                    }
                }
                if (isAdSkipping && backupAudioRef.current && backupAudioRef.current.src) {
                    backupAudioRef.current.play().catch(() => { });
                }
            }

            if (!metadataIntervalRef.current) {
                metadataIntervalRef.current = window.setInterval(checkMetadata, 10000);
            }
        } else {
            clearConnectionTimeout();
            setIsConnecting(false);
            audioRef.current?.pause();
            backupAudioRef.current?.pause();
            if (metadataIntervalRef.current) {
                clearInterval(metadataIntervalRef.current);
                metadataIntervalRef.current = null;
            }
        }
    }, [isPlaying, currentStation, attemptConnection, checkMetadata, clearConnectionTimeout]);

    // Handle Volume changes
    useEffect(() => {
        (window as any)._audioVolume = volume;
        const targetVolume = volume / 100;
        if (isAdSkipping) {
            if (backupAudioRef.current) backupAudioRef.current.volume = targetVolume;
            if (audioRef.current) audioRef.current.volume = 0;
        } else {
            if (audioRef.current) audioRef.current.volume = targetVolume;
            if (backupAudioRef.current) backupAudioRef.current.volume = 0;
        }
    }, [volume, isAdSkipping]);

    // Route Listener: Mute on Onboarding
    useEffect(() => {
        if (location.pathname === '/onboarding') {
            setIsPlayingActive(false);
        }
    }, [location.pathname, setIsPlayingActive]);

    // Sync Station Index (Crucial for Skip functionality)
    useEffect(() => {
        if (currentStation && stations.length > 0) {
            const index = stations.findIndex(s => s.stationuuid === currentStation.stationuuid);
            if (index !== -1 && index !== currentStationIndex) {
                setStationIndexActive(index);
            }
        }
    }, [currentStation, stations, currentStationIndex, setStationIndexActive]);

    // Safety Connection Timeout (Catch-all)
    useEffect(() => {
        let safetyTimeout: number | undefined;

        if (isConnecting && isPlaying && !isAdSkippingRef.current) {
            safetyTimeout = window.setTimeout(() => {
                console.warn('[AudioContext] Safety timeout triggered (8000ms). Force skipping...');
                toast.info("Connection timed out, skipping to next station...");
                nextStation();
            }, 8000);
        }

        return () => clearTimeout(safetyTimeout);
    }, [isConnecting, isPlaying, stations, currentStationIndex]);

    // Silence Detection
    useEffect(() => {
        const silenceTimeoutRef = window.setInterval(() => {
            const analyser = getAnalyserNode();
            if (!analyser || !isPlaying || !hasConnectedRef.current || isAdSkippingRef.current) return;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteTimeDomainData(dataArray);

            let hasSignal = false;
            for (let i = 0; i < dataArray.length; i++) {
                if (Math.abs(dataArray[i] - 128) > 2) {
                    hasSignal = true;
                    break;
                }
            }

            if (!hasSignal) {
                if (!window.hasOwnProperty('_silenceCount')) (window as any)._silenceCount = 0;
                (window as any)._silenceCount += 1;
                if ((window as any)._silenceCount >= 7) {
                    console.warn('[AudioContext] 7s silence detected. Skipping...');
                    (window as any)._silenceCount = 0;
                    nextStation();
                    toast.info("Silence detected, skipping station...");
                }
            } else {
                (window as any)._silenceCount = 0;
            }
        }, 1000);

        return () => window.clearInterval(silenceTimeoutRef);
    }, [isPlaying, stations, currentStationIndex]);

    const playStation = (station: RadioStation, mode?: 'home' | 'explore') => {
        const targetMode = mode || activeMode;

        if (targetMode === 'home') {
            setHomeRadio(prev => ({ ...prev, station, isPlaying: true }));
            setExploreRadio(prev => ({ ...prev, isPlaying: false }));
            localStorage.setItem('selectedStation', JSON.stringify(station));
        } else {
            setExploreRadio(prev => ({ ...prev, station, isPlaying: true }));
            setHomeRadio(prev => ({ ...prev, isPlaying: false }));
        }

        setActiveMode(targetMode);

        // PRE-ROLL SKIP: If Smart Skip is enabled, immediately switch to backup
        if (smartSkipEnabled) {
            console.log('[AudioContext] Smart Skip enabled on station change. Skipping pre-roll ads...');
            const currentStations = stationsRef.current;
            const otherStations = currentStations.filter(s => {
                const isOriginal = s.stationuuid === station.stationuuid;
                const tags = (s.tags || '').toLowerCase();
                const isExcluded = tags.includes('talk') || tags.includes('news') || tags.includes('speech') ||
                    tags.includes('christian') || tags.includes('religious') || tags.includes('gospel') ||
                    tags.includes('church') || tags.includes('prayer');
                return !isOriginal && !isExcluded;
            });

            if (otherStations.length > 0) {
                const random = otherStations[Math.floor(Math.random() * otherStations.length)];
                console.log('[AudioContext] Pre-roll skip: Starting with backup station:', random.name);
                setBackupStation(random);
                setAdSkippingWithSync(true);
                toast.info('Skipping pre-roll ads...', { duration: 3000 });
            }
        }
    };

    const togglePlay = (mode?: 'home' | 'explore') => {
        const targetMode = mode || activeMode;
        if (targetMode === 'home') {
            setHomeRadio(prev => {
                const nextPlaying = !prev.isPlaying;
                if (nextPlaying) setExploreRadio(e => ({ ...e, isPlaying: false }));
                return { ...prev, isPlaying: nextPlaying };
            });
        } else {
            setExploreRadio(prev => {
                const nextPlaying = !prev.isPlaying;
                if (nextPlaying) setHomeRadio(h => ({ ...h, isPlaying: false }));
                return { ...prev, isPlaying: nextPlaying };
            });
        }
        setActiveMode(targetMode);
    };

    const nextStation = (mode?: 'home' | 'explore') => {
        const targetMode = mode || activeMode;
        if (isAdSkipping) setAdSkippingWithSync(false);
        const radio = targetMode === 'home' ? homeRadio : exploreRadio;
        if (radio.stations.length > 0) {
            const nextIdx = (radio.currentStationIndex + 1) % radio.stations.length;
            if (targetMode === 'home') {
                setHomeRadio(prev => ({ ...prev, currentStationIndex: nextIdx, station: prev.stations[nextIdx], isPlaying: true }));
            } else {
                setExploreRadio(prev => ({ ...prev, currentStationIndex: nextIdx, station: prev.stations[nextIdx], isPlaying: true }));
            }
        }
    };

    const prevStation = (mode?: 'home' | 'explore') => {
        const targetMode = mode || activeMode;
        if (isAdSkipping) setAdSkippingWithSync(false);
        const radio = targetMode === 'home' ? homeRadio : exploreRadio;
        if (radio.stations.length > 0) {
            const prevIdx = (radio.currentStationIndex - 1 + radio.stations.length) % radio.stations.length;
            if (targetMode === 'home') {
                setHomeRadio(prev => ({ ...prev, currentStationIndex: prevIdx, station: prev.stations[prevIdx], isPlaying: true }));
            } else {
                setExploreRadio(prev => ({ ...prev, currentStationIndex: prevIdx, station: prev.stations[prevIdx], isPlaying: true }));
            }
        }
    };

    const setStationsMode = (newStations: RadioStation[], mode?: 'home' | 'explore') => {
        const targetMode = mode || activeMode;
        if (targetMode === 'home') {
            setHomeRadio(prev => ({ ...prev, stations: newStations }));
        } else {
            setExploreRadio(prev => ({ ...prev, stations: newStations }));
        }
    };

    const handleStreamError = () => {
        nextStation();
    };

    return (
        <AudioContext.Provider value={{
            currentStation,
            isPlaying,
            volume,
            stations,
            loading: isConnecting,
            isConnecting,
            streamMetadata,
            playStation,
            togglePlay,
            nextStation,
            prevStation,
            setVolume,
            setStations: setStationsMode,
            currentStationIndex,
            activeMode,
            homeRadio,
            exploreRadio,
            handleStreamError,
            smartSkipEnabled,
            setSmartSkipEnabled: (val: boolean) => {
                console.log('[AudioContext] Setting smartSkipEnabled to:', val);
                setSmartSkipEnabled(val);
                localStorage.setItem('smartSkipEnabled', String(val));
            },
            isAdSkipping,
            adSignalStatus,
            backupStation,
            audioRef
        }}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudio = () => {
    const context = useContext(AudioContext);
    if (context === undefined) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
};
