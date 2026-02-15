import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2, CheckCircle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import portalHero from "@/assets/portal-hero.jpg";
import crestwellLogo from "@/assets/crestwell-logo.png";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState<"choose" | "magic-link">("choose");
  const [searchParams] = useSearchParams();
  const { login, session } = usePortalAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      login(token).then((result) => {
        if (result.success) {
          navigate("/client", { replace: true });
        } else {
          toast.error(result.error || "Invalid or expired link");
        }
      });
    }
  }, [searchParams, login, navigate]);

  useEffect(() => {
    if (session) navigate("/client", { replace: true });
  }, [session, navigate]);

  // Handle Google OAuth callback - check if user just signed in via Supabase Auth
  useEffect(() => {
    const handleGoogleCallback = async () => {
      const { data: { session: supaSession } } = await supabase.auth.getSession();
      if (supaSession?.user?.email) {
        setGoogleLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke("portal-auth", {
            body: { action: "google-login", email: supaSession.user.email },
          });
          // Sign out of Supabase Auth (portal uses its own session)
          await supabase.auth.signOut();

          if (error || !data?.success) {
            toast.error(data?.error || "Could not find a client account for your Google email.");
            setGoogleLoading(false);
            return;
          }

          const portalSession = {
            clientId: data.client_id,
            clientName: data.client_name,
            token: data.token,
          };
          localStorage.setItem("portal_session", JSON.stringify(portalSession));
          window.location.href = "/client";
        } catch {
          toast.error("Failed to sign in with Google.");
          setGoogleLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        handleGoogleCallback();
      }
    });

    // Also check on mount (in case returning from OAuth redirect)
    handleGoogleCallback();

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/client/login",
    });
    if (error) {
      toast.error("Failed to start Google sign in.");
      setGoogleLoading(false);
    }
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("portal-auth", {
        body: { action: "send-magic-link", email: email.trim(), origin: window.location.origin },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      toast.error("Failed to send access link. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const rightPanel = () => {
    if (sent) {
      return (
        <div className="text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-semibold">Check Your Email</h2>
          <p className="text-muted-foreground">
            If an account exists for <strong>{email}</strong>, we've sent a secure access link.
            Click the link in your email to access your travel portal.
          </p>
          <Button variant="outline" onClick={() => { setSent(false); setEmail(""); setMode("choose"); }}>
            Back to Sign In
          </Button>
        </div>
      );
    }

    if (mode === "magic-link") {
      return (
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Client Portal</h1>
            <p className="text-muted-foreground text-sm">Enter your email to receive a secure access link</p>
          </div>
          <form onSubmit={handleSendLink} className="space-y-4">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={sending}
            />
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Access Link
            </Button>
          </form>
          <Button variant="ghost" className="w-full text-sm" onClick={() => setMode("choose")}>
            ← Back to sign in options
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Client Portal</h1>
          <p className="text-muted-foreground text-sm">Choose how you'd like to sign in</p>
        </div>
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Sign in with Google
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" size="lg" onClick={() => setMode("magic-link")}>
            <Mail className="h-4 w-4 mr-2" />
            Sign in with magic link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center px-4">
          Your travel agent will have registered your email. Contact them if you have trouble signing in.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Left hero panel */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden">
        <img
          src={portalHero}
          alt="Tropical beach paradise"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 inline-block">
              <img src={crestwellLogo} alt="Crestwell Travel Services" className="h-16 w-auto" />
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-bold text-white">Your Travel Portal</h2>
            <p className="text-white/85 text-lg max-w-md">
              View your trips, track payments, download invoices, and message your travel agent — all in one place.
            </p>
          </div>
          <p className="text-white/60 text-sm">
            © {new Date().getFullYear()} Crestwell Travel Services. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right sign-in panel */}
      <div className="w-full lg:w-[40%] flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={crestwellLogo} alt="Crestwell Travel Services" className="h-14 w-auto" />
          </div>
          {rightPanel()}
        </div>
        <div className="text-center text-sm text-muted-foreground flex items-center gap-3 pt-6">
          <a href="https://crestwellgetaways.com/term-and-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline">Terms and Conditions</a>
          <span>·</span>
          <a href="https://crestwellgetaways.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
