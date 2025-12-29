import { useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AdminTagPickerProps {
    selectedTags: string[];
    onTagsChange: (tags: string[]) => void;
}

const MUSIC_GENRES = [
    "Rock", "Jazz", "Electronic", "Hip Hop", "Folk", "Punk", "Classical",
    "Blues", "Indie", "Soul", "Metal", "Reggae", "Ambient", "World",
    "Chillout", "Country", "Latin", "Funk", "Disco", "Pop"
];

const COMMON_TAGS = [
    ...MUSIC_GENRES,
    "Community", "College Radio", "University", "Independent", "Underground",
    "News", "Talk", "Sports", "Religious", "Public Radio",
    "Non-commercial", "DIY", "Avant-garde", "Experimental", "Eclectic"
].sort();

const AdminTagPicker = ({ selectedTags, onTagsChange }: AdminTagPickerProps) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");

    const toggleTag = (tag: string) => {
        const normalized = tag.trim().toLowerCase();
        if (!normalized) return;

        const exists = selectedTags.some(t => t.toLowerCase() === normalized);
        if (exists) {
            onTagsChange(selectedTags.filter(t => t.toLowerCase() !== normalized));
        } else {
            // Capitalize first letter for display if it's a new tag
            const label = tag.charAt(0).toUpperCase() + tag.slice(1);
            onTagsChange([...selectedTags, label]);
        }
    };

    const handleAddCustom = () => {
        if (inputValue.trim()) {
            toggleTag(inputValue.trim());
            setInputValue("");
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {selectedTags.length > 0 ? (
                    selectedGenresToBadges(selectedTags, toggleTag)
                ) : (
                    <span className="text-[10px] font-bold text-[#331F21]/30 uppercase italic">No tags selected</span>
                )}
            </div>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-2 border-[#331F21] bg-white hover:bg-[#D3E1E6] text-[#331F21] font-bold uppercase text-[10px] tracking-wider gap-2 w-fit"
                    >
                        <Plus className="w-3 h-3" />
                        Manage Tags
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0 border-2 border-[#331F21] rounded-xl overflow-hidden shadow-lg" align="start">
                    <Command className="bg-white">
                        <CommandInput
                            placeholder="Find or add tag..."
                            className="h-9 border-none focus:ring-0"
                            value={inputValue}
                            onValueChange={setInputValue}
                        />
                        <CommandList>
                            <CommandEmpty>
                                <Button
                                    variant="ghost"
                                    className="w-full text-left justify-start gap-2 h-9 text-[10px] font-bold uppercase text-primary"
                                    onClick={handleAddCustom}
                                >
                                    <Plus className="w-3 h-3" />
                                    Add "{inputValue}"
                                </Button>
                            </CommandEmpty>
                            <CommandGroup heading="Common Tags">
                                {COMMON_TAGS.map((tag) => (
                                    <CommandItem
                                        key={tag}
                                        onSelect={() => toggleTag(tag)}
                                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent rounded-md"
                                    >
                                        <div className={cn(
                                            "w-3 h-3 border border-[#331F21] rounded-sm flex items-center justify-center transition-colors",
                                            selectedTags.some(t => t.toLowerCase() === tag.toLowerCase()) ? "bg-[#331F21]" : "bg-white"
                                        )}>
                                            {selectedTags.some(t => t.toLowerCase() === tag.toLowerCase()) && (
                                                <Check className="w-2.5 h-2.5 text-white" />
                                            )}
                                        </div>
                                        <span className="font-bold uppercase text-[10px] tracking-wider">{tag}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};

// Helper for rendering badges
function selectedGenresToBadges(tags: string[], onRemove: (tag: string) => void) {
    // Unique and cleaned up
    const uniqueTags = Array.from(new Set(tags.map(t => t.trim()).filter(Boolean)));

    return uniqueTags.map((tag) => (
        <Badge
            key={tag}
            variant="secondary"
            className="bg-[#D3E1E6] hover:bg-[#c4d7df] text-[#331F21] border border-[#331F21]/20 py-0 px-2 flex items-center gap-1 h-6 transition-all"
        >
            <span className="text-[10px] font-black uppercase tracking-tight">{tag}</span>
            <X
                className="w-3 h-3 cursor-pointer opacity-40 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove(tag);
                }}
            />
        </Badge>
    ));
}

export default AdminTagPicker;
