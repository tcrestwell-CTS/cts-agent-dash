import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [searchParams] = useSearchParams();
  const { login, session } = usePortalAuth();
  const navigate = useNavigate();

  // Handle token verification from magic link
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

  // Redirect if already logged in
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

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-success mx-auto" />
            <h2 className="text-xl font-semibold">Check Your Email</h2>
            <p className="text-muted-foreground">
              If an account exists for <strong>{email}</strong>, we've sent a secure access link.
              Click the link in your email to access your travel portal.
            </p>
            <Button variant="outline" onClick={() => { setSent(false); setEmail(""); }}>
              Send Another Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">Client Portal</CardTitle>
          <CardDescription>
            Enter your email to receive a secure access link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendLink} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={sending}
              />
            </div>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Access Link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
