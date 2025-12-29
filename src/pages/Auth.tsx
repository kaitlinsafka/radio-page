import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Headphones, Loader2, ArrowLeft, Eye, EyeOff, Mail, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type AuthView = 'login' | 'signup' | 'reset' | 'update_password';

const Auth = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [view, setView] = useState<AuthView>('login');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form fields
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [country, setCountry] = useState("");

    useEffect(() => {
        // Check URL params for view
        const viewParam = searchParams.get('view');
        if (viewParam === 'update_password') {
            setView('update_password');
        }

        // Listen for auth state changes (essential for handling the recovery hash fragment)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setView('update_password');
            }
        });

        return () => subscription.unsubscribe();
    }, [searchParams]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (view === 'update_password') {
                // Verify we have an active session before trying to update
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    toast.error("Your secure session has expired. Please request a new reset link.");
                    setLoading(false);
                    return;
                }

                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                toast.success("Password updated successfully!");
                navigate("/radio");
            } else if (view === 'reset') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth?view=update_password`,
                });
                if (error) throw error;
                toast.success("Password reset link sent to your email!");
                setView('login');
            } else if (view === 'login') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success("Welcome back!");
                navigate("/radio");
            } else {
                // Signup
                if (!name || !country) {
                    toast.error("Please fill in all fields");
                    setLoading(false);
                    return;
                }

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            name,
                            country
                        }
                    }
                });

                if (error) throw error;

                if (data.user) {
                    // Profile creation is now handled by the 'on_auth_user_created' database trigger
                    // This prevents RLS errors if email confirmation is enabled (session is null)
                }

                toast.success("Account created! You can now log in.");
                setView('login');
            }

            // Shared Logic for Redirects (Login or Signup/Auto-login scenarios if we supported it)
            if (view === 'login') {
                const returnShareId = sessionStorage.getItem('returnToShare');
                if (returnShareId) {
                    sessionStorage.removeItem('returnToShare');
                    navigate(`/share/${returnShareId}`);
                } else {
                    navigate("/radio");
                }
            }
        } catch (error: any) {
            toast.error(error.message || "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    const toggleView = () => {
        if (view === 'login') setView('signup');
        else setView('login');
        // Reset specific states when switching
        setPassword("");
        setName("");
        setCountry("");
    };

    return (
        <div className="min-h-screen bg-[#F9F9FB] dark:bg-[#1a202c] flex flex-col items-center justify-center p-4">
            {/* Back Button */}
            <Button
                variant="ghost"
                onClick={() => navigate("/radio")}
                className="absolute top-8 left-8 text-[#331F21] dark:text-white"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Radio
            </Button>

            <div className="w-full max-w-md bg-white dark:bg-[#3d4a5a] border-4 border-[#331F21] dark:border-[#5a6878] rounded-[2rem] p-8 shadow-[8px_8px_0_#331F21] dark:shadow-[8px_8px_0_#1a1f28]">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-[#D3E1E6] dark:bg-[#4d5a68] rounded-2xl flex items-center justify-center border-4 border-[#331F21] mb-4">
                        {view === 'reset' ? (
                            <Mail className="w-8 h-8 text-[#331F21] dark:text-white" />
                        ) : view === 'update_password' ? (
                            <KeyRound className="w-8 h-8 text-[#331F21] dark:text-white" />
                        ) : (
                            <Headphones className="w-8 h-8 text-[#331F21] dark:text-white" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-[#331F21] dark:text-white uppercase tracking-tight">
                        {view === 'login' && "Welcome Back"}
                        {view === 'signup' && "Join My Radio"}
                        {view === 'reset' && "Reset Password"}
                        {view === 'update_password' && "Set New Password"}
                    </h1>
                    <p className="text-[#331F21]/60 dark:text-white/60 text-sm mt-2 text-center">
                        {view === 'login' && "Sign in to access your saved stations and preferences."}
                        {view === 'signup' && "Discover & share music with a worldwide community."}
                        {view === 'reset' && "Enter your email to receive a reset link."}
                        {view === 'update_password' && "Enter your new password below."}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {view === 'signup' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="border-2 border-[#331F21]"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="country">Country</Label>
                                <Input
                                    id="country"
                                    type="text"
                                    placeholder="e.g. United Kingdom"
                                    value={country}
                                    onChange={(e) => setCountry(e.target.value)}
                                    className="border-2 border-[#331F21]"
                                    required
                                />
                            </div>
                        </>
                    )}

                    {(view === 'login' || view === 'signup' || view === 'reset') && (
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="border-2 border-[#331F21]"
                                required
                            />
                        </div>
                    )}

                    {view !== 'reset' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">
                                    {view === 'update_password' ? "New Password" : "Password"}
                                </Label>
                                {view === 'login' && (
                                    <button
                                        type="button"
                                        onClick={() => setView('reset')}
                                        className="text-xs font-bold text-[#331F21] opacity-60 hover:opacity-100 hover:underline"
                                    >
                                        Forgot Password?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="border-2 border-[#331F21] pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#331F21] opacity-50 hover:opacity-100 transition-opacity"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#331F21] hover:bg-[#4a2f32] text-white font-bold py-6 rounded-xl shadow-[4px_4px_0_#D3E1E6] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            view === 'login' ? "SIGN IN" :
                                view === 'signup' ? "CREATE ACCOUNT" :
                                    view === 'reset' ? "SEND RESET LINK" :
                                        "UPDATE PASSWORD"
                        )}
                    </Button>
                </form>

                <div className="mt-8 text-center">
                    {view !== 'update_password' && (
                        <button
                            onClick={view === 'reset' ? () => setView('login') : toggleView}
                            className="text-[#331F21] dark:text-white underline text-sm font-bold opacity-80 hover:opacity-100"
                        >
                            {view === 'login' && "Don't have an account? Sign up"}
                            {view === 'signup' && "Already have an account? Sign in"}
                            {view === 'reset' && "Back to Sign In"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Auth;
