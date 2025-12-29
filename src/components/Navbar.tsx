import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Headphones, Heart, Moon, Sun, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAuth } from "@/components/UserAuth";
import { useAudio } from "@/context/AudioContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import SavedStations from "@/components/SavedStations";
import RequestStationForm from "@/components/RequestStationForm";

interface NavbarProps {
    isDarkMode: boolean;
    setIsDarkMode: (isDark: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isDarkMode, setIsDarkMode }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { playStation } = useAudio();
    const [showSavedDialog, setShowSavedDialog] = useState(false);
    const [showSubmitDialog, setShowSubmitDialog] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    const handlePlaySavedStation = (station: any) => {
        playStation(station, 'home');
        setShowSavedDialog(false);
        if (location.pathname !== '/radio') {
            navigate('/radio');
        }
    };

    return (
        <header className="border-b border-border bg-card sticky top-0 z-50 shadow-md">
            <div className="container max-w-7xl mx-auto px-6 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/radio" className="flex items-center gap-3 group">
                        <div className="bg-[#E0CDCE] p-1.5 rounded-lg shadow-medium group-hover:scale-110 transition-transform">
                            <Headphones className="w-6 h-6 text-[#F9F9FB]" />
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold text-[#E0CDCE] tracking-tight">My Radio</h1>
                    </Link>

                    {/* Navigation Links */}
                    <nav className="hidden lg:flex items-center gap-8">
                        <Link
                            to="/onboarding"
                            className={`text-sm transition-colors text-[#331F21] dark:text-foreground hover:font-bold ${isActive("/onboarding") ? "font-bold underline decoration-2 underline-offset-8 decoration-[#331F21] dark:decoration-foreground" : "font-medium"
                                }`}
                        >
                            Edit Preferences
                        </Link>
                        <Link
                            to="/explore"
                            className={`text-sm transition-colors text-[#331F21] dark:text-foreground hover:font-bold ${isActive("/explore") ? "font-bold underline decoration-2 underline-offset-8 decoration-[#331F21] dark:decoration-foreground" : "font-medium"
                                }`}
                        >
                            Explore Radio
                        </Link>
                        <Link
                            to="/radio"
                            className={`text-sm transition-colors text-[#331F21] dark:text-foreground hover:font-bold ${isActive("/radio") ? "font-bold underline decoration-2 underline-offset-8 decoration-[#331F21] dark:decoration-foreground" : "font-medium"
                                }`}
                        >
                            Home Radio
                        </Link>
                        <button
                            onClick={() => setShowSavedDialog(true)}
                            className="flex items-center gap-2 text-sm text-[#331F21] dark:text-foreground hover:font-bold transition-colors font-medium"
                        >
                            <Heart className="w-4 h-4" />
                            Saved Stations
                        </button>
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSubmitDialog(true)}
                            className="hidden sm:flex items-center gap-2 border-[#331F21]/30 text-[#331F21] dark:text-foreground dark:border-foreground/30 text-xs font-bold uppercase tracking-wider hover:bg-[#331F21]/5 dark:hover:bg-foreground/5 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Submit Station
                        </Button>

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="border-2 rounded-lg w-9 h-9 transition-all hover:border-primary/50"
                            aria-label="Toggle theme"
                        >
                            {isDarkMode ? (
                                <Sun className="w-4 h-4 text-yellow-500" />
                            ) : (
                                <Moon className="w-4 h-4 text-slate-700" />
                            )}
                        </Button>

                        <div className="ml-1">
                            <UserAuth />
                        </div>
                    </div>
                </div>
            </div>

            {/* Shared Dialogs */}
            <Dialog open={showSavedDialog} onOpenChange={setShowSavedDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#F9F9FB] dark:bg-card border-4 border-[#331F21] dark:border-border">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-[#331F21] dark:text-foreground font-mono">YOUR SAVED STATIONS</DialogTitle>
                        <DialogDescription className="sr-only">Your list of saved radio stations</DialogDescription>
                    </DialogHeader>
                    <SavedStations onPlayStation={handlePlaySavedStation} />
                </DialogContent>
            </Dialog>

            <RequestStationForm open={showSubmitDialog} onOpenChange={setShowSubmitDialog} />
        </header>
    );
};
