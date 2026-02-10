import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSending(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "send-magic-link", email: email.trim() }),
        }
      );

      if (!res.ok) throw new Error("Failed to send");

      setSent(true);
      toast.success("Check your email for the access link!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-ocean p-12 flex-col justify-between">
        <div className="bg-white/95 rounded-xl p-4 w-fit">
          <img
            alt="Crestwell Travel Services"
            className="h-16 w-auto object-contain"
            src="/lovable-uploads/ca8734b5-c59b-4dd9-9431-498d1e25746a.png"
          />
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white">Your Travel Portal</h1>
          <p className="text-lg text-white/80">
            View your trips, track payments, download invoices, and stay in touch
            with your travel agent — all in one place.
          </p>
          <div className="flex items-center gap-8 pt-4">
            <div>
              <p className="text-2xl font-semibold text-white">📋</p>
              <p className="text-white/70 text-sm">Trip Details</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">💳</p>
              <p className="text-white/70 text-sm">Payments</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">💬</p>
              <p className="text-white/70 text-sm">Messages</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-white/60">
          © 2026 Crestwell Travel Services. All rights reserved.
        </p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="lg:hidden flex justify-center mb-4">
              <img
                src="/lovable-uploads/ca8734b5-c59b-4dd9-9431-498d1e25746a.png"
                alt="Crestwell Travel Services"
                className="h-12 w-auto"
              />
            </div>
            <CardTitle className="text-2xl">Client Portal</CardTitle>
            <CardDescription>
              {sent
                ? "We've sent you a secure access link"
                : "Enter your email to receive a secure access link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  We've sent a magic link to <strong>{email}</strong>. Check your
                  inbox and click the link to access your portal.
                </p>
                <Button
                  variant="outline"
                  onClick={() => { setSent(false); setEmail(""); }}
                  className="mt-4"
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSending || !email.trim()}
                >
                  {isSending ? "Sending..." : "Send Access Link"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
