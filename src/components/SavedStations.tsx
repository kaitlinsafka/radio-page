import { useState, useEffect } from "react";
import { Heart, Plus, Folder, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type RadioStation, getCountryFlag } from "@/services/radioBrowserApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Playlist {
  id: string;
  name: string;
  stationIds: string[];
}

interface SavedStationsProps {
  onPlayStation: (station: RadioStation) => void;
}

const SavedStations = ({ onPlayStation }: SavedStationsProps) => {
  const [savedStations, setSavedStations] = useState<RadioStation[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);

  useEffect(() => {
    // Load saved stations from localStorage
    const savedIds = JSON.parse(localStorage.getItem('savedStations') || '[]');
    const stationsData = JSON.parse(localStorage.getItem('savedStationsData') || '[]');
    setSavedStations(stationsData.filter((s: RadioStation) => savedIds.includes(s.stationuuid)));
    
    // Load playlists
    const playlistsData = JSON.parse(localStorage.getItem('playlists') || '[]');
    setPlaylists(playlistsData);
  }, []);

  const createPlaylist = () => {
    if (!newPlaylistName.trim()) return;
    
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      stationIds: [],
    };
    
    const updatedPlaylists = [...playlists, newPlaylist];
    setPlaylists(updatedPlaylists);
    localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
    setNewPlaylistName("");
    setShowCreatePlaylist(false);
  };

  const deletePlaylist = (playlistId: string) => {
    const updatedPlaylists = playlists.filter(p => p.id !== playlistId);
    setPlaylists(updatedPlaylists);
    localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
    if (selectedPlaylist === playlistId) {
      setSelectedPlaylist(null);
    }
  };

  const addToPlaylist = (playlistId: string, stationId: string) => {
    const updatedPlaylists = playlists.map(p => {
      if (p.id === playlistId && !p.stationIds.includes(stationId)) {
        return { ...p, stationIds: [...p.stationIds, stationId] };
      }
      return p;
    });
    setPlaylists(updatedPlaylists);
    localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
  };

  const removeFromPlaylist = (playlistId: string, stationId: string) => {
    const updatedPlaylists = playlists.map(p => {
      if (p.id === playlistId) {
        return { ...p, stationIds: p.stationIds.filter(id => id !== stationId) };
      }
      return p;
    });
    setPlaylists(updatedPlaylists);
    localStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
  };

  const removeFromSaved = (stationId: string) => {
    const savedIds = JSON.parse(localStorage.getItem('savedStations') || '[]');
    const updatedIds = savedIds.filter((id: string) => id !== stationId);
    localStorage.setItem('savedStations', JSON.stringify(updatedIds));
    setSavedStations(prev => prev.filter(s => s.stationuuid !== stationId));
  };

  const displayedStations = selectedPlaylist
    ? savedStations.filter(s => 
        playlists.find(p => p.id === selectedPlaylist)?.stationIds.includes(s.stationuuid)
      )
    : savedStations;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Playlists Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Your Playlists</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreatePlaylist(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Playlist
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedPlaylist === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPlaylist(null)}
            className="gap-2"
          >
            <Heart className="w-4 h-4" />
            All Saved ({savedStations.length})
          </Button>
          {playlists.map(playlist => (
            <div key={playlist.id} className="relative group">
              <Button
                variant={selectedPlaylist === playlist.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPlaylist(playlist.id)}
                className="gap-2 pr-8"
              >
                <Folder className="w-4 h-4" />
                {playlist.name} ({playlist.stationIds.length})
              </Button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deletePlaylist(playlist.id);
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Stations List */}
      <div className="space-y-3">
        {displayedStations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No saved stations yet</p>
            <p className="text-sm">Heart a station while listening to save it here</p>
          </div>
        ) : (
          displayedStations.map(station => (
            <div
              key={station.stationuuid}
              className="flex items-center gap-4 p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
            >
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onPlayStation(station)}
                className="shrink-0"
              >
                <Play className="w-5 h-5" />
              </Button>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{station.name}</p>
                <p className="text-sm text-muted-foreground">
                  {station.country ? `${getCountryFlag(station.countrycode)} ${station.country}` : 'Unknown location'}
                </p>
              </div>

              {/* Add to playlist dropdown */}
              {playlists.length > 0 && (
                <select
                  className="text-xs bg-muted border border-border rounded px-2 py-1"
                  onChange={(e) => {
                    if (e.target.value) {
                      addToPlaylist(e.target.value, station.stationuuid);
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Add to...</option>
                  {playlists.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

              {selectedPlaylist && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeFromPlaylist(selectedPlaylist, station.stationuuid)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}

              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeFromSaved(station.stationuuid)}
                className="text-accent hover:text-destructive"
              >
                <Heart className="w-4 h-4 fill-current" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Create Playlist Dialog */}
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreatePlaylist(false)}>
                Cancel
              </Button>
              <Button onClick={createPlaylist}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavedStations;
