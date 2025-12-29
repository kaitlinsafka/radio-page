import { useState, useEffect } from "react";
import { Heart, Plus, Folder, Play, Trash2, X, Share2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type RadioStation, getCountryFlag } from "@/services/radioBrowserApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useSavedLibrary } from "@/hooks/useSavedLibrary";
import { toast } from "sonner";

interface Playlist {
  id: string;
  name: string;
  stationIds: string[];
}

interface SavedStationsProps {
  onPlayStation: (station: RadioStation) => void;
}

const SavedStations = ({ onPlayStation }: SavedStationsProps) => {
  const { user } = useAuth();
  const { savedStations: hookSavedStations, removeStation } = useSavedLibrary();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [stationToDelete, setStationToDelete] = useState<RadioStation | null>(null);
  const [sharedStations, setSharedStations] = useState<RadioStation[]>([]);

  // Direct derivation from hook (Optimized for speed)
  const savedStations = user
    ? hookSavedStations
    : (function () {
      // Guest mode fallback (read directly during render or use a simple state if needed, but for now we'll read lazily or wrapped)
      // Actually, for guest mode (localStorage), we might need state since it's not a hook.
      // Let's keep a separate state for GUEST mode, but use hook data for AUTH mode.
      try {
        const savedIds = JSON.parse(localStorage.getItem('savedStations') || '[]');
        const stationsData = JSON.parse(localStorage.getItem('savedStationsData') || '[]');
        return stationsData.filter((s: RadioStation) => savedIds.includes(s.stationuuid));
      } catch { return []; }
    })();

  // If we are strictly in guest mode, we might need a forceUpdate to detect localStorage changes,
  // but for the user's issue (Auth mode), this direct assignment works best.
  // To handle guest mode reactive updates properly without useEffect syncing 'user' data:

  const [guestStations, setGuestStations] = useState<RadioStation[]>([]);

  useEffect(() => {
    if (!user) {
      try {
        const savedIds = JSON.parse(localStorage.getItem('savedStations') || '[]');
        const stationsData = JSON.parse(localStorage.getItem('savedStationsData') || '[]');
        setGuestStations(stationsData.filter((s: RadioStation) => savedIds.includes(s.stationuuid)));
      } catch { setGuestStations([]); }
    }
  }, [user]); // Only run on mount or logout

  // Final consolidated list
  const finalSavedStations = user ? hookSavedStations : guestStations;

  useEffect(() => {
    // Load playlists
    const playlistsData = JSON.parse(localStorage.getItem('playlists') || '[]');
    setPlaylists(playlistsData);
  }, []);

  const handleShare = async () => {
    if (displayedStations.length === 0) {
      toast.error("No stations to share!");
      return;
    }

    setSharing(true);
    try {
      const title = selectedPlaylist
        ? playlists.find(p => p.id === selectedPlaylist)?.name || "My Playlist"
        : "My Radio Favorites";

      const { data, error } = await supabase
        .from('shared_playlists')
        .insert([{
          user_id: user?.id || null,
          title,
          stations: displayedStations
        }])
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error("No data returned");

      const shareUrl = `${window.location.origin}/share/${data.id}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard!");
    } catch (err: any) {
      console.error("Sharing error:", err);
      toast.error(err.message || "Failed to generate share link");
    } finally {
      setSharing(false);
    }
  };

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

  const confirmRemoveStation = () => {
    if (!stationToDelete) return;

    if (user) {
      removeStation(stationToDelete.stationuuid);
    } else {
      // Guest mode fallback
      const savedIds = JSON.parse(localStorage.getItem('savedStations') || '[]');
      const updatedIds = savedIds.filter((id: string) => id !== stationToDelete.stationuuid);
      localStorage.setItem('savedStations', JSON.stringify(updatedIds));
      setGuestStations(prev => prev.filter(s => s.stationuuid !== stationToDelete.stationuuid));
    }

    setStationToDelete(null);
    toast.success("Station removed from library");
  };

  const displayedStations = selectedPlaylist
    ? finalSavedStations.filter(s =>
      playlists.find(p => p.id === selectedPlaylist)?.stationIds.includes(s.stationuuid)
    )
    : finalSavedStations;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Playlists Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Your Playlists</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              disabled={sharing}
              className="gap-2 border-primary/50"
            >
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Share Set
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreatePlaylist(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Station Playlist
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedPlaylist === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPlaylist(null)}
            className="gap-2"
          >
            <Heart className="w-4 h-4" />
            All Saved ({finalSavedStations.length})
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
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{station.name}</p>
                  {(station as any).isCloudShared && (
                    <span className="flex items-center gap-1 bg-[#D3E1E6] text-[#331F21] text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">
                      <Users className="w-2 h-2" /> Shared
                    </span>
                  )}
                </div>
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
                onClick={() => setStationToDelete(station)}
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
            <DialogTitle>Create New Station Playlist</DialogTitle>
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

      {/* Deletion Confirmation Alert */}
      <AlertDialog open={!!stationToDelete} onOpenChange={(open) => !open && setStationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Station?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{stationToDelete?.name}</strong> from your saved stations?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveStation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SavedStations;
