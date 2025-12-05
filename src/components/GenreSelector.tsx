import { Button } from "@/components/ui/button";
import { Music, Guitar, Radio, Mic2, Globe } from "lucide-react";

const genres = [
  { id: 'rock', label: 'Rock', icon: Guitar },
  { id: 'jazz', label: 'Jazz', icon: Music },
  { id: 'electronic', label: 'Electronic', icon: Radio },
  { id: 'folk', label: 'Folk', icon: Mic2 },
  { id: 'world', label: 'World Music', icon: Globe },
];

interface GenreSelectorProps {
  selectedGenre: string;
  onGenreChange: (genre: string) => void;
}

export const GenreSelector = ({ selectedGenre, onGenreChange }: GenreSelectorProps) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold tracking-wider text-foreground/70 uppercase">
        Select Genre
      </h3>
      <div className="grid grid-cols-5 gap-3">
        {genres.map((genre) => {
          const Icon = genre.icon;
          const isSelected = selectedGenre === genre.id;
          
          return (
            <Button
              key={genre.id}
              onClick={() => onGenreChange(genre.id)}
              variant="outline"
              className={`
                h-24 flex-col gap-2 border-2 rounded-xl transition-smooth shadow-soft
                ${isSelected 
                  ? 'bg-vintage-brass border-vintage-brass text-foreground glow-brass' 
                  : 'bg-card border-vintage-walnut/20 hover:bg-vintage-cream-dark hover:border-vintage-brass/50'
                }
              `}
            >
              <Icon className={`h-6 w-6 ${isSelected ? 'text-foreground' : 'text-vintage-walnut'}`} />
              <span className={`text-xs font-medium ${isSelected ? 'text-foreground' : 'text-foreground/70'}`}>
                {genre.label}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
