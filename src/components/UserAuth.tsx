import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { User, LogOut, ShieldCheck, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

export const UserAuth = () => {
    const { user, profile, signOut, loading } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        toast.success("Signed out successfully");
        navigate("/radio");
    };

    if (loading) {
        return (
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        );
    }

    if (!user) {
        return (
            <Button
                variant="outline"
                onClick={() => navigate("/auth")}
                className="border-2 border-[#331F21] dark:border-white font-bold"
            >
                Sign In
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full border-2 border-[#331F21] dark:border-white w-10 h-10 bg-[#D3E1E6]"
                >
                    <User className="w-5 h-5 text-[#331F21]" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-2 border-[#331F21]">
                <DropdownMenuLabel className="font-bold">
                    {profile?.name || user.email}
                    {profile?.country && (
                        <p className="text-[10px] font-normal opacity-60 uppercase">{profile.country}</p>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {profile?.is_admin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="font-bold text-primary">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Admin Panel
                    </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => navigate("/onboarding")} className="font-bold">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Edit Preferences
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive font-bold">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
