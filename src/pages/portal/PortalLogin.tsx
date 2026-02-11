import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { supabase } from "@/integrations/supabase/client";
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
  const [mode, setMode] = useState<"choose" | "magic-link">("choose");
  const [searchParams] = useSearchParams();
  const { login, session } = usePortalAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      login(token).then((result) => {
        if (result.success) {
          navigate("/portal", { replace: true });
        } else {
          toast.error(result.error || "Invalid or expired link");
        }
      });
    }
  }, [searchParams, login, navigate]);

  useEffect(() => {
    if (session) navigate("/portal", { replace: true });
  }, [session, navigate]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("portal-auth", {
        body: { action: "send-magic-link", email: email.trim() },
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
          <Button className="w-full" size="lg" onClick={() => setMode("magic-link")}>
            <KeyRound className="h-4 w-4 mr-2" />
            Sign in with email &amp; password
          </Button>
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
      <div className="w-full lg:w-[40%] flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={crestwellLogo} alt="Crestwell Travel Services" className="h-14 w-auto" />
          </div>
          {rightPanel()}
        </div>
      </div>
    </div>
  );
}
