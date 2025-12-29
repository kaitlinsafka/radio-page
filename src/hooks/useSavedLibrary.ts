import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { RadioStation } from '@/services/radioBrowserApi';

export const useSavedLibrary = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Fetch saved stations
    const { data: savedStations = [], isLoading } = useQuery({
        queryKey: ['saved-stations', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('saved_stations')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;
            return data.map(item => ({
                ...item.station_data,
                saved_id: item.id, // Keep reference to the DB row ID if needed
                stationuuid: item.station_uuid // Ensure UI compatibility
            })) as RadioStation[];
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Create a Set for O(1) lookups
    const savedStationIds = new Set(savedStations.map(s => s.stationuuid));

    // Save Station Mutation
    const saveStationMutation = useMutation({
        mutationFn: async (station: RadioStation) => {
            if (!user) throw new Error("Must be logged in");

            const { error } = await supabase
                .from('saved_stations')
                .insert([{
                    user_id: user.id,
                    station_uuid: station.stationuuid,
                    station_data: station
                }]);

            if (error) throw error;
        },
        onMutate: async (station) => {
            await queryClient.cancelQueries({ queryKey: ['saved-stations', user?.id] });
            const previous = queryClient.getQueryData(['saved-stations', user?.id]);

            queryClient.setQueryData(['saved-stations', user?.id], (old: RadioStation[] = []) => {
                return [...old, station];
            });

            return { previous };
        },
        onError: (err, _newTodo, context) => {
            queryClient.setQueryData(['saved-stations', user?.id], context?.previous);
            toast.error("Failed to save station");
        },
        onSettled: () => {
            // Optimistic update is enough, invalidating immediately causes a 'flash' of refetching
            // queryClient.invalidateQueries({ queryKey: ['saved-stations', user?.id] });
        }
    });

    // Remove Station Mutation
    const removeStationMutation = useMutation({
        mutationFn: async (stationId: string) => {
            if (!user) throw new Error("Must be logged in");

            const { error } = await supabase
                .from('saved_stations')
                .delete()
                .eq('user_id', user.id)
                .eq('station_uuid', stationId);

            if (error) throw error;
        },
        onMutate: async (stationId) => {
            await queryClient.cancelQueries({ queryKey: ['saved-stations', user?.id] });
            const previous = queryClient.getQueryData(['saved-stations', user?.id]);

            queryClient.setQueryData(['saved-stations', user?.id], (old: RadioStation[] = []) => {
                return old.filter(s => s.stationuuid !== stationId);
            });

            return { previous };
        },
        onError: (err, _newTodo, context) => {
            queryClient.setQueryData(['saved-stations', user?.id], context?.previous);
            toast.error("Failed to remove station");
        },
        onSettled: () => {
            // Optimistic update is enough
            // queryClient.invalidateQueries({ queryKey: ['saved-stations', user?.id] });
        }
    });

    return {
        savedStations,
        isLoading,
        savedStationIds,
        saveStation: saveStationMutation.mutate,
        removeStation: removeStationMutation.mutate,
        isStationSaved: (id: string) => savedStationIds.has(id)
    };
};
