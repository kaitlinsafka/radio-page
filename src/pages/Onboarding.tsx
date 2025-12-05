import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Music, Radio, Disc, Headphones, Mic2, Globe, Piano, Guitar, Drumstick, Heart, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const genres = [
  { id: 'rock', name: 'Rock', icon: Guitar },
  { id: 'jazz', name: 'Jazz', icon: Piano },
  { id: 'electronic', name: 'Electronic/Dance', icon: Zap },
  { id: 'hip-hop', name: 'Hip Hop', icon: Mic2 },
  { id: 'folk', name: 'Folk/Americana', icon: Music },
  { id: 'world', name: 'World Music', icon: Globe },
  { id: 'classical', name: 'Classical', icon: Piano },
  { id: 'blues', name: 'Blues', icon: Guitar },
  { id: 'indie', name: 'Indie/Alternative', icon: Disc },
  { id: 'soul', name: 'Soul/R&B', icon: Heart },
  { id: 'metal', name: 'Metal', icon: Drumstick },
  { id: 'reggae', name: 'Reggae/Ska', icon: Radio },
];

const artistsByGenre: Record<string, string[]> = {
  'rock': ['The Beatles', 'Led Zeppelin', 'Queen', 'Pink Floyd', 'David Bowie', 'The Rolling Stones'],
  'jazz': ['Miles Davis', 'John Coltrane', 'Nina Simone', 'Ella Fitzgerald', 'Louis Armstrong', 'Charlie Parker'],
  'electronic': ['Daft Punk', 'Kraftwerk', 'Aphex Twin', 'The Chemical Brothers', 'Deadmau5', 'Calvin Harris'],
  'hip-hop': ['Kendrick Lamar', 'Outkast', 'Jay-Z', 'Nas', 'A Tribe Called Quest', 'Kanye West'],
  'folk': ['Bob Dylan', 'Joni Mitchell', 'Woody Guthrie', 'Simon & Garfunkel', 'Joan Baez', 'Nick Drake'],
  'world': ['Fela Kuti', 'Ravi Shankar', 'Cesária Évora', 'Ali Farka Touré', 'Youssou N\'Dour', 'Buena Vista Social Club'],
  'classical': ['Beethoven', 'Mozart', 'Bach', 'Chopin', 'Tchaikovsky', 'Vivaldi'],
  'blues': ['B.B. King', 'Muddy Waters', 'Robert Johnson', 'Howlin\' Wolf', 'Etta James', 'Buddy Guy'],
  'indie': ['Radiohead', 'Arcade Fire', 'The Strokes', 'Arctic Monkeys', 'Tame Impala', 'Bon Iver'],
  'soul': ['Aretha Franklin', 'Marvin Gaye', 'Otis Redding', 'Al Green', 'Sam Cooke', 'Stevie Wonder'],
  'metal': ['Metallica', 'Black Sabbath', 'Iron Maiden', 'Judas Priest', 'Slayer', 'Tool'],
  'reggae': ['Bob Marley', 'Peter Tosh', 'Burning Spear', 'Lee "Scratch" Perry', 'Toots and the Maytals', 'Jimmy Cliff']
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [customArtist, setCustomArtist] = useState('');

  const toggleGenre = (genreId: string) => {
    setSelectedGenres(prev =>
      prev.includes(genreId) ? prev.filter(g => g !== genreId) : [...prev, genreId]
    );
  };

  const toggleArtist = (artist: string) => {
    setSelectedArtists(prev =>
      prev.includes(artist) ? prev.filter(a => a !== artist) : [...prev, artist]
    );
  };

  const addCustomArtist = () => {
    if (customArtist.trim() && !selectedArtists.includes(customArtist.trim())) {
      setSelectedArtists(prev => [...prev, customArtist.trim()]);
      setCustomArtist('');
    }
  };

  const handleContinue = () => {
    // COMPLETELY CLEAR any previous preferences before saving new ones
    localStorage.removeItem('userGenres');
    localStorage.removeItem('userArtists');

    // Now save ONLY the newly selected preferences
    localStorage.setItem('userGenres', JSON.stringify(selectedGenres));
    localStorage.setItem('userArtists', JSON.stringify(selectedArtists));

    console.log('Preferences saved (completely reset):', selectedGenres);
    navigate('/radio');
  };

  const handleSkip = () => {
    navigate('/radio');
  };

  const canContinue = selectedGenres.length >= 2 && selectedArtists.length >= 2;

  // Get recommended artists based on selected genres
  const recommendedArtists = selectedGenres.length > 0
    ? Array.from(new Set(selectedGenres.flatMap(genre => artistsByGenre[genre] || [])))
    : Object.values(artistsByGenre).flat().slice(0, 16);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Headphones className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-primary">RadioScope</h1>
          </div>
          <p className="text-lg text-muted-foreground">Find your perfect station</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-semibold">1</div>
              <span className="text-sm font-medium">Taste Profile</span>
            </div>
            <div className="w-12 h-0.5 bg-border"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold">2</div>
              <span className="text-sm text-muted-foreground">Your Radio</span>
            </div>
          </div>
        </div>

        {/* Genre Selection */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">What do you love to listen to?</h2>
            <p className="text-muted-foreground">Select all genres that speak to you (at least 2)</p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {genres.map(genre => {
              const Icon = genre.icon;
              const isSelected = selectedGenres.includes(genre.id);
              return (
                <button
                  key={genre.id}
                  onClick={() => toggleGenre(genre.id)}
                  className={`p-6 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-3 ${isSelected
                      ? 'bg-accent border-accent text-accent-foreground shadow-medium scale-105'
                      : 'bg-card border-border hover:border-primary hover:shadow-soft'
                    }`}
                >
                  <Icon className="w-8 h-8" />
                  <span className="font-medium text-center">{genre.name}</span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-accent-foreground flex items-center justify-center">
                      <svg className="w-3 h-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Artist Selection */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Who are your favorite artists?</h2>
            <p className="text-muted-foreground">Select at least 2 artists you love</p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            {/* Popular Picks */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">
                {selectedGenres.length > 0 ? 'Recommended for you' : 'Popular picks'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {recommendedArtists.slice(0, 16).map(artist => {
                  const isSelected = selectedArtists.includes(artist);
                  return (
                    <button
                      key={artist}
                      onClick={() => toggleArtist(artist)}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${isSelected
                          ? 'bg-secondary border-secondary text-secondary-foreground shadow-soft'
                          : 'bg-card border-border hover:border-secondary'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium truncate">{artist}</span>
                        {isSelected && (
                          <svg className="w-4 h-4 text-secondary-foreground ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Search */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Can't find them?</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type artist name..."
                    value={customArtist}
                    onChange={(e) => setCustomArtist(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomArtist()}
                    className="flex-1"
                  />
                  <Button onClick={addCustomArtist} variant="secondary">Add</Button>
                </div>
                {selectedArtists.filter(a => !recommendedArtists.includes(a)).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Your custom artists:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedArtists.filter(a => !recommendedArtists.includes(a)).map(artist => (
                        <div key={artist} className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm font-medium flex items-center gap-2">
                          {artist}
                          <button onClick={() => toggleArtist(artist)} className="hover:opacity-70">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex justify-between items-center pt-8 border-t border-border">
          <button onClick={handleSkip} className="text-muted-foreground hover:text-foreground transition-colors">
            Skip for now
          </button>
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-8"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
