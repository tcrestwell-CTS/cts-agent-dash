import { useState, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Loader2,
  Send,
  Save,
  Eye,
  FileText,
  Trash2,
  Plus,
  Link as LinkIcon,
  Variable,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmailTemplates, EmailTemplate } from "@/hooks/useEmailTemplates";

interface TripEmailNotificationDialogProps {
  tripId: string;
  tripName: string;
  clientName: string;
  clientEmail: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  shareToken?: string;
}

type BuiltInTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
};

const PRODUCTION_DOMAIN = "https://app.crestwelltravels.com";

const LINK_VARIABLES = [
  { token: "$trip_link", label: "Trip Page Link", description: "Link to the published trip page" },
  { token: "$portal_link", label: "Portal Link", description: "Link to the client portal" },
] as const;

const TEXT_VARIABLES = [
  { token: "{{clientName}}", label: "Client Name" },
  { token: "{{tripName}}", label: "Trip Name" },
  { token: "{{destination}}", label: "Destination" },
  { token: "{{departDate}}", label: "Depart Date" },
  { token: "{{returnDate}}", label: "Return Date" },
] as const;

export function TripEmailNotificationDialog({
  tripId,
  tripName,
  clientName,
  clientEmail,
  destination,
  departDate,
  returnDate,
  shareToken,
}: TripEmailNotificationDialogProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<string>("compose");
  const [showPreview, setShowPreview] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const { templates: savedTemplates, isLoading: loadingTemplates, saveTemplate, deleteTemplate } = useEmailTemplates();

  const tripLink = shareToken ? `${PRODUCTION_DOMAIN}/shared/${shareToken}` : "";
  const portalLink = `${PRODUCTION_DOMAIN}/portal`;

  const resolveVariables = (text: string) => {
    return text
      .replace(/\{\{clientName\}\}/g, clientName)
      .replace(/\{\{tripName\}\}/g, tripName)
      .replace(/\{\{destination\}\}/g, destination || "")
      .replace(/\{\{departDate\}\}/g, departDate || "")
      .replace(/\{\{returnDate\}\}/g, returnDate || "")
      .replace(/\$trip_link/g, tripLink)
      .replace(/\$portal_link/g, portalLink);
  };

  const insertVariable = (token: string) => {
    const textarea = messageRef.current;
    if (!textarea) {
      setMessage((prev) => prev + token);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = message.substring(0, start) + token + message.substring(end);
    setMessage(newMessage);
    // restore cursor position after token
    setTimeout(() => {
      textarea.focus();
      const newPos = start + token.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const builtInTemplates: BuiltInTemplate[] = useMemo(
    () => [
      {
        id: "trip_update",
        name: "Trip Update",
        subject: `Update on your trip: ${tripName}`,
        body: `Hi ${clientName},\n\nWe have an update regarding your upcoming trip "${tripName}"${destination ? ` to ${destination}` : ""}.\n\n[Enter your update details here]\n\nPlease don't hesitate to reach out if you have any questions.\n\nBest regards`,
        category: "trip_update",
      },
      {
        id: "itinerary_change",
        name: "Itinerary Change",
        subject: `Itinerary update for ${tripName}`,
        body: `Hi ${clientName},\n\nThere has been a change to the itinerary for your trip "${tripName}"${departDate ? ` departing ${departDate}` : ""}.\n\n[Describe the itinerary changes here]\n\nThe updated itinerary is available in your client portal.\n\nBest regards`,
        category: "trip_update",
      },
      {
        id: "payment_reminder",
        name: "Payment Reminder",
        subject: `Payment reminder for ${tripName}`,
        body: `Hi ${clientName},\n\nThis is a friendly reminder regarding an upcoming payment for your trip "${tripName}"${destination ? ` to ${destination}` : ""}.\n\n[Enter payment details and deadline here]\n\nYou can make your payment through the client portal.\n\nBest regards`,
        category: "payment",
      },
      {
        id: "travel_docs",
        name: "Travel Documents Reminder",
        subject: `Travel documents needed for ${tripName}`,
        body: `Hi ${clientName},\n\nAs your departure date${departDate ? ` (${departDate})` : ""} approaches for "${tripName}", please ensure you have the following documents ready:\n\n• Valid passport (check expiration date)\n• Visa (if applicable)\n• Travel insurance documentation\n• Vaccination records (if required)\n\n[Add any trip-specific document requirements here]\n\nBest regards`,
        category: "general",
      },
      {
        id: "pre_departure",
        name: "Pre-Departure Info",
        subject: `Pre-departure information for ${tripName}`,
        body: `Hi ${clientName},\n\nYour trip "${tripName}"${destination ? ` to ${destination}` : ""} is just around the corner${departDate ? ` (${departDate})` : ""}! Here are some important things to keep in mind:\n\n[Add pre-departure checklist items here]\n\nHave a wonderful trip!\n\nBest regards`,
        category: "trip_update",
      },
    ],
    [tripName, clientName, destination, departDate, returnDate]
  );

  const applyTemplate = (template: BuiltInTemplate | EmailTemplate) => {
    if ("body" in template) {
      setSubject(template.subject);
      setMessage(template.body);
    } else {
      setSubject(template.subject);
      // Replace placeholders in saved templates
      let body = template.body_html;
      body = body.replace(/\{\{clientName\}\}/g, clientName);
      body = body.replace(/\{\{tripName\}\}/g, tripName);
      body = body.replace(/\{\{destination\}\}/g, destination || "");
      body = body.replace(/\{\{departDate\}\}/g, departDate || "");
      body = body.replace(/\{\{returnDate\}\}/g, returnDate || "");
      setMessage(body);
    }
    setActiveTab("compose");
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    await saveTemplate.mutateAsync({
      name: templateName,
      subject,
      body_html: message,
      category: "general",
    });
    setSaveDialogOpen(false);
    setTemplateName("");
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setSending(true);
    try {
      const resolvedSubject = resolveVariables(subject);
      const resolvedMessage = resolveVariables(message);
      const resolvedHtml = resolvedMessage
        .replace(/\n/g, "<br/>")
        .replace(
          /(https?:\/\/[^\s<]+)/g,
          '<a href="$1" style="color:#c9a84c;text-decoration:underline;">$1</a>'
        );
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: clientEmail,
          subject: resolvedSubject,
          template: "custom",
          customHtml: resolvedHtml,
          data: { clientName },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send email");

      toast.success(`Email sent to ${clientName}!`);
      setOpen(false);
      setSubject("");
      setMessage("");
      setShowPreview(false);
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const previewHtml = useMemo(() => {
    const resolved = resolveVariables(message);
    const bodyHtml = resolved
      .replace(/\n/g, "<br/>")
      .replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" style="color:#c9a84c;text-decoration:underline;">$1</a>'
      );
    const resolvedSubject = resolveVariables(subject);
    return `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: #142236; padding: 24px 32px; text-align: center;">
          <h2 style="color: #c9a84c; margin: 0; font-size: 18px; font-family: 'Playfair Display', serif;">Crestwell Travel Services</h2>
        </div>
        <div style="padding: 32px;">
          <h3 style="color: #142236; margin: 0 0 16px; font-size: 16px;">${resolvedSubject}</h3>
          <div style="color: #4a5568; font-size: 14px; line-height: 1.7;">${bodyHtml}</div>
        </div>
        <div style="background: #f7f5f0; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #718096; font-size: 12px; margin: 0;">Crestwell Travel Services</p>
        </div>
      </div>
    `;
  }, [message, subject, tripLink, portalLink, clientName, tripName, destination, departDate, returnDate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Mail className="h-4 w-4 mr-2" />
          Notify Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Top toolbar — like the reference screenshot */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-base font-semibold text-foreground">New Email</h2>
          <div className="flex items-center gap-1">
            {/* Apply Template dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Apply Template
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-y-auto">
                <DropdownMenuLabel className="text-xs">Built-In Templates</DropdownMenuLabel>
                {builtInTemplates.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t)} className="cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
                {savedTemplates.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">My Templates</DropdownMenuLabel>
                    {savedTemplates.map((t) => (
                      <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t)} className="cursor-pointer">
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <p className="text-sm font-medium">{t.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                          </div>
                          {!t.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive ml-2 shrink-0"
                              onClick={(e) => { e.stopPropagation(); deleteTemplate.mutate(t.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Insert Variable dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  <Variable className="h-3.5 w-3.5" />
                  Insert Variable
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs flex items-center gap-1.5">
                  <LinkIcon className="h-3 w-3" /> Link Variables
                </DropdownMenuLabel>
                {LINK_VARIABLES.map((v) => (
                  <DropdownMenuItem key={v.token} onClick={() => insertVariable(v.token)} className="cursor-pointer">
                    <div>
                      <p className="text-sm">{v.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{v.token}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs flex items-center gap-1.5">
                  <Variable className="h-3 w-3" /> Text Variables
                </DropdownMenuLabel>
                {TEXT_VARIABLES.map((v) => (
                  <DropdownMenuItem key={v.token} onClick={() => insertVariable(v.token)} className="cursor-pointer">
                    <div>
                      <p className="text-sm">{v.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{v.token}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Compose area */}
        <div className="flex-1 flex flex-col min-h-0 px-5 py-4 space-y-3">
          {/* Send To */}
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground shrink-0 w-16">Send to:</Label>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">
                {clientName}
              </Badge>
              <span className="text-xs text-muted-foreground">{clientEmail}</span>
            </div>
          </div>

          {/* Subject */}
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground shrink-0 w-16">Subject:</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="border-0 border-b rounded-none px-0 focus-visible:ring-0 shadow-none"
            />
          </div>

          <Separator />

          {/* Message body */}
          {showPreview ? (
            <ScrollArea className="flex-1 min-h-[300px] rounded-md border p-4">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </ScrollArea>
          ) : (
            <Textarea
              ref={messageRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here...&#10;&#10;Use the toolbar above to insert templates and variables like $trip_link or {{clientName}}."
              className="flex-1 min-h-[300px] resize-none border-0 focus-visible:ring-0 shadow-none px-0 text-sm"
            />
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t">
          <div className="flex items-center gap-2">
            {subject && message && (
              <>
                {!saveDialogOpen ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setSaveDialogOpen(true)}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Save as Template
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Template name..."
                      className="h-7 text-xs w-40"
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveAsTemplate} disabled={saveTemplate.isPending}>
                      {saveTemplate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              {showPreview ? "Edit" : "Preview"}
            </Button>
            <Button size="sm" className="h-7" onClick={handleSend} disabled={sending}>
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1" />
              )}
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
