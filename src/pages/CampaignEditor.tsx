import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Save, Image as ImageIcon, Users, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmailPreview } from "@/components/campaigns/EmailPreview";
import { MergeVarChips } from "@/components/campaigns/MergeVarChips";
import { AICampaignAssistant } from "@/components/campaigns/AICampaignAssistant";
import { ImageGrid } from "@/components/campaigns/ImageGrid";
import { ImageDropzone } from "@/components/campaigns/ImageDropzone";
import {
  useCampaign,
  useUpdateCampaign,
  useSendCampaign,
  useMaterializeAudience,
  useCampaignRecipientCount,
} from "@/hooks/useCampaigns";
import { useCampaignAudiences } from "@/hooks/useCampaignAudiences";
import { useImageAssets } from "@/hooks/useImageAssets";
import { toast } from "sonner";

export default function CampaignEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(id);
  const update = useUpdateCampaign();
  const send = useSendCampaign();
  const materialize = useMaterializeAudience();
  const { data: audiences = [] } = useCampaignAudiences();
  const { data: assets = [], upload } = useImageAssets();
  const { data: queuedCount = 0 } = useCampaignRecipientCount(id);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    preheader: "",
    from_name: "Crestwell Travel",
    from_email: "news@crestwellgetaways.com",
    reply_to: "tim@crestwellgetaways.com",
    audience_id: "",
    body_html: "",
  });

  useEffect(() => {
    if (campaign) {
      setForm({
        name: campaign.name,
        subject: campaign.subject,
        preheader: campaign.preheader ?? "",
        from_name: campaign.from_name,
        from_email: campaign.from_email,
        reply_to: campaign.reply_to ?? "",
        audience_id: campaign.audience_id ?? "",
        body_html: campaign.body_html,
      });
    }
  }, [campaign]);

  const insertAtCursor = (text: string) => {
    const el = bodyRef.current;
    if (!el) {
      setForm((f) => ({ ...f, body_html: f.body_html + text }));
      return;
    }
    const start = el.selectionStart ?? form.body_html.length;
    const end = el.selectionEnd ?? start;
    const next = form.body_html.slice(0, start) + text + form.body_html.slice(end);
    setForm((f) => ({ ...f, body_html: next }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!id) return;
    await update.mutateAsync({
      id,
      ...form,
      preheader: form.preheader || null,
      reply_to: form.reply_to || null,
      audience_id: form.audience_id || null,
    });
    toast.success("Saved");
  };

  const handleBuildAudience = async () => {
    if (!id || !form.audience_id) {
      toast.error("Select an audience first");
      return;
    }
    await handleSave();
    await materialize.mutateAsync({ campaignId: id, audienceId: form.audience_id });
  };

  const handleSend = async () => {
    if (!id) return;
    await handleSave();
    await send.mutateAsync(id);
    navigate("/campaigns");
  };

  if (isLoading || !campaign) {
    return (
      <DashboardLayout>
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
      </DashboardLayout>
    );
  }

  const isLocked = campaign.status === "sent" || campaign.status === "sending";

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Campaigns
            </Button>
            <h1 className="text-xl font-bold">{form.name || "Untitled campaign"}</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">{campaign.status}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={update.isPending || isLocked}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isLocked || queuedCount === 0}>
                  <Send className="h-4 w-4 mr-1" /> Send ({queuedCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will email {queuedCount} recipient{queuedCount === 1 ? "" : "s"} from{" "}
                    <strong>{form.from_name} &lt;{form.from_email}&gt;</strong>. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSend} disabled={send.isPending}>
                    {send.isPending ? "Sending…" : "Send now"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Campaign name (internal)</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Preheader (preview text)</Label>
                  <Input value={form.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>From name</Label>
                    <Input value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>From email</Label>
                    <Input value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Reply-to</Label>
                  <Input value={form.reply_to} onChange={(e) => setForm({ ...form, reply_to: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Audience</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={form.audience_id} onValueChange={(v) => setForm({ ...form, audience_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select audience…" /></SelectTrigger>
                      <SelectContent>
                        {audiences.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} {a.contact_count != null ? `(${a.contact_count})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleBuildAudience} disabled={materialize.isPending}>
                      <Users className="h-4 w-4 mr-1" />
                      {materialize.isPending ? "Building…" : "Build list"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{queuedCount} recipients queued</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Email body (HTML)</CardTitle>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ImageIcon className="h-4 w-4 mr-1" /> Insert image
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="sm:max-w-xl overflow-y-auto">
                    <SheetHeader><SheetTitle>Image library</SheetTitle></SheetHeader>
                    <div className="my-4">
                      <ImageDropzone
                        onDrop={(files) => upload.mutate(files)}
                        isUploading={upload.isPending}
                        compact
                      />
                    </div>
                    <ImageGrid
                      assets={assets}
                      selectMode
                      onSelect={(a) => {
                        insertAtCursor(`<img src="${a.public_url}" alt="${a.alt_text ?? ""}" style="max-width:100%;height:auto;" />`);
                        toast.success("Image inserted");
                      }}
                    />
                  </SheetContent>
                </Sheet>
              </CardHeader>
              <CardContent className="space-y-2">
                <MergeVarChips onInsert={insertAtCursor} />
                <Textarea
                  ref={bodyRef}
                  value={form.body_html}
                  onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                  rows={20}
                  className="font-mono text-xs"
                  placeholder="<p>Hi {{first_name}},</p><p>…</p>"
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <AICampaignAssistant
              onApplySubject={(s) => setForm((f) => ({ ...f, subject: s }))}
              onApplyBody={(html) => setForm((f) => ({ ...f, body_html: html }))}
            />
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Preview</CardTitle></CardHeader>
              <CardContent>
                <EmailPreview
                  subject={form.subject}
                  fromName={form.from_name}
                  fromEmail={form.from_email}
                  preheader={form.preheader}
                  bodyHtml={form.body_html}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}