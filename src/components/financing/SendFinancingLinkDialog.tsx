import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Mail, ExternalLink, Loader2, Link2 } from "lucide-react";

interface SendFinancingLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string | null;
  clientName?: string;
  clientEmail?: string;
  tripId?: string | null;
  tripName?: string;
  loanAmount?: number;
}

const FINANCING_BASE = "https://crestwellgetaways.com/financing";
const TOKEN_EXPIRY_DAYS = 30;

export function SendFinancingLinkDialog({
  open,
  onOpenChange,
  clientId,
  clientName = "",
  clientEmail = "",
  tripId,
  tripName = "",
  loanAmount,
}: SendFinancingLinkDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [form, setForm] = useState({
    name:   clientName,
    email:  clientEmail,
    trip:   tripName,
    amount: loanAmount ? String(loanAmount) : "",
  });

  async function generateLink() {
    if (!form.email || !form.name) {
      toast.error("Client name and email are required");
      return;
    }
    setGenerating(true);
    try {
      // Create a portal token scoped to financing
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

      const tokenPayload = {
        type:         "financing",
        client_id:    clientId   || null,
        trip_id:      tripId     || null,
        client_name:  form.name,
        client_email: form.email,
        trip_name:    form.trip,
        loan_amount:  form.amount ? parseFloat(form.amount) : null,
        expires_at:   expiresAt.toISOString(),
        created_at:   new Date().toISOString(),
      };

      // Store token in portal_tokens table
      const tokenStr = btoa(JSON.stringify(tokenPayload))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

      const { error } = await supabase
        .from("portal_tokens")
        .insert({
          token:      tokenStr,
          token_type: "financing",
          client_id:  clientId || null,
          trip_id:    tripId   || null,
          expires_at: expiresAt.toISOString(),
          metadata:   tokenPayload,
        });

      if (error) throw error;

      const url = `${FINANCING_BASE}?token=${tokenStr}`;
      setGeneratedLink(url);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate link");
    }
    setGenerating(false);
  }

  function copyLink() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    toast.success("Link copied to clipboard");
  }

  function emailLink() {
    if (!generatedLink) return;
    const subject = encodeURIComponent("Your Crestwell Travel Financing Application");
    const body = encodeURIComponent(
      `Hi ${form.name},

Please use the link below to complete your travel financing application with Crestwell Travel Services:

${generatedLink}

This link is valid for ${TOKEN_EXPIRY_DAYS} days. The application takes about 5 minutes to complete.

If you have any questions, please don't hesitate to reach out.

Warm regards,
Crestwell Travel Services
888.508.6893`
    );
    window.open(`mailto:${form.email}?subject=${subject}&body=${body}`);
  }

  function handleClose() {
    setGeneratedLink(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Send Financing Application
          </DialogTitle>
          <DialogDescription>
            Generate a secure link to send your client to the Crestwell financing application.
            Valid for {TOKEN_EXPIRY_DAYS} days.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Client Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Client Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="client@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Trip / Purpose</Label>
              <Input
                value={form.trip}
                onChange={e => setForm(f => ({ ...f, trip: e.target.value }))}
                placeholder="e.g. Mediterranean Cruise 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Loan Amount ($)</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="e.g. 5000"
              />
            </div>
            <Button
              onClick={generateLink}
              disabled={generating || !form.email || !form.name}
              className="w-full gap-2"
            >
              {generating
                ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
                : <><Link2 className="h-4 w-4" />Generate Financing Link</>
              }
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-sm font-semibold text-green-800">Link ready — valid for {TOKEN_EXPIRY_DAYS} days</p>
              </div>
              <p className="text-xs text-muted-foreground">
                This link pre-fills the client's name, email, and trip details so they can complete the application in minutes.
              </p>
              <div className="rounded-md bg-white border border-green-200 px-3 py-2">
                <p className="text-xs font-mono text-foreground break-all leading-relaxed">{generatedLink}</p>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 gap-1.5" onClick={copyLink}>
                  <Copy className="h-3.5 w-3.5" />Copy Link
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={emailLink}>
                  <Mail className="h-3.5 w-3.5" />Email
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={generatedLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
