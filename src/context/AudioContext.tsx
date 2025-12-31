import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { RadioStation } from '@/services/radioBrowserApi';
import { toast } from 'sonner';
import { getAnalyserNode, initializeAudioTap } from "@/services/songIdentification";

export interface RadioState {
    station: RadioStation | null;
    isPlaying: boolean;
    streamMetadata: string | null;
    stations: RadioStation[];
    currentStationIndex: number;
}

interface AudioContextType {
    // Shared State
    volume: number;
    loading: boolean;
    isConnecting: boolean;
    activeMode: 'home' | 'explore';

    // Mode States
    homeRadio: RadioState;
    exploreRadio: RadioState;

    // Active Radio Values
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

    // Audio Element Reference
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

    // Pointer to active/audible radio
    const activeRadio = activeMode === 'home' ? homeRadio : exploreRadio;
    const { station: currentStation, isPlaying, streamMetadata, stations, currentStationIndex } = activeRadio;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const location = useLocation();

    const metadataIntervalRef = useRef<number | null>(null);
    const connectionTimeoutRef = useRef<number | null>(null);
    const hardTimeoutRef = useRef<number | null>(null);
    const stallTimeoutRef = useRef<number | null>(null);
    const hasConnectedRef = useRef(false);
    const currentStreamUrlRef = useRef<string>('');

    // Refs for Stability
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;
    const stationsRef = useRef(stations);
    stationsRef.current = stations;
    const currentStationRef = useRef(currentStation);
    currentStationRef.current = currentStation;

    const clearTimeouts = useCallback(() => {
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }
        if (hardTimeoutRef.current) {
            clearTimeout(hardTimeoutRef.current);
            hardTimeoutRef.current = null;
        }
        if (stallTimeoutRef.current) {
            clearTimeout(stallTimeoutRef.current);
            stallTimeoutRef.current = null;
        }
    }, []);

    const forceSkip = useCallback((reason: string) => {
        console.warn(`[AudioContext] Force skip triggered: ${reason}`);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.load(); // Forces cleanup of pending requests
        }
        clearTimeouts();
        setIsConnecting(false);
        toast.info(reason === 'timeout' ? "Station taking too long, skipping..." : "Stream stalled, finding new station...");
        nextStation();
    }, [clearTimeouts]);

    const checkMetadata = useCallback(() => {
        if (!audioRef.current) return;
        if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
            const meta = navigator.mediaSession.metadata;
            if (meta.title || meta.artist) {
                const metaString = meta.artist ? `${meta.artist} - ${meta.title}` : meta.title;
                if (activeMode === 'home') {
                    setHomeRadio(prev => ({ ...prev, streamMetadata: metaString }));
                } else {
                    setExploreRadio(prev => ({ ...prev, streamMetadata: metaString }));
                }
                return;
            }
        }
    }, [activeMode]);

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
            audioRef.current.preload = "auto";
        }

        const audio = audioRef.current;

        const handleCanPlay = () => {
            clearTimeouts();
            setIsConnecting(false);
            hasConnectedRef.current = true;
            checkMetadata();
        };

        const handlePlaying = () => {
            clearTimeouts();
            setIsConnecting(false);
            hasConnectedRef.current = true;
        };

        const handleWaiting = () => {
            // Only trigger stall detection if we had already successfully connected once
            if (hasConnectedRef.current && !stallTimeoutRef.current) {
                stallTimeoutRef.current = window.setTimeout(() => {
                    forceSkip('stall');
                }, 5000);
            }
        };

        const handleStalled = () => {
            if (hasConnectedRef.current && !stallTimeoutRef.current) {
                stallTimeoutRef.current = window.setTimeout(() => {
                    forceSkip('stall');
                }, 5000);
            }
        };

        const handleError = (e: Event) => {
            console.error('[AudioContext] Stream error:', e);
            if (!hasConnectedRef.current) {
                clearTimeouts();
                setIsConnecting(false);
            }
        };

        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('playing', handlePlaying);
        audio.addEventListener('waiting', handleWaiting);
        audio.addEventListener('stalled', handleStalled);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('playing', handlePlaying);
            audio.removeEventListener('waiting', handleWaiting);
            audio.removeEventListener('stalled', handleStalled);
            audio.removeEventListener('error', handleError);
        };
    }, [checkMetadata, clearTimeouts, volume, forceSkip]);

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
            finalUrl = `/api/proxy?url=${encodeURIComponent(streamUrl)}`;
        } else if (stage === STAGE_DIRECT_ANON) {
            audio.crossOrigin = 'anonymous';
            finalUrl = streamUrl;
        } else {
            audio.removeAttribute('crossorigin');
            audio.crossOrigin = null;
            finalUrl = streamUrl;
        }

        clearTimeouts();

        // Start Hard Timeout (7 seconds) if this is the first stage
        if (stage === STAGE_PROXY) {
            hardTimeoutRef.current = window.setTimeout(() => {
                if (!hasConnectedRef.current && isPlaying) {
                    forceSkip('timeout');
                }
            }, 7000);
        }

        connectionTimeoutRef.current = window.setTimeout(() => {
            if (!hasConnectedRef.current && isConnecting) {
                if (stage < STAGE_DIRECT_UNRESTRICTED) {
                    attemptConnection(stage + 1, streamUrl);
                } else {
                    toast.info("Station unavailable, skipping...");
                    nextStation();
                }
            }
        }, 3000);

        audio.src = finalUrl;
        audio.load();
        audio.play().catch(e => {
            if (e.name === 'NotSupportedError' || e.name === 'SecurityError') {
                if (stage < STAGE_DIRECT_UNRESTRICTED) {
                    attemptConnection(stage + 1, streamUrl);
                }
            }
        });
    }, [clearTimeouts, isConnecting, isPlaying]);

    // Handle Playback Logic
    useEffect(() => {
        if (isPlaying && currentStation) {
            if (currentStreamUrlRef.current !== currentStation.url_resolved) {
                currentStreamUrlRef.current = currentStation.url_resolved;
                hasConnectedRef.current = false;
                if (audioRef.current) initializeAudioTap(audioRef.current);
                attemptConnection(1, currentStation.url_resolved);
            } else {
                audioRef.current?.play().catch(() => { });
            }

            if (!metadataIntervalRef.current) {
                metadataIntervalRef.current = window.setInterval(checkMetadata, 10000);
            }
        } else {
            clearTimeouts();
            setIsConnecting(false);
            audioRef.current?.pause();
            if (metadataIntervalRef.current) {
                clearInterval(metadataIntervalRef.current);
                metadataIntervalRef.current = null;
            }
        }
    }, [isPlaying, currentStation, attemptConnection, checkMetadata, clearTimeouts]);

    // Handle Volume
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume / 100;
    }, [volume]);

    // Route Listener
    useEffect(() => {
        if (location.pathname === '/onboarding') setIsPlayingActive(false);
    }, [location.pathname, setIsPlayingActive]);

    // Silence Detection
    useEffect(() => {
        const silenceTimeoutRef = window.setInterval(() => {
            const analyser = getAnalyserNode();
            if (!analyser || !isPlaying || !hasConnectedRef.current) return;

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
                if ((window as any)._silenceCount >= 10) {
                    (window as any)._silenceCount = 0;
                    nextStation();
                    toast.info("Silence detected, skipping...");
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
    };

    const togglePlay = (mode?: 'home' | 'explore') => {
        const targetMode = mode || activeMode;
        if (targetMode === 'home') {
            setHomeRadio(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
            if (!homeRadio.isPlaying) setExploreRadio(e => ({ ...e, isPlaying: false }));
        } else {
            setExploreRadio(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
            if (!exploreRadio.isPlaying) setHomeRadio(h => ({ ...h, isPlaying: false }));
        }
        setActiveMode(targetMode);
    };

    const nextStation = (mode?: 'home' | 'explore') => {
        const targetMode = mode || activeMode;
        const radio = targetMode === 'home' ? homeRadio : exploreRadio;
        if (radio.stations.length > 0) {
            const nextIdx = (radio.currentStationIndex + 1) % radio.stations.length;
            const nextStation = radio.stations[nextIdx];
            if (targetMode === 'home') {
                setHomeRadio(prev => ({ ...prev, currentStationIndex: nextIdx, station: nextStation, isPlaying: true }));
            } else {
                setExploreRadio(prev => ({ ...prev, currentStationIndex: nextIdx, station: nextStation, isPlaying: true }));
            }
        }
    };

    const prevStation = (mode?: 'home' | 'explore') => {
        const targetMode = mode || activeMode;
        const radio = targetMode === 'home' ? homeRadio : exploreRadio;
        if (radio.stations.length > 0) {
            const prevIdx = (radio.currentStationIndex - 1 + radio.stations.length) % radio.stations.length;
            const prevStation = radio.stations[prevIdx];
            if (targetMode === 'home') {
                setHomeRadio(prev => ({ ...prev, currentStationIndex: prevIdx, station: prevStation, isPlaying: true }));
            } else {
                setExploreRadio(prev => ({ ...prev, currentStationIndex: prevIdx, station: prevStation, isPlaying: true }));
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
            handleStreamError: () => nextStation(),
            audioRef
        }}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudio = () => {
    const context = useContext(AudioContext);
    if (context === undefined) throw new Error('useAudio must be used within an AudioProvider');
    return context;
};
