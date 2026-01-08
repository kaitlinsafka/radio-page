import {
    useState, useEffect,
    useCallback,
    useRef
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Radio, Check, X, ArrowLeft, Globe, Loader2, Trash2, RotateCcw, Search, ExternalLink, Play, Zap, Music, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AdminTagPicker from "@/components/AdminTagPicker";
import * as radioBrowserApi from "@/services/radioBrowserApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Admin = () => {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [requests, setRequests] = useState<any[]>([]);
    const [feedback, setFeedback] = useState<any[]>([]);
    const [bulkUrl, setBulkUrl] = useState("");
    const adChannelRef = useRef<any>(null);

    // Stable Ad Signal Channel for Admin
    useEffect(() => {
        console.log('[Admin] Initializing stable signal channel...');
        const channel = supabase.channel('ad-signals');

        channel.subscribe((status) => {
            console.log(`[Admin] Signal channel status: ${status}`);
        });

        adChannelRef.current = channel;

        return () => {
            console.log('[Admin] Tearing down signal channel');
            if (adChannelRef.current) {
                supabase.removeChannel(adChannelRef.current);
            }
        };
    }, []);
    const [history, setHistory] = useState<any[]>([]);
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [totalUsers, setTotalUsers] = useState(0);
    const [loading, setLoading] = useState(true);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchingData, setSearchingData] = useState(false);
    const [activeTab, setActiveTab] = useState<"community" | "curated" | "global">("community");
    const [searchType, setSearchType] = useState<"all" | "name" | "location" | "tags">("all");

    useEffect(() => {
        if (!authLoading && !profile?.is_admin) {
            toast.error("Unauthorized access");
            navigate("/radio");
        }
    }, [profile, authLoading, navigate]);

    useEffect(() => {
        const fetchAdminData = async () => {
            try {
                // 1. Fetch Users
                const { count: usersCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true });
                setTotalUsers(usersCount || 0);

                // 2. Fetch Pending Requests
                const { data: requestData } = await supabase
                    .from('station_requests')
                    .select('*')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });
                setRequests(requestData || []);

                // 3. Fetch Moderation History (Approved/Rejected)
                const { data: historyData } = await supabase
                    .from('station_requests')
                    .select('*')
                    .neq('status', 'pending')
                    .order('updated_at', { ascending: false })
                    .limit(200);
                setHistory(historyData || []);

                // 4. Fetch Feedback
                const { data: feedbackData } = await supabase
                    .from('station_feedback')
                    .select('*')
                    .order('created_at', { ascending: false });
                setFeedback(feedbackData || []);
            } catch (err: any) {
                console.error("Admin fetch error:", err);
                toast.error("Failed to fetch admin data: " + (err.message || "Unknown error"));
            } finally {
                setLoading(false);
            }
        };

        if (profile?.is_admin) fetchAdminData();
    }, [profile]);

    const handleFeedbackStatusToggle = async (feedbackId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'pending' ? 'solved' : 'pending';
        try {
            const { error } = await supabase
                .from('station_feedback')
                .update({ status: newStatus })
                .eq('id', feedbackId);

            if (error) throw error;

            setFeedback(prev => prev.map(f => f.id === feedbackId ? { ...f, status: newStatus } : f));
            toast.success(`Feedback marked as ${newStatus}`);
        } catch (err) {
            toast.error("Failed to update feedback status");
        }
    };

    const handleModeration = async (requestId: string, status: 'approved' | 'rejected') => {
        try {
            const moderatedRequest = [...requests, ...history, ...searchResults].find(r => r.id === requestId);
            if (!moderatedRequest) throw new Error("Station request not found");

            let updatedUrl = moderatedRequest.url;
            if (status === 'approved') {
                if (moderatedRequest.url.includes('internet-radio.com/proxy/') && !moderatedRequest.url.includes('?mp=/stream')) {
                    const cleanUrl = moderatedRequest.url.split(';')[0]; // Remove trailing ; if present
                    updatedUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}mp=/stream`;
                    console.log('Auto-corrected internet-radio proxy URL:', updatedUrl);
                }
                // Clean up semicolon if exists, if it wasn't already handled by the above logic
                updatedUrl = updatedUrl.replace(/;$/, '');
            }

            const { error } = await supabase
                .from('station_requests')
                .update({
                    status,
                    url: updatedUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (error) throw error;

            toast.success(`Station ${status}!`);

            // Move between local states
            const updatedItem = {
                ...moderatedRequest,
                status,
                url: updatedUrl,
                updated_at: new Date().toISOString()
            };

            setRequests(prev => prev.filter(r => r.id !== requestId));
            setHistory(prev => [updatedItem, ...prev.filter(r => r.id !== requestId)]);
            if (isSearching) {
                setSearchResults(prev => prev.map(r => r.id === requestId ? updatedItem : r));
            }
        } catch (err) {
            toast.error("Action failed");
        }
    };

    const handleSaveUrl = async (requestId: string, list: 'requests' | 'history' | 'search') => {
        try {
            const { error } = await supabase
                .from('station_requests')
                .update({ url: editValue, updated_at: new Date().toISOString() })
                .eq('id', requestId);

            if (error) throw error;

            const updateState = (prev: any[]) => prev.map(item =>
                item.id === requestId ? { ...item, url: editValue, updated_at: new Date().toISOString() } : item
            );

            if (list === 'requests') setRequests(updateState);
            else if (list === 'history') setHistory(updateState);
            else if (list === 'search') setSearchResults(updateState);

            setEditingId(null);
            toast.success("URL updated successfully");
        } catch (err) {
            toast.error("Failed to update URL");
        }
    };

    const handleUpdateTags = async (requestId: string, tags: string[], list: 'requests' | 'history' | 'search') => {
        // Clean and join
        const genreString = Array.from(new Set(tags.map(t => t.trim()).filter(Boolean))).join(", ");
        try {
            const { error } = await supabase
                .from('station_requests')
                .update({
                    genre: genreString,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (error) throw error;

            const updateList = (prev: any[]) => prev.map(r => r.id === requestId ? { ...r, genre: genreString } : r);
            if (list === 'requests') {
                // If it was in requests, just update it where it is
                setRequests(updateList);
            } else if (list === 'history') {
                // If it was in history, it might stay or move depending on how the UI filters it
                setHistory(updateList);
            }

            // Also update searching if needed
            if (isSearching) setSearchResults(updateList);

            toast.success("Tags updated");
        } catch (err) {
            toast.error("Failed to update tags");
        }
    };

    const handleDelete = async (requestId: string, list: 'requests' | 'history' | 'search') => {
        if (!confirm("Are you sure you want to permanently delete this request?")) return;

        try {
            const { error } = await supabase
                .from('station_requests')
                .delete()
                .eq('id', requestId);

            if (error) throw error;

            const filterList = (prev: any[]) => prev.filter(r => r.id !== requestId);
            if (list === 'requests') setRequests(filterList);
            else if (list === 'history') setHistory(filterList);

            if (isSearching) setSearchResults(filterList);

            toast.success("Request deleted");
        } catch (err) {
            toast.error("Delete failed");
        }
    };

    const handleResetToPending = async (requestId: string) => {
        try {
            const { error } = await supabase
                .from('station_requests')
                .update({ status: 'pending', updated_at: new Date().toISOString() })
                .eq('id', requestId);

            if (error) throw error;

            const restoredRequest = [...history, ...searchResults].find(r => r.id === requestId);
            if (restoredRequest) {
                const updatedItem = { ...restoredRequest, status: 'pending' };
                setHistory(prev => prev.filter(r => r.id !== requestId));
                setRequests(prev => [updatedItem, ...prev.filter(r => r.id !== requestId)]);
                if (isSearching) {
                    setSearchResults(prev => prev.map(r => r.id === requestId ? updatedItem : r));
                }
            }

            toast.success("Returned to queue");
        } catch (err) {
            toast.error("Reset failed");
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setIsSearching(false);
            setSearchResults([]);
            setGlobalSearchResults([]);
            return;
        }

        setSearchingData(true);
        setIsSearching(true);
        try {
            // Build Local Query based on type
            let localQuery = supabase.from('station_requests').select('*');

            if (searchType === 'name') {
                localQuery = localQuery.ilike('name', `%${searchQuery}%`);
            } else if (searchType === 'location') {
                localQuery = localQuery.or(`city.ilike.%${searchQuery}%,country.ilike.%${searchQuery}%`);
            } else if (searchType === 'tags') {
                localQuery = localQuery.ilike('genre', `%${searchQuery}%`);
            } else {
                localQuery = localQuery.or(`name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,country.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%`);
            }

            const { data: localData, error: localError } = await localQuery.order('created_at', { ascending: false });

            if (localError) throw localError;
            setSearchResults(localData || []);

            // Search Global Directory based on type
            let globalData: radioBrowserApi.RadioStation[] = [];
            if (searchType === 'name') {
                globalData = await radioBrowserApi.searchStationsByName(searchQuery);
            } else if (searchType === 'location') {
                globalData = await radioBrowserApi.searchStationsByLocation(searchQuery);
            } else if (searchType === 'tags') {
                globalData = await radioBrowserApi.searchStationsByTag(searchQuery);
            } else {
                globalData = await radioBrowserApi.searchStationsByName(searchQuery);
            }

            setGlobalSearchResults(globalData || []);

            // Smart Tab Switching
            const hasCommunity = localData?.some(r => r.is_user_submission !== false);
            const hasCurated = localData?.some(r => r.is_user_submission === false);

            if (hasCommunity) setActiveTab("community");
            else if (hasCurated) setActiveTab("curated");
            else if (globalData?.length > 0) setActiveTab("global");
            else setActiveTab("community");

        } catch (err) {
            toast.error("Search failed");
            console.error(err);
        } finally {
            setSearchingData(false);
        }
    };

    const handleImportFromGlobal = async (station: radioBrowserApi.RadioStation) => {
        try {
            // Check if already imported
            const { data: existing } = await supabase
                .from('station_requests')
                .select('id')
                .eq('stationuuid', station.stationuuid)
                .single();

            if (existing) {
                toast.info("This station is already in your curated library");
                setActiveTab("curated");
                return;
            }

            const cleanTags = station.tags ?
                Array.from(new Set(station.tags.split(/,\s*/).map(t => t.trim()).filter(Boolean))).join(", ")
                : "";

            let url = station.url_resolved;
            if (url.includes('internet-radio.com/proxy')) {
                if (!url.includes('?mp=/stream') && !url.includes('&mp=/stream')) {
                    const separator = url.includes('?') ? '&' : '?';
                    url = url + separator + 'mp=/stream';
                }
                url = url.replace(/;$/, '');
            }

            const { data, error } = await supabase
                .from('station_requests')
                .insert([{
                    name: station.name,
                    url: url,
                    genre: cleanTags,
                    city: "",
                    country: station.country,
                    status: 'approved',
                    user_id: profile?.id,
                    is_user_submission: false,
                    stationuuid: station.stationuuid,
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            toast.success(`${station.name} added to Tag Management!`);

            // Add to results and history state locally
            setHistory(prev => [data, ...prev]);
            setSearchResults(prev => [data, ...prev]);
            setActiveTab("curated");
        } catch (err) {
            toast.error("Import failed");
            console.error(err);
        }
    };

    const sendAdSignal = async (type: 'AD_DETECTED' | 'AD_FINISHED') => {
        console.log(`[Admin] Broadcaster triggered: ${type}`);
        const channel = adChannelRef.current;

        if (!channel) {
            console.error('[Admin] No signal channel available!');
            toast.error("Signal channel not ready");
            return;
        }

        try {
            const response = await channel.send({
                type: 'broadcast',
                event: type,
                payload: {
                    timestamp: new Date().toISOString(),
                    source: 'admin_panel_sim'
                }
            });
            console.log(`[Admin] Broadcast response:`, response);
            if (response === 'ok' || response === 'sent') {
                toast.success(`Signal ${type} sent!`);
            } else {
                toast.error(`Signal failed: ${response}`);
            }
        } catch (err) {
            console.error('[Admin] Broadcast error:', err);
            toast.error("Failed to broadcast signal");
        }
    };

    const clearSearch = () => {
        setSearchQuery("");
        setIsSearching(false);
        setSearchResults([]);
        setGlobalSearchResults([]);
    };

    if (authLoading || (!profile?.is_admin && loading)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9F9FB]">
                <Radio className="w-12 h-12 animate-pulse text-[#331F21]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9F9FB] flex flex-col">
            <header className="bg-white border-b-4 border-[#331F21] p-6 sticky top-0 z-10">
                <div className="container max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Button variant="ghost" onClick={() => navigate("/radio")} className="hover:bg-[#D3E1E6]">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-2xl font-black text-[#331F21] uppercase tracking-tighter shrink-0">
                            Admin Portal
                        </h1>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.location.reload()}
                            className="ml-auto border-2 border-[#331F21]/10 w-10 h-10 rounded-xl hover:bg-[#D3E1E6]"
                            title="Refresh Dashboard"
                        >
                            <RotateCcw className="w-5 h-5 text-[#331F21]" />
                        </Button>
                    </div>

                    <div className="flex gap-2 ml-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendAdSignal('AD_DETECTED')}
                            className="border-2 border-yellow-500 text-yellow-600 font-black uppercase text-[10px] gap-2 h-8 hover:bg-yellow-50"
                        >
                            <Zap className="w-3 h-3" />
                            Sim Ad Start
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendAdSignal('AD_FINISHED')}
                            className="border-2 border-green-500 text-green-600 font-black uppercase text-[10px] gap-2 h-8 hover:bg-green-50"
                        >
                            <Music className="w-3 h-3" />
                            Sim Ad End
                        </Button>
                    </div>

                    <form onSubmit={handleSearch} className="flex-1 max-w-3xl w-full flex items-center gap-2">
                        <Select value={searchType} onValueChange={(v) => setSearchType(v as any)}>
                            <SelectTrigger className="w-[140px] h-11 border-2 border-[#331F21] rounded-xl font-bold uppercase text-[10px] bg-white">
                                <SelectValue placeholder="Search by..." />
                            </SelectTrigger>
                            <SelectContent className="border-2 border-[#331F21] rounded-xl">
                                <SelectItem value="all" className="font-bold uppercase text-[10px]">Everything</SelectItem>
                                <SelectItem value="name" className="font-bold uppercase text-[10px]">Station Name</SelectItem>
                                <SelectItem value="location" className="font-bold uppercase text-[10px]">Location</SelectItem>
                                <SelectItem value="tags" className="font-bold uppercase text-[10px]">Tags/Genres</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#331F21]/40" />
                            <Input
                                placeholder={
                                    searchType === 'name' ? "Search for a station name..." :
                                        searchType === 'location' ? "Search for city or country..." :
                                            searchType === 'tags' ? "Search for genres or keywords..." :
                                                "Search by name, city, country, or tags..."
                                }
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 border-2 border-[#331F21] rounded-xl focus:ring-[#331F21]/10 bg-[#F9F9FB] font-medium"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="bg-[#331F21] text-white hover:bg-[#331F21]/90 rounded-xl px-6 h-11 uppercase font-black tracking-widest text-xs"
                        >
                            Search
                        </Button>
                        {isSearching && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={clearSearch}
                                className="h-11 border-2 border-[#331F21]/10 rounded-xl px-4 uppercase font-bold text-[10px]"
                            >
                                <X className="w-4 h-4 mr-2" />
                                Clear
                            </Button>
                        )}
                    </form>

                    <div className="hidden lg:flex items-center gap-2">
                        <div className="bg-[#D3E1E6] border-2 border-[#331F21] px-4 py-1 rounded-full text-xs font-bold text-[#331F21]">
                            SYSTEM ADMIN: {profile?.name}
                        </div>
                    </div>
                </div>
            </header>

            <main className="container max-w-7xl mx-auto p-6 md:p-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    {/* Stats Cards */}
                    <div className="bg-white border-4 border-[#331F21] p-6 rounded-2xl shadow-[6px_6px_0_#331F21]">
                        <Users className="w-8 h-8 text-[#331F21] mb-2" />
                        <h3 className="text-xs font-black opacity-50 uppercase tracking-widest">Total Community Members</h3>
                        <p className="text-3xl font-black text-[#331F21]">{totalUsers}</p>
                    </div>
                    <div className="bg-[#E9EFE4] border-4 border-[#331F21] p-6 rounded-2xl shadow-[6px_6px_0_#331F21]">
                        <Radio className="w-8 h-8 text-[#331F21] mb-2" />
                        <h3 className="text-xs font-black opacity-50 uppercase tracking-widest">Pending Moderation</h3>
                        <p className="text-3xl font-black text-[#331F21]">{requests.length}</p>
                    </div>
                    <div className="bg-[#D3E1E6] border-4 border-[#331F21] p-6 rounded-2xl shadow-[6px_6px_0_#331F21]">
                        <MessageSquare className="w-8 h-8 text-[#331F21] mb-2" />
                        <h3 className="text-xs font-black opacity-50 uppercase tracking-widest">Station Reports</h3>
                        <p className="text-3xl font-black text-[#331F21]">{feedback.length}</p>
                    </div>
                </div>

                {/* Conditional Search Results or Main View */}
                {isSearching ? (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-[#331F21] uppercase">Search Results: {searchQuery}</h2>
                            <Button onClick={clearSearch} variant="ghost" className="font-black text-[10px] uppercase">BACK TO DASHBOARD</Button>
                        </div>

                        {searchingData ? (
                            <div className="flex justify-center py-24">
                                <Loader2 className="w-12 h-12 animate-spin text-[#331F21]" />
                            </div>
                        ) : (
                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                                <TabsList className="bg-[#331F21]/5 p-1 border-2 border-[#331F21] rounded-xl h-auto mb-8">
                                    <TabsTrigger
                                        value="community"
                                        className="rounded-lg px-6 py-2 font-black uppercase text-[10px] data-[state=active]:bg-[#331F21] data-[state=active]:text-white"
                                    >
                                        Submissions ({searchResults.filter(r => r.is_user_submission !== false).length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="curated"
                                        className="rounded-lg px-6 py-2 font-black uppercase text-[10px] data-[state=active]:bg-[#331F21] data-[state=active]:text-white"
                                    >
                                        Tag Management ({searchResults.filter(r => r.is_user_submission === false).length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="global"
                                        className="rounded-lg px-6 py-2 font-black uppercase text-[10px] data-[state=active]:bg-[#331F21] data-[state=active]:text-white"
                                    >
                                        Discovery ({globalSearchResults.length})
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="community" className="mt-0">
                                    {searchResults.filter(r => r.is_user_submission !== false).length === 0 ? (
                                        <div className="bg-white border-4 border-[#331F21] rounded-3xl p-24 flex flex-col items-center justify-center text-center opacity-40">
                                            <Users className="w-20 h-20 mb-6" />
                                            <p className="font-black text-2xl uppercase">No submissions found</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {searchResults.filter(r => r.is_user_submission !== false).map(req => (
                                                <div key={req.id} className="bg-white border-4 border-[#331F21] p-6 rounded-2xl flex flex-col gap-6 shadow-[4px_4px_0_#331F21]">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-black text-[#331F21] uppercase text-lg leading-tight">{req.name}</h4>
                                                                <span className={cn(
                                                                    "text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0",
                                                                    req.status === 'approved' ? "bg-green-100 text-green-700" :
                                                                        req.status === 'rejected' ? "bg-red-100 text-red-700" :
                                                                            "bg-blue-100 text-blue-700"
                                                                )}>
                                                                    {req.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-bold text-[#331F21]/60 uppercase tracking-wider mb-2">
                                                                {req.city}, {req.country}
                                                            </p>
                                                            {req.profiles?.name && (
                                                                <p className="text-[10px] font-bold text-[#331F21]/40 uppercase mb-2">
                                                                    Requested by: {req.profiles.name}
                                                                </p>
                                                            )}
                                                            <code className="bg-[#F9F9FB] p-2 rounded text-[10px] break-all border border-[#331F21]/10 block w-full">
                                                                {req.url}
                                                            </code>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            {req.status !== 'approved' && (
                                                                <Button
                                                                    size="icon"
                                                                    className="bg-[#E9EFE4] border-2 border-[#331F21] text-[#331F21] hover:bg-green-100 w-8 h-8"
                                                                    onClick={() => handleModeration(req.id, 'approved')}
                                                                    title="Approve"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            {req.status !== 'rejected' && (
                                                                <Button
                                                                    size="icon"
                                                                    variant="destructive"
                                                                    className="border-2 border-[#331F21] text-white w-8 h-8"
                                                                    onClick={() => handleModeration(req.id, 'rejected')}
                                                                    title="Reject"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            {req.status !== 'pending' && (
                                                                <Button
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="border-2 border-[#331F21] text-[#331F21] w-8 h-8"
                                                                    onClick={() => handleResetToPending(req.id)}
                                                                    title="Reset to Pending"
                                                                >
                                                                    <RotateCcw className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="border-2 border-[#331F21] text-[#331F21] hover:bg-[#D3E1E6] w-8 h-8"
                                                                onClick={() => {
                                                                    const params = new URLSearchParams({
                                                                        name: req.name,
                                                                        url: req.url,
                                                                        country: req.country || ""
                                                                    });
                                                                    window.open(`/radio?${params.toString()}`, "_blank");
                                                                }}
                                                                title="Play in New Tab"
                                                            >
                                                                <Play className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="border-2 border-[#331F21] text-[#331F21] hover:bg-red-50 w-8 h-8"
                                                                onClick={() => handleDelete(req.id, 'search')}
                                                                title="Delete Permanently"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t-2 border-[#331F21]/5">
                                                        <p className="text-[10px] font-black uppercase text-[#331F21]/40 mb-3 tracking-widest">Station Tags</p>
                                                        <AdminTagPicker
                                                            selectedTags={req.genre ? req.genre.split(/,\s*/).filter(Boolean) : []}
                                                            onTagsChange={(newTags) => handleUpdateTags(req.id, newTags, 'search')}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="curated" className="mt-0">
                                    {searchResults.filter(r => r.is_user_submission === false).length === 0 ? (
                                        <div className="bg-white border-4 border-[#331F21] rounded-3xl p-24 flex flex-col items-center justify-center text-center opacity-40">
                                            <Radio className="w-20 h-20 mb-6" />
                                            <p className="font-black text-2xl uppercase">No stations being managed</p>
                                            <p className="font-bold underline decoration-2 underline-offset-4 mt-2">Edit tags on a station to see it here</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {searchResults.filter(r => r.is_user_submission === false).map(req => (
                                                <div key={req.id} className="bg-white border-4 border-[#331F21] p-6 rounded-2xl flex flex-col gap-6 shadow-[4px_4px_0_#331F21]">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-black text-[#331F21] uppercase text-lg leading-tight">{req.name}</h4>
                                                                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0 bg-purple-100 text-purple-700">
                                                                    CURATED
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-bold text-[#331F21]/60 uppercase tracking-wider mb-3">
                                                                {req.city}, {req.country}
                                                            </p>
                                                            <code className="bg-[#F9F9FB] p-2 rounded text-[10px] break-all border border-[#331F21]/10 block w-full">
                                                                {req.url}
                                                            </code>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="border-2 border-[#331F21] text-[#331F21] hover:bg-[#D3E1E6] w-8 h-8"
                                                                onClick={() => {
                                                                    const params = new URLSearchParams({
                                                                        name: req.name,
                                                                        url: req.url,
                                                                        country: req.country || ""
                                                                    });
                                                                    window.open(`/radio?${params.toString()}`, "_blank");
                                                                }}
                                                                title="Play in New Tab"
                                                            >
                                                                <Play className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="border-2 border-[#331F21] text-[#331F21] hover:bg-red-50 w-8 h-8"
                                                                onClick={() => handleDelete(req.id, 'search')}
                                                                title="Delete Permanently"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t-2 border-[#331F21]/5">
                                                        <p className="text-[10px] font-black uppercase text-[#331F21]/40 mb-3 tracking-widest">Station Tags</p>
                                                        <AdminTagPicker
                                                            selectedTags={req.genre ? req.genre.split(/,\s*/).filter(Boolean) : []}
                                                            onTagsChange={(newTags) => handleUpdateTags(req.id, newTags, 'search')}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="global" className="mt-0">
                                    {globalSearchResults.length === 0 ? (
                                        <div className="bg-white border-4 border-[#331F21] rounded-3xl p-24 flex flex-col items-center justify-center text-center opacity-40">
                                            <Globe className="w-20 h-20 mb-6" />
                                            <p className="font-black text-2xl uppercase">No global matches</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {globalSearchResults.map(station => {
                                                const isImported = searchResults.some(r => r.stationuuid === station.stationuuid);
                                                return (
                                                    <div key={station.stationuuid} className="bg-white border-2 border-[#331F21]/10 p-6 rounded-2xl flex flex-col gap-4 hover:border-[#331F21]/30 transition-colors">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1">
                                                                <h4 className="font-bold text-[#331F21] uppercase text-base leading-tight mb-1">{station.name}</h4>
                                                                <p className="text-[10px] font-bold text-[#331F21]/60 uppercase tracking-wider mb-2">
                                                                    {station.country}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="border-2 border-[#331F21] text-[#331F21] hover:bg-[#D3E1E6] font-black uppercase text-[10px] h-8 px-2"
                                                                    onClick={() => {
                                                                        const params = new URLSearchParams({
                                                                            name: station.name,
                                                                            url: station.url_resolved,
                                                                            country: station.country || ""
                                                                        });
                                                                        window.open(`/radio?${params.toString()}`, "_blank");
                                                                    }}
                                                                    title="Preview in New Tab"
                                                                >
                                                                    <Play className="w-3 h-3" />
                                                                </Button>
                                                                {!isImported && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-[#331F21] text-white hover:bg-[#331F21]/90 font-black uppercase text-[10px] h-8"
                                                                        onClick={() => handleImportFromGlobal(station)}
                                                                    >
                                                                        Add for Tagging
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <code className="bg-[#F9F9FB] p-2 rounded text-[9px] break-all border border-[#331F21]/5 block w-full opacity-60">
                                                            {station.url_resolved}
                                                        </code>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        )}
                    </div>
                ) : (
                    <Tabs defaultValue="moderation" className="space-y-8 animate-in fade-in duration-500">
                        <TabsList className="bg-[#331F21]/5 p-1 border-2 border-[#331F21] rounded-xl h-auto">
                            <TabsTrigger
                                value="moderation"
                                className="rounded-lg px-8 py-2 font-black uppercase text-xs data-[state=active]:bg-[#331F21] data-[state=active]:text-white"
                            >
                                Moderation Hub
                            </TabsTrigger>
                            <TabsTrigger
                                value="curated"
                                className="rounded-lg px-8 py-2 font-black uppercase text-xs data-[state=active]:bg-[#331F21] data-[state=active]:text-white"
                            >
                                Tag Management
                            </TabsTrigger>
                            <TabsTrigger
                                value="feedback"
                                className="rounded-lg px-8 py-2 font-black uppercase text-xs data-[state=active]:bg-[#331F21] data-[state=active]:text-white"
                            >
                                Station Feedback
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="moderation" className="mt-0">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                                {/* Moderation Queue */}
                                <div className="lg:col-span-2 space-y-6">
                                    <h2 className="text-xl font-black text-[#331F21] uppercase flex items-center gap-3">
                                        <Radio className="w-6 h-6" />
                                        Pending Queue ({requests.length})
                                    </h2>

                                    {loading ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#331F21]" />
                                        </div>
                                    ) : requests.length === 0 ? (
                                        <div className="bg-white border-4 border-[#331F21] rounded-2xl p-12 flex flex-col items-center justify-center text-center opacity-40">
                                            <Radio className="w-16 h-16 mb-4" />
                                            <p className="font-bold">Queue is empty</p>
                                            <p className="text-xs">No pending local station requests at this time.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {requests.map(req => (
                                                <div key={req.id} className="bg-white border-4 border-[#331F21] p-6 rounded-2xl flex flex-col gap-6 shadow-[4px_4px_0_#331F21]">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <h4 className="font-black text-[#331F21] uppercase text-lg">{req.name}</h4>
                                                            <p className="text-xs font-bold text-[#331F21]/60 uppercase tracking-wider mb-2">
                                                                {req.city}, {req.country}
                                                            </p>
                                                            {req.profiles?.name && (
                                                                <p className="text-[10px] font-bold text-[#331F21]/40 uppercase mb-2">
                                                                    Requested by: {req.profiles.name}
                                                                </p>
                                                            )}
                                                            {editingId === req.id ? (
                                                                <div className="flex gap-2 mt-2">
                                                                    <Input
                                                                        value={editValue}
                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                        className="h-8 text-[10px] border-2 border-[#331F21]"
                                                                    />
                                                                    <Button size="sm" onClick={() => handleSaveUrl(req.id, 'requests')} className="h-8 bg-[#331F21] text-white">Save</Button>
                                                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 border-2 border-[#331F21]">Cancel</Button>
                                                                </div>
                                                            ) : (
                                                                <div className="group relative mt-2">
                                                                    <code className="bg-[#F9F9FB] p-2 rounded text-[10px] break-all border border-[#331F21]/10 block w-fit max-w-full">
                                                                        {req.url}
                                                                    </code>
                                                                    <button
                                                                        onClick={() => { setEditingId(req.id); setEditValue(req.url); }}
                                                                        className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-white border border-[#331F21] rounded p-1 hover:bg-[#D3E1E6] transition-all"
                                                                        title="Edit URL"
                                                                    >
                                                                        <Zap className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2 ml-6">
                                                            <Button
                                                                size="icon"
                                                                className="bg-[#E9EFE4] border-2 border-[#331F21] text-[#331F21] hover:bg-green-100"
                                                                onClick={() => handleModeration(req.id, 'approved')}
                                                                title="Approve"
                                                            >
                                                                <Check className="w-5 h-5" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="destructive"
                                                                className="border-2 border-[#331F21] text-white"
                                                                onClick={() => handleModeration(req.id, 'rejected')}
                                                                title="Reject"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="border-2 border-[#331F21] text-[#331F21] hover:bg-red-50"
                                                                onClick={() => handleDelete(req.id, 'requests')}
                                                                title="Delete Permanently"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t-2 border-[#331F21]/5">
                                                        <AdminTagPicker
                                                            selectedTags={req.genre ? req.genre.split(/,\s*/).filter(Boolean) : []}
                                                            onTagsChange={(newTags) => handleUpdateTags(req.id, newTags, 'requests')}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Community History Sidebar */}
                                <div className="lg:col-span-1 space-y-6">
                                    <h2 className="text-xl font-black text-[#331F21] uppercase flex items-center gap-3">
                                        <Users className="w-6 h-6" />
                                        Community History
                                    </h2>

                                    {history.length === 0 ? (
                                        <div className="bg-white border-2 border-[#331F21]/20 rounded-2xl p-6 text-center opacity-60">
                                            <p className="text-xs font-bold uppercase">No history yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {history.map(item => (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        "bg-white border-2 rounded-xl shadow-sm space-y-4 transition-all duration-200 cursor-pointer overflow-hidden",
                                                        expandedHistoryId === item.id
                                                            ? "border-[#331F21] p-5 shadow-md"
                                                            : "border-[#331F21]/10 p-4 hover:border-[#331F21]/30"
                                                    )}
                                                    onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id)}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-bold text-[#331F21] text-sm uppercase truncate">{item.name}</h4>
                                                                {item.is_user_submission === false && (
                                                                    <span className="text-[7px] font-black uppercase bg-[#331F21] text-white px-1.5 py-0.5 rounded shrink-0">Curated</span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] font-bold text-[#331F21]/40 uppercase truncate">
                                                                {item.city}, {item.country}
                                                            </p>
                                                            {item.profiles?.name && (
                                                                <p className="text-[9px] font-bold text-[#331F21]/30 uppercase">
                                                                    By: {item.profiles.name}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2 ml-4">
                                                            <span className={cn(
                                                                "text-[10px] font-black uppercase px-2 py-0.5 rounded",
                                                                item.status === 'approved' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                            )}>
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {expandedHistoryId === item.id && (
                                                        <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between items-center">
                                                                    <p className="text-[8px] font-black uppercase text-[#331F21]/40">Stream URL</p>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditValue(item.url); }}
                                                                        className="text-[8px] font-black uppercase text-[#331F21]/60 hover:text-[#331F21] underline"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                </div>
                                                                {editingId === item.id ? (
                                                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                                        <Input
                                                                            value={editValue}
                                                                            onChange={(e) => setEditValue(e.target.value)}
                                                                            className="h-7 text-[9px] border-2 border-[#331F21]"
                                                                        />
                                                                        <Button size="sm" onClick={() => handleSaveUrl(item.id, 'history')} className="h-7 px-2 bg-[#331F21] text-white text-[9px]">Save</Button>
                                                                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 px-2 border-2 border-[#331F21] text-[9px]">X</Button>
                                                                    </div>
                                                                ) : (
                                                                    <code className="bg-[#F9F9FB] p-2 rounded text-[9px] break-all border border-[#331F21]/10 block w-full leading-relaxed">
                                                                        {item.url}
                                                                    </code>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center justify-between py-1">
                                                                <div className="space-y-0.5">
                                                                    <p className="text-[8px] font-black uppercase text-[#331F21]/40">Last Updated</p>
                                                                    <p className="text-[9px] font-bold text-[#331F21]/60">
                                                                        {new Date(item.updated_at).toLocaleString()}
                                                                    </p>
                                                                </div>

                                                                <div className="flex gap-1.5">
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="w-8 h-8 rounded-lg border border-[#331F21]/10 hover:bg-[#D3E1E6] hover:border-[#331F21]/30 transition-colors"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleResetToPending(item.id);
                                                                        }}
                                                                        title="Return to Queue"
                                                                    >
                                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="w-8 h-8 rounded-lg border border-red-100 bg-red-50/30 text-red-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDelete(item.id, 'history');
                                                                        }}
                                                                        title="Delete Permanently"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="pt-2 border-t border-dashed border-[#331F21]/10" onClick={(e) => e.stopPropagation()}>
                                                        <AdminTagPicker
                                                            selectedTags={item.genre ? item.genre.split(/,\s*/).filter(Boolean) : []}
                                                            onTagsChange={(newTags) => handleUpdateTags(item.id, newTags, 'history')}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="curated" className="mt-0">
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-black text-[#331F21] uppercase flex items-center gap-3">
                                        <Globe className="w-6 h-6" />
                                        Tag Management ({history.filter(h => h.is_user_submission === false).length})
                                    </h2>
                                    <p className="text-xs font-bold opacity-40 uppercase">Stations with manually managed tags</p>
                                </div>

                                {history.filter(h => h.is_user_submission === false).length === 0 ? (
                                    <div className="bg-white border-4 border-[#331F21] rounded-3xl p-24 flex flex-col items-center justify-center text-center opacity-40">
                                        <Globe className="w-20 h-20 mb-6" />
                                        <p className="font-black text-2xl uppercase">No curated tags yet</p>
                                        <p className="font-bold underline decoration-2 underline-offset-4 mt-2">Edit a station's tags to move it here</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                        {history.filter(h => h.is_user_submission === false).map(item => (
                                            <div key={item.id} className="bg-white border-4 border-[#331F21] p-6 rounded-2xl flex flex-col gap-6 shadow-[4px_4px_0_#331F21]">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <h4 className="font-black text-[#331F21] uppercase text-lg leading-tight mb-1">{item.name}</h4>
                                                        <p className="text-xs font-bold text-[#331F21]/60 uppercase tracking-wider mb-2">
                                                            {item.city}, {item.country}
                                                        </p>
                                                        <code className="bg-[#F9F9FB] p-2 rounded text-[10px] break-all border border-[#331F21]/10 block w-full">
                                                            {item.url}
                                                        </code>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="border-2 border-[#331F21] text-[#331F21] hover:bg-[#D3E1E6] w-8 h-8"
                                                            onClick={() => {
                                                                const params = new URLSearchParams({
                                                                    name: item.name,
                                                                    url: item.url,
                                                                    country: item.country || ""
                                                                });
                                                                window.open(`/radio?${params.toString()}`, "_blank");
                                                            }}
                                                            title="Play in New Tab"
                                                        >
                                                            <Play className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="border-2 border-[#331F21] text-[#331F21] hover:bg-red-50 w-8 h-8"
                                                            onClick={() => handleDelete(item.id, 'history')}
                                                            title="Delete Permanently"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="pt-4 border-t-2 border-[#331F21]/5">
                                                    <AdminTagPicker
                                                        selectedTags={item.genre ? item.genre.split(/,\s*/).filter(Boolean) : []}
                                                        onTagsChange={(newTags) => handleUpdateTags(item.id, newTags, 'history')}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="feedback" className="mt-0">
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-black text-[#331F21] uppercase flex items-center gap-3">
                                        <MessageSquare className="w-6 h-6" />
                                        Station Feedback Queue ({feedback.length})
                                    </h2>
                                    <p className="text-xs font-bold opacity-40 uppercase">User-submitted quality reports</p>
                                </div>

                                {feedback.length === 0 ? (
                                    <div className="bg-white border-4 border-[#331F21] rounded-3xl p-24 flex flex-col items-center justify-center text-center opacity-40">
                                        <MessageSquare className="w-20 h-20 mb-6" />
                                        <p className="font-black text-2xl uppercase">No feedback reported</p>
                                        <p className="font-bold mt-2">Everything sounds great! 🎉</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {feedback.map(item => (
                                            <div key={item.id} className={cn(
                                                "bg-white border-4 border-[#331F21] p-6 rounded-2xl flex flex-col gap-4 shadow-[4px_4px_0_#331F21] transition-all",
                                                item.status === 'solved' ? "opacity-60" : "opacity-100"
                                            )}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h4 className="font-black text-[#331F21] uppercase text-lg leading-tight">{item.station_name}</h4>
                                                            <span className={cn(
                                                                "text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0",
                                                                item.status === 'solved' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                                                            )}>
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="text-[10px] font-bold text-[#331F21]/40 uppercase tracking-widest bg-[#F9F9FB] px-2 py-0.5 rounded border border-[#331F21]/5">
                                                                {item.category === 'genre_mismatch' ? 'Genre Mismatch' : 'Other'}
                                                            </span>
                                                            <span className="text-[10px] font-medium text-[#331F21]/40">
                                                                {new Date(item.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleFeedbackStatusToggle(item.id, item.status)}
                                                            className={cn(
                                                                "border-2 border-[#331F21] font-black uppercase text-[10px] h-9 px-4 rounded-xl",
                                                                item.status === 'solved' ? "bg-green-50 text-green-700" : "bg-[#331F21] text-white hover:bg-[#331F21]/90"
                                                            )}
                                                        >
                                                            {item.status === 'solved' ? 'Mark Pending' : 'Mark Solved'}
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="bg-[#F9F9FB] border-2 border-[#331F21]/5 rounded-xl p-4">
                                                    {item.category === 'genre_mismatch' && (
                                                        <p className="text-[10px] font-black uppercase text-red-500 mb-2">
                                                            Violating Genre: <span className="bg-red-50 px-2 py-0.5 rounded border border-red-100">{item.violating_genre}</span>
                                                        </p>
                                                    )}
                                                    <p className="text-sm font-medium text-[#331F21]/80 italic">
                                                        "{item.message || (item.category === 'genre_mismatch' ? 'No additional message provided' : 'No details provided')}"
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between pt-2">
                                                    <p className="text-[9px] font-bold text-[#331F21]/30 uppercase">User ID: {item.user_id?.substring(0, 8)}...</p>
                                                    <p className="text-[9px] font-bold text-[#331F21]/30 uppercase">Station ID: {item.station_id?.substring(0, 8)}...</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                {/* Platform Guidelines at the Bottom */}
                <div className="mt-12">
                    <h2 className="text-xl font-black text-[#331F21] uppercase mb-6">Platform Guidelines</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white border-4 border-[#331F21] rounded-2xl p-6 flex items-start gap-4">
                            <div className="p-2 bg-[#E9EFE4] rounded-lg border-2 border-[#331F21]">
                                <Globe className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">Verify URL Source</p>
                                <p className="text-xs opacity-60">Ensure stream ends in .mp3, .m3u8, or .aac for compatibility.</p>
                            </div>
                        </div>
                        <div className="bg-white border-4 border-[#331F21] rounded-2xl p-6 flex items-start gap-4">
                            <div className="p-2 bg-[#D3E1E6] rounded-lg border-2 border-[#331F21]">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">Community Standards</p>
                                <p className="text-xs opacity-60">Check for appropriate naming and genre tagging.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Admin;
