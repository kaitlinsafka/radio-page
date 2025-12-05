import { useEffect, useRef } from "react";

interface StaticAudioPlayerProps {
    isPlaying: boolean;
    volume?: number; // 0-100
}

/**
 * Plays the static sound effect during loading states
 * Uses the provided static sound.wav file
 */
export const StaticAudioPlayer = ({
    isPlaying,
    volume = 50
}: StaticAudioPlayerProps) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (isPlaying) {
            // Create audio element if it doesn't exist
            if (!audioRef.current) {
                audioRef.current = new Audio('/sounds/static.wav');
                audioRef.current.loop = true;
            }

            // Set volume - boosted for audibility
            audioRef.current.volume = Math.min(volume / 100, 1);

            // Start playing
            audioRef.current.play().catch(error => {
                console.warn('Could not play static sound:', error);
            });
        } else {
            // Stop playing
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        }

        return () => {
            // Cleanup on unmount
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, [isPlaying, volume]);

    // Update volume when it changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = Math.min(volume / 100, 1);
        }
    }, [volume]);

    return null; // This component doesn't render anything
};
