import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrandingSettings } from "@/hooks/useBrandingSettings";

export type InvoiceEmailTemplateKey = "standard" | "balance_due" | "final_notice" | "paid_receipt";

export interface InvoiceEmailRecipient {
  email: string;
  name?: string;
  role: string;
  selected: boolean;
}

export interface InvoiceEmailSendPayload {
  templateKey: InvoiceEmailTemplateKey;
  subject: string;
  /** Contains the {{RECIPIENT_NAME}} placeholder — replace per recipient before sending. */
  bodyHtml: string;
  recipients: Array<{ email: string; name?: string }>;
}

export const RECIPIENT_NAME_TOKEN = "{{RECIPIENT_NAME}}";

interface EmailInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripName?: string;
  clientName?: string;
  clientEmail?: string;
  destination?: string;
  dateRange?: string;
  tripTotal: number;
  totalPaid: number;
  totalRemaining: number;
  sending?: boolean;
  onSend: (payload: InvoiceEmailSendPayload) => Promise<void> | void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));

const TEMPLATES: Array<{
  key: InvoiceEmailTemplateKey;
  label: string;
  description: string;
}> = [
  { key: "standard", label: "Standard Invoice", description: "Invoice attached with trip totals" },
  { key: "balance_due", label: "Balance Due", description: "Friendly nudge with the outstanding balance" },
  { key: "final_notice", label: "Final Notice", description: "Firm reminder ahead of the final due date" },
  { key: "paid_receipt", label: "Paid in Full Receipt", description: "Thank-you receipt when nothing is owed" },
];

export function EmailInvoiceDialog({
  open,
  onOpenChange,
  tripId,
  tripName,
  clientName,
  clientEmail,
  destination,
  dateRange,
  tripTotal,
  totalPaid,
  totalRemaining,
  sending = false,
  onSend,
}: EmailInvoiceDialogProps) {
  const { settings: branding } = useBrandingSettings();
  const [templateKey, setTemplateKey] = useState<InvoiceEmailTemplateKey>("standard");
  const [recipients, setRecipients] = useState<InvoiceEmailRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [extraEmail, setExtraEmail] = useState("");

  useEffect(() => {
    if (!open) return;
    setTemplateKey(totalRemaining <= 0.01 ? "paid_receipt" : "standard");

    const load = async () => {
      setLoadingRecipients(true);
      try {
        const [{ data: shares }, { data: travelers }] = await Promise.all([
          supabase.from("booking_payer_shares").select("payer_name, payer_email").eq("trip_id", tripId),
          supabase.from("trip_travelers").select("first_name, last_name, email").eq("trip_id", tripId),
        ]);

        const seen = new Set<string>();
        const list: InvoiceEmailRecipient[] = [];
        const push = (email: string | null | undefined, name: string | undefined, role: string) => {
          const clean = (email || "").trim();
          if (!clean || !clean.includes("@")) return;
          const lower = clean.toLowerCase();
          if (seen.has(lower)) return;
          seen.add(lower);
          list.push({ email: clean, name, role, selected: true });
        };

        push(clientEmail, clientName, "Primary client");
        for (const s of (shares || []) as Array<{ payer_name?: string; payer_email?: string }>) {
          push(s.payer_email, s.payer_name, "Split payer");
        }
        for (const t of (travelers || []) as Array<{ first_name?: string; last_name?: string; email?: string }>) {
          push(t.email, [t.first_name, t.last_name].filter(Boolean).join(" "), "Traveler");
        }
        setRecipients(list);
      } finally {
        setLoadingRecipients(false);
      }
    };
    void load();
  }, [open, tripId, clientEmail, clientName, totalRemaining]);

  const toggle = (email: string) =>
    setRecipients((prev) =>
      prev.map((r) => (r.email === email ? { ...r, selected: !r.selected } : r)),
    );

  const addExtra = () => {
    const clean = extraEmail.trim();
    if (!clean.includes("@")) return;
    if (recipients.some((r) => r.email.toLowerCase() === clean.toLowerCase())) {
      setExtraEmail("");
      return;
    }
    setRecipients((prev) => [...prev, { email: clean, role: "Added manually", selected: true }]);
    setExtraEmail("");
  };

  const selected = recipients
    .filter((r) => r.selected)
    .map((r) => ({ email: r.email, name: r.name }));

  const { subject, bodyHtml, previewHtml } = useMemo(() => {
    const agency = branding?.agency_name || "Crestwell Travel Services";
    const primary = branding?.primary_color || "#0d1b2a";
    const accent = branding?.accent_color || "#c9a84c";
    const trip = tripName || "Your Trip";
    const greeting = `Dear ${RECIPIENT_NAME_TOKEN},`;
    const previewGreeting = `Dear ${clientName || "Valued Client"},`;

    const copyByTemplate: Record<InvoiceEmailTemplateKey, { subject: string; intro: string; closing: string }> = {
      standard: {
        subject: `Invoice for ${trip}`,
        intro: `Please find your invoice attached for <strong>${trip}</strong>. A summary of your trip totals is below.`,
        closing: "If you have any questions about this invoice, just reply to this email and we'll take care of it.",
      },
      balance_due: {
        subject: `Balance due for ${trip}`,
        intro: `Here's a quick update on <strong>${trip}</strong>. Your remaining balance is shown below, and your full invoice is attached.`,
        closing: "You can pay any time through your client portal, or reply here and we'll send a secure payment link.",
      },
      final_notice: {
        subject: `Final payment notice — ${trip}`,
        intro: `This is a final reminder that the remaining balance for <strong>${trip}</strong> is due shortly. Your invoice is attached for reference.`,
        closing: "To keep your reservation and pricing in place, please submit payment before the final due date.",
      },
      paid_receipt: {
        subject: `Paid in full — ${trip}`,
        intro: `Thank you! Your payments for <strong>${trip}</strong> are complete. Your paid invoice is attached as your receipt.`,
        closing: "We're getting everything ready for you. Watch your inbox for final documents before departure.",
      },
    };

    const copy = copyByTemplate[templateKey];
    const showBalance = templateKey !== "paid_receipt";

    const body = `
      <p>${greeting}</p>
      <p>${copy.intro}</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:6px 0;"><strong>Trip:</strong> ${trip}</p>
        ${destination ? `<p style="margin:6px 0;"><strong>Destination:</strong> ${destination}</p>` : ""}
        ${dateRange ? `<p style="margin:6px 0;"><strong>Travel Dates:</strong> ${dateRange}</p>` : ""}
        <p style="margin:6px 0;"><strong>Trip Total:</strong> ${fmt(tripTotal)}</p>
        <p style="margin:6px 0;"><strong>Amount Paid:</strong> ${fmt(totalPaid)}</p>
        ${showBalance ? `<p style="margin:6px 0;color:${primary};font-size:17px;"><strong>Balance Due:</strong> ${fmt(totalRemaining)}</p>` : ""}
      </div>
      <p>${copy.closing}</p>
      <p style="color:#6b7280;font-size:13px;">Payments are securely processed through Crestwell Travel Network, ${agency}'s host agency, so that name may appear at checkout and on your statement.</p>
    `;

    const previewBody = body.split(greeting).join(previewGreeting);
    const preview = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;color:#111827;">
        <div style="background:${primary};padding:24px;text-align:center;">
          ${branding?.logo_url ? `<img src="${branding.logo_url}" alt="${agency}" style="max-height:48px;margin-bottom:8px;"/>` : ""}
          <div style="color:${accent};font-family:Georgia,serif;font-size:20px;font-weight:600;">${agency}</div>
          <div style="color:#ffffff;opacity:0.75;font-size:12px;font-style:italic;margin-top:4px;">${copy.subject}</div>
        </div>
        <div style="padding:24px;line-height:1.7;color:#374151;">${previewBody}
          <div style="margin-top:20px;padding:12px;border:1px dashed #d1d5db;border-radius:6px;color:#6b7280;font-size:13px;">
            📎 Attachment: Invoice PDF (generated when sent)
          </div>
        </div>
        <div style="background:#f9fafb;padding:16px;text-align:center;color:#6b7280;font-size:12px;border-top:3px solid ${accent};">
          ${agency}${branding?.phone ? ` • ${branding.phone}` : ""}${branding?.email_address ? ` • ${branding.email_address}` : ""}
        </div>
      </div>`;

    return { subject: copy.subject, bodyHtml: body, previewHtml: preview };
  }, [templateKey, branding, tripName, clientName, destination, dateRange, tripTotal, totalPaid, totalRemaining]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Email Invoice
          </DialogTitle>
          <DialogDescription>
            Choose a template, verify every recipient, and preview the exact email before it goes out.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[320px_1fr] overflow-hidden flex-1">
          <div className="space-y-5 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="space-y-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplateKey(t.key)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      templateKey === t.key
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recipients</Label>
                <Badge variant="secondary">{selected.length} selected</Badge>
              </div>
              {loadingRecipients ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading recipients…
                </div>
              ) : recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No email addresses found for this trip. Add one below.
                </p>
              ) : (
                <ScrollArea className="max-h-56 rounded-md border">
                  <div className="divide-y">
                    {recipients.map((r) => (
                      <label
                        key={r.email}
                        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/40"
                      >
                        <Checkbox checked={r.selected} onCheckedChange={() => toggle(r.email)} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate">
                            {r.name || r.email}
                          </span>
                          <span className="block text-xs text-muted-foreground truncate">{r.email}</span>
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {r.role}
                          </Badge>
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <div className="flex gap-2">
                <Input
                  value={extraEmail}
                  placeholder="Add another email"
                  onChange={(e) => setExtraEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExtra();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addExtra}>
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Subject</Label>
              <p className="text-sm rounded-md border bg-muted/40 p-2">{subject}</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <Label className="mb-2">Email preview</Label>
            <div className="flex-1 min-h-[320px] overflow-hidden rounded-lg border bg-white">
              <iframe
                title="Invoice email preview"
                className="h-full w-full"
                srcDoc={previewHtml}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={() => onSend({ templateKey, subject, bodyHtml, recipients: selected })}
            disabled={sending || selected.length === 0}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send to {selected.length} recipient{selected.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
