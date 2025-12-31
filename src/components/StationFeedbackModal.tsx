
import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StationFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    station: {
        id: string;
        name: string;
    } | null;
}

export const StationFeedbackModal: React.FC<StationFeedbackModalProps> = ({
    isOpen,
    onClose,
    station,
}) => {
    const { user } = useAuth();
    const [category, setCategory] = useState<string>("genre_mismatch");
    const [violatingGenres, setViolatingGenres] = useState<string[]>([]);
    const [message, setMessage] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userGenres, setUserGenres] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            const savedGenres = localStorage.getItem("userGenres");
            if (savedGenres) {
                try {
                    setUserGenres(JSON.parse(savedGenres));
                } catch (e) {
                    console.error("Failed to parse user genres", e);
                }
            }
        }
    }, [isOpen]);

    const toggleGenre = (genre: string) => {
        setViolatingGenres(prev =>
            prev.includes(genre)
                ? prev.filter(g => g !== genre)
                : [...prev, genre]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!station || !user) {
            toast.error("You must be logged in to submit feedback");
            return;
        }

        setIsSubmitting(true);

        try {
            // Spam protection: check last hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { count, error: countError } = await supabase
                .from("station_feedback")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id)
                .gt("created_at", oneHourAgo);

            if (countError) throw countError;

            if (count !== null && count >= 3) {
                toast.error("Feedback limit reached. Please try again later.");
                setIsSubmitting(false);
                return;
            }

            const { error } = await supabase.from("station_feedback").insert([
                {
                    user_id: user.id,
                    station_id: station.id,
                    station_name: station.name,
                    category,
                    violating_genre: category === "genre_mismatch" ? violatingGenres.join(", ") : null,
                    message: message.trim(),
                    status: "pending",
                },
            ]);

            if (error) throw error;

            toast.success("Feedback submitted. Thank you!");
            onClose();
            // Reset form
            setMessage("");
            setViolatingGenres([]);
            setCategory("genre_mismatch");
        } catch (err: any) {
            console.error("Feedback submission error:", err);
            toast.error("Failed to submit feedback");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px] border-4 border-[#331F21] rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="shrink-0 pb-2">
                    <DialogTitle className="text-xl font-black uppercase text-[#331F21] tracking-tighter">
                        Station Feedback
                    </DialogTitle>
                    <DialogDescription className="text-xs font-bold text-[#331F21]/60 uppercase">
                        Help us improve the quality for everyone.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-6 overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-6 pt-2">
                        <div className="p-3 bg-muted/30 border-2 border-[#331F21]/10 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#331F21] text-white flex items-center justify-center shrink-0">
                                <AlertCircle className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase opacity-40">Currently Playing</p>
                                <p className="text-sm font-black uppercase leading-tight truncate max-w-[280px]">
                                    {station?.name || "Unknown Station"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60">Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="border-2 border-[#331F21] rounded-xl h-11 font-bold">
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent className="border-2 border-[#331F21] rounded-xl">
                                    <SelectItem value="genre_mismatch" className="font-bold uppercase text-[10px]">Doesn't match genre</SelectItem>
                                    <SelectItem value="other" className="font-bold uppercase text-[10px]">Other (Dead stream, etc.)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {category === "genre_mismatch" && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <Label className="text-[10px] font-black uppercase opacity-60">Which genres from your profile is it violating?</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {userGenres.length > 0 ? (
                                        userGenres.map((g) => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => toggleGenre(g)}
                                                className={cn(
                                                    "px-3 py-2 rounded-xl border-2 text-[10px] font-black uppercase transition-all flex items-center justify-between",
                                                    violatingGenres.includes(g)
                                                        ? "bg-[#331F21] border-[#331F21] text-white shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
                                                        : "bg-white border-[#331F21]/10 text-[#331F21]/60 hover:border-[#331F21]/30"
                                                )}
                                            >
                                                <span className="truncate">{g}</span>
                                                {violatingGenres.includes(g) && <Check className="w-3 h-3 shrink-0 ml-1" />}
                                            </button>
                                        ))
                                    ) : (
                                        <p className="col-span-2 text-[10px] font-bold text-red-500 uppercase">No genres selected in your profile yet.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 pb-4">
                            <Label className="text-[10px] font-black uppercase opacity-60">
                                {category === "other" ? "Tell us more" : "Additional details (Optional)"}
                            </Label>
                            <Textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder={category === "other" ? "Describe the issue (e.g. dead stream, offensive content)..." : "Any other details?"}
                                className="border-2 border-[#331F21] rounded-xl min-h-[100px] font-medium resize-none focus-visible:ring-0"
                                required={category === "other"}
                            />
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 pt-4 border-t-2 border-[#331F21]/5 -mx-6 px-6 pb-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="font-bold uppercase text-[10px] h-11 px-6"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#331F21] text-white hover:bg-[#331F21]/90 rounded-xl px-8 h-11 uppercase font-black tracking-widest text-xs"
                            disabled={isSubmitting || (category === "genre_mismatch" && violatingGenres.length === 0)}
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Send Feedback"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
