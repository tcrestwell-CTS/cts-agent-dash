import { useState, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Mail,
  Loader2,
  Send,
  Save,
  Eye,
  FileText,
  Trash2,
} from "lucide-react";
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
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Email Notification — {tripName}</DialogTitle>
          <DialogDescription>
            Send an email to {clientName} ({clientEmail})
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="templates">Built-In</TabsTrigger>
            <TabsTrigger value="saved">
              My Templates
              {savedTemplates.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                  {savedTemplates.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="flex-1 flex flex-col min-h-0 space-y-4 mt-4">
            <div className="space-y-2">
              <Label>To</Label>
              <Input value={clientEmail} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>
            <div className="flex-1 min-h-0 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Message *</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {showPreview ? "Edit" : "Preview"}
                </Button>
              </div>

              {/* Variable insertion toolbar */}
              {!showPreview && (
                <div className="flex flex-wrap gap-1.5">
                  <TooltipProvider delayDuration={200}>
                    {LINK_VARIABLES.map((v) => (
                      <Tooltip key={v.token}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => insertVariable(v.token)}
                          >
                            🔗 {v.label}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">{v.description}</p>
                          <p className="text-xs text-muted-foreground font-mono">{v.token}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {TEXT_VARIABLES.map((v) => (
                      <Tooltip key={v.token}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => insertVariable(v.token)}
                          >
                            {v.label}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs font-mono">{v.token}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>
              )}

              {showPreview ? (
                <ScrollArea className="h-[300px] rounded-md border p-4">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </ScrollArea>
              ) : (
                <Textarea
                  ref={messageRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message here... Click variable buttons above to insert links and placeholders."
                  rows={12}
                  className="resize-none h-[260px]"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Variables like <code className="bg-muted px-1 rounded">$trip_link</code> will be replaced with actual URLs when sent.
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                {subject && message && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveDialogOpen(!saveDialogOpen)}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save as Template
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSend} disabled={sending}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Email
                </Button>
              </div>
            </div>

            {saveDialogOpen && (
              <div className="flex items-end gap-2 p-3 rounded-lg border bg-muted/50">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Template Name</Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Cruise Update Notification"
                    className="h-8"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveAsTemplate}
                  disabled={saveTemplate.isPending}
                >
                  {saveTemplate.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSaveDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <ScrollArea className="h-[450px]">
              <div className="space-y-3 pr-4">
                {builtInTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-lg border p-4 hover:border-accent transition-colors cursor-pointer"
                    onClick={() => applyTemplate(template)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{template.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {template.category.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      <span className="font-medium">Subject:</span> {template.subject}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.body.substring(0, 120)}...
                    </p>
                    <Button variant="link" size="sm" className="px-0 mt-1 h-auto text-xs">
                      Use this template →
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="saved" className="mt-4">
            <ScrollArea className="h-[450px]">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : savedTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No saved templates yet</p>
                  <p className="text-xs mt-1">
                    Compose an email and click "Save as Template" to build your library.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {savedTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-lg border p-4 hover:border-accent transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4
                          className="font-medium text-sm cursor-pointer hover:text-accent"
                          onClick={() => applyTemplate(template)}
                        >
                          {template.name}
                        </h4>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                          {!template.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteTemplate.mutate(template.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        <span className="font-medium">Subject:</span> {template.subject}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.body_html.substring(0, 120)}...
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="px-0 mt-1 h-auto text-xs"
                        onClick={() => applyTemplate(template)}
                      >
                        Use this template →
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
