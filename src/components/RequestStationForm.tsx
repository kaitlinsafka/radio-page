import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Radio, Loader2, Send, Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RequestStationFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const AVAILABLE_GENRES = [
    "Rock", "Jazz", "Electronic", "Hip Hop", "Folk", "Punk", "Classical",
    "Blues", "Indie", "Soul", "Metal", "Reggae", "Ambient", "World",
    "Chillout", "Country", "Latin", "Funk", "Disco", "Pop"
];

const RequestStationForm = ({ open, onOpenChange }: RequestStationFormProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");

    const toggleGenre = (genre: string) => {
        setSelectedGenres(prev =>
            prev.includes(genre)
                ? prev.filter(g => g !== genre)
                : [...prev, genre]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            toast.error("Please sign in to submit a station request");
            return;
        }

        if (selectedGenres.length === 0) {
            toast.error("Please select at least one genre");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('station_requests')
                .insert([{
                    user_id: user.id,
                    name,
                    url,
                    genre: selectedGenres.join(', '),
                    city,
                    country,
                    status: 'pending',
                    is_user_submission: true
                }]);

            if (error) throw error;

            toast.success("Request submitted! Our admins will review it soon.");
            onOpenChange(false);

            // Clear form
            setName("");
            setUrl("");
            setSelectedGenres([]);
            setCity("");
            setCountry("");
        } catch (err) {
            console.error("Submission error:", err);
            toast.error("Failed to submit request. Please check the stream URL.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border-4 border-[#331F21] rounded-[2rem] shadow-[8px_8px_0_#331F21]">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-[#E0CDCE] rounded-xl flex items-center justify-center border-2 border-[#331F21]">
                            <Radio className="w-6 h-6 text-[#331F21]" />
                        </div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Request Local Station</DialogTitle>
                    </div>
                    <DialogDescription className="font-medium text-[#331F21]/60">
                        Know a great local station? Submit it to our global catalog.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="station-name">Station Name</Label>
                            <Input
                                id="station-name"
                                placeholder="e.g. London Jazz FM"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="border-2 border-[#331F21]"
                                required
                            />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="stream-url">Stream URL (Direct MP3/AAC Link)</Label>
                            <Input
                                id="stream-url"
                                placeholder="https://example.com/stream.mp3"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="border-2 border-[#331F21]"
                                required
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label>Genres (Select all that apply)</Label>
                            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={popoverOpen}
                                        className="w-full justify-between border-2 border-[#331F21] h-auto min-h-11 py-2"
                                    >
                                        <div className="flex flex-wrap gap-1">
                                            {selectedGenres.length > 0 ? (
                                                selectedGenres.map((g) => (
                                                    <span key={g} className="bg-[#E0CDCE] text-[#331F21] px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1">
                                                        {g}
                                                        <X
                                                            className="w-3 h-3 cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleGenre(g);
                                                            }}
                                                        />
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Select genres...</span>
                                            )}
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[450px] p-0 border-2 border-[#331F21] rounded-xl overflow-hidden shadow-lg">
                                    <Command>
                                        <CommandInput placeholder="Search genres..." className="h-11" />
                                        <CommandList className="max-h-[300px]">
                                            <CommandEmpty>No genre found.</CommandEmpty>
                                            <CommandGroup>
                                                <div className="grid grid-cols-2 gap-1 p-1">
                                                    {AVAILABLE_GENRES.map((genre) => (
                                                        <CommandItem
                                                            key={genre}
                                                            onSelect={() => toggleGenre(genre)}
                                                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent rounded-md group"
                                                        >
                                                            <Checkbox
                                                                checked={selectedGenres.includes(genre)}
                                                                className="border-[#331F21] pointer-events-none"
                                                            />
                                                            <span className="font-bold uppercase text-xs tracking-wider">{genre}</span>
                                                        </CommandItem>
                                                    ))}
                                                </div>
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input
                                id="city"
                                placeholder="London"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="border-2 border-[#331F21]"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Input
                                id="country"
                                placeholder="United Kingdom"
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                className="border-2 border-[#331F21]"
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#331F21] hover:bg-[#4a2f32] text-white py-6 rounded-xl font-bold gap-2 uppercase tracking-widest shadow-[4px_4px_0_#D3E1E6]"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>
                                    <Send className="w-4 h-4" />
                                    SUBMIT FOR REVIEW
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RequestStationForm;
