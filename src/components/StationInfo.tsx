import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Radio } from "lucide-react";

interface StationInfoProps {
  stationName: string;
  location: string;
  country: string;
  countryCode: string;
  genres: string[];
}

export const StationInfo = ({ 
  stationName, 
  location, 
  country, 
  countryCode,
  genres 
}: StationInfoProps) => {
  return (
    <Card className="bg-card shadow-soft border-2 border-vintage-walnut/20 rounded-xl p-6 max-w-sm">
      <div className="space-y-4">
        {/* Station Name */}
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 rounded-lg bg-vintage-brass/20">
            <Radio className="h-5 w-5 text-vintage-brass" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-foreground truncate mb-1">
              {stationName}
            </h3>
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{location}, {country}</span>
              <span className="text-xl leading-none">{countryCode}</span>
            </div>
          </div>
        </div>

        {/* Genre Tags */}
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <Badge 
              key={genre}
              variant="outline"
              className="bg-vintage-cream-dark border-vintage-walnut/30 text-foreground/70 font-mono text-xs px-3 py-1"
            >
              {genre}
            </Badge>
          ))}
        </div>

        {/* Decorative Element */}
        <div className="pt-3 border-t border-vintage-walnut/10">
          <div className="flex items-center justify-between text-[10px] font-mono text-foreground/40 tracking-widest">
            <span>ON AIR</span>
            <div className="flex gap-1">
              <div className="w-1 h-3 bg-vintage-brass/40 rounded-full"></div>
              <div className="w-1 h-3 bg-vintage-brass/60 rounded-full"></div>
              <div className="w-1 h-3 bg-vintage-brass/80 rounded-full"></div>
              <div className="w-1 h-3 bg-vintage-brass rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
