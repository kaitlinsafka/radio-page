import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Radio as RadioIcon, Heart, Share2, ArrowRight, Loader2, Headphones } from "lucide-react";
import { toast } from "sonner";
import { RadioStation } from "@/services/radioBrowserApi";

const SharePlaylist = () => {
    const { id } = useParams();
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [playlist, setPlaylist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        const fetchPlaylist = async () => {
            try {
                const { data, error } = await supabase
                    .from('shared_playlists')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setPlaylist(data);
            } catch (err) {
                console.error("Error fetching playlist:", err);
                toast.error("Playlist not found");
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchPlaylist();
    }, [id]);

    const handleImport = async () => {
        if (!user) {
            if (id) {
                sessionStorage.setItem('returnToShare', id);
                toast.info("Please sign in or create an account to save this collection!");
                navigate("/auth");
            }
            return;
        }

        setImporting(true);
        try {
            const stations = playlist.stations as RadioStation[];

            // Batch insert into saved_stations
            const insertData = stations.map(s => ({
                user_id: user.id,
                station_uuid: s.stationuuid,
                station_data: s,
                is_shared: true,
                shared_from_user_id: playlist.user_id
            }));

            const { error } = await supabase
                .from('saved_stations')
                .insert(insertData);

            if (error) throw error;

            // ALSO create a local playlist entry so it appears as a group in the UI
            // This satisfies the user expectation of seeing a "Playlist" folder
            const localPlaylists = JSON.parse(localStorage.getItem('playlists') || '[]');
            const newPlaylist = {
                id: `imported-${Date.now()}`,
                name: playlist.title || "Imported Playlist",
                stationIds: stations.map(s => s.stationuuid)
            };
            localStorage.setItem('playlists', JSON.stringify([...localPlaylists, newPlaylist]));

            toast.success("Playlist added to your library!");
            navigate("/radio");
        } catch (err) {
            console.error("Import error:", err);
            toast.error("Failed to import playlist");
        } finally {
            setImporting(false);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F9FB]">
                <RadioIcon className="w-16 h-16 animate-pulse text-[#331F21]" />
                <p className="mt-4 font-bold text-[#331F21] uppercase tracking-widest">Tuning In...</p>
            </div>
        );
    }

    if (!playlist) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F9FB] p-6 text-center">
                <X className="w-16 h-16 text-destructive mb-4" />
                <h1 className="text-2xl font-black text-[#331F21]">PLAYLIST NOT FOUND</h1>
                <Button variant="outline" onClick={() => navigate("/radio")} className="mt-6">
                    Return to Radio
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9F9FB] flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-2xl bg-white border-4 border-[#331F21] rounded-[2.5rem] p-10 shadow-[12px_12px_0_#331F21] relative overflow-hidden">
                {/* Background Decorative Element */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#D3E1E6] rounded-full opacity-20" />

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-[#E9EFE4] rounded-2xl flex items-center justify-center border-4 border-[#331F21] shadow-[4px_4px_0_#331F21]">
                            <Share2 className="w-7 h-7 text-[#331F21]" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-[#331F21] tracking-tighter uppercase leading-none">
                                Shared Collection
                            </h1>
                            <p className="text-[#331F21]/60 font-medium">Someone wants to share their music taste with you!</p>
                        </div>
                    </div>

                    <div className="bg-[#F9F9FB] border-4 border-[#331F21] rounded-3xl p-6 mb-8 shadow-inner">
                        <h2 className="text-lg font-black text-[#331F21] mb-4 flex items-center gap-2">
                            <Headphones className="w-5 h-5" />
                            {playlist.stations.length} STATIONS IN THIS SET
                        </h2>

                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {playlist.stations.map((station: RadioStation) => (
                                <div
                                    key={station.stationuuid}
                                    className="bg-white border-2 border-[#331F21] p-3 rounded-xl flex items-center justify-between"
                                >
                                    <span className="font-bold text-sm truncate pr-4">{station.name}</span>
                                    <span className="text-[10px] bg-[#D3E1E6] px-2 py-1 rounded-full font-black uppercase whitespace-nowrap">
                                        {station.tags?.split(',')[0]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button
                            onClick={handleImport}
                            disabled={importing}
                            className="flex-1 bg-[#331F21] hover:bg-[#4a2f32] text-white py-8 rounded-2xl text-lg font-black shadow-[6px_6px_0_#D3E1E6] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                            {importing ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                <>
                                    <Heart className="w-6 h-6 fill-current" />
                                    IMPORT TO MY LIBRARY
                                </>
                            )}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => navigate("/radio")}
                            className="px-8 border-4 border-[#331F21] rounded-2xl font-black uppercase text-[#331F21]"
                        >
                            Skip
                        </Button>
                    </div>

                    {!user && (
                        <p className="mt-6 text-center text-xs font-bold text-[#331F21]/40 uppercase tracking-widest">
                            You'll be asked to create a quick account to claim this set
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const X = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

export default SharePlaylist;
