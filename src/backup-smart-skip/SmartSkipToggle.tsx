import React, { useState } from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, ShieldCheck, Forward, Info } from "lucide-react";
import { useAudio } from "@/context/AudioContext";

interface SmartSkipToggleProps {
    variant?: 'default' | 'compact' | 'minimal';
}

export const SmartSkipToggle: React.FC<SmartSkipToggleProps> = ({ variant = 'default' }) => {
    const { smartSkipEnabled, setSmartSkipEnabled, adSignalStatus } = useAudio();
    const [showInfo, setShowInfo] = useState(false);

    const handleToggle = (checked: boolean) => {
        if (checked) {
            const hasSeenInfo = localStorage.getItem('hasSeenSmartSkipInfo');
            if (!hasSeenInfo) {
                setShowInfo(true);
                return;
            }
        }
        setSmartSkipEnabled(checked);
    };

    const confirmEnable = () => {
        setSmartSkipEnabled(true);
        localStorage.setItem('hasSeenSmartSkipInfo', 'true');
        setShowInfo(false);
    };

    if (variant === 'minimal') {
        return (
            <div className="flex items-center gap-2">
                <Zap className={`w-3.5 h-3.5 ${smartSkipEnabled ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                <Switch
                    id="smart-skip-minimal"
                    checked={smartSkipEnabled}
                    onCheckedChange={handleToggle}
                    className="scale-75 data-[state=checked]:bg-yellow-500"
                />
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-3 bg-[#F9F9FB] dark:bg-[#1a1f28] rounded-xl border-2 border-[#331F21] dark:border-yellow-500/30 shadow-[2px_2px_0_#331F21] dark:shadow-[2px_2px_0_rgba(0,0,0,0.3)] transition-all hover:translate-y-[1px] hover:shadow-[1px_1px_0_#331F21] ${variant === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <Zap className={`w-3.5 h-3.5 ${smartSkipEnabled ? 'text-yellow-500 fill-yellow-500' : 'text-[#331F21]/30 dark:text-gray-600'}`} />
                    <Label htmlFor="smart-skip" className="text-[10px] font-black uppercase tracking-widest cursor-pointer select-none text-[#331F21] dark:text-white">
                        Smart Skip
                    </Label>
                    {smartSkipEnabled && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${adSignalStatus === 'CONNECTED'
                                ? 'bg-green-500/10 border-green-500/30 text-green-600'
                                : 'bg-red-500/10 border-red-500/30 text-red-600 animate-pulse'
                            }`}>
                            <div className={`w-1 h-1 rounded-full ${adSignalStatus === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-[7px] font-black uppercase tracking-tighter">
                                {adSignalStatus === 'CONNECTED' ? 'LIVE' : adSignalStatus}
                            </span>
                        </div>
                    )}
                </div>
                {variant === 'default' && (
                    <span className="text-[8px] text-[#331F21]/40 dark:text-gray-500 uppercase font-black tracking-tighter">Auto-Filter Ads</span>
                )}
            </div>

            <Switch
                id="smart-skip"
                checked={smartSkipEnabled}
                onCheckedChange={handleToggle}
                className="data-[state=checked]:bg-yellow-500 border-2 border-[#331F21] dark:border-yellow-500/50"
            />

            <Dialog open={showInfo} onOpenChange={setShowInfo}>
                <DialogContent className="max-w-md bg-[#F9F9FB] dark:bg-[#1a1f28] border-4 border-[#331F21] dark:border-yellow-500/30 rounded-3xl">
                    <DialogHeader>
                        <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center mb-4 mx-auto rotate-3 shadow-lg">
                            <Zap className="w-10 h-10 text-white fill-white" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-[#331F21] dark:text-white uppercase text-center">
                            Smart Skip Activated!
                        </DialogTitle>
                        <DialogDescription className="text-center pt-2">
                            <p className="font-bold text-[#331F21]/70 dark:text-gray-400 text-sm leading-relaxed">
                                Our community-powered signal system identifies live ads and automatically skips them for you.
                            </p>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-6">
                        <div className="flex items-start gap-4 bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-[#331F21]/5">
                            <Forward className="w-6 h-6 text-yellow-600 shrink-0" />
                            <div>
                                <h4 className="font-black uppercase text-xs text-[#331F21] dark:text-white">Seamless Cross-fade</h4>
                                <p className="text-[11px] font-medium opacity-60">When an ad starts, we'll smoothly transition you to a backup station from your library.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-[#331F21]/5">
                            <ShieldCheck className="w-6 h-6 text-yellow-600 shrink-0" />
                            <div>
                                <h4 className="font-black uppercase text-xs text-[#331F21] dark:text-white">Back to Live</h4>
                                <p className="text-[11px] font-medium opacity-60">The second the music is back on the original station, you'll be cross-faded right back to the action.</p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col items-stretch gap-2">
                        <Button
                            onClick={confirmEnable}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white font-black uppercase text-xs tracking-widest h-12 rounded-xl shadow-lg border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 transition-all"
                        >
                            Start Ad-Free Radio
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setShowInfo(false)}
                            className="font-bold uppercase text-[10px] opacity-40 hover:opacity-100"
                        >
                            Maybe Later
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
