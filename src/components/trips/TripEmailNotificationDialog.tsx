import { useState, useMemo, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Link as LinkIcon,
  Variable,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Palette,
  Type,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const TEXT_COLORS = [
  { color: "#000000", label: "Black" },
  { color: "#142236", label: "Navy" },
  { color: "#c9a84c", label: "Gold" },
  { color: "#dc2626", label: "Red" },
  { color: "#16a34a", label: "Green" },
  { color: "#2563eb", label: "Blue" },
  { color: "#7c3aed", label: "Purple" },
  { color: "#71717a", label: "Gray" },
];

const FONT_SIZES = [
  { value: "1", label: "Small" },
  { value: "3", label: "Normal" },
  { value: "4", label: "Medium" },
  { value: "5", label: "Large" },
  { value: "6", label: "X-Large" },
];

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
  const [messageHtml, setMessageHtml] = useState("");
  const [activeTab, setActiveTab] = useState<string>("compose");
  const [showPreview, setShowPreview] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

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

  const execCommand = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    // Sync state after command
    setTimeout(() => {
      if (editorRef.current) {
        setMessageHtml(editorRef.current.innerHTML);
      }
    }, 0);
  }, []);

  const insertVariable = useCallback((token: string) => {
    editorRef.current?.focus();
    document.execCommand("insertText", false, token);
    setTimeout(() => {
      if (editorRef.current) {
        setMessageHtml(editorRef.current.innerHTML);
      }
    }, 0);
  }, []);

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setMessageHtml(editorRef.current.innerHTML);
    }
  }, []);

  const builtInTemplates: BuiltInTemplate[] = useMemo(
    () => [
      {
        id: "trip_update",
        name: "Trip Update",
        subject: `Update on your trip: ${tripName}`,
        body: `Hi ${clientName},<br><br>We have an update regarding your upcoming trip "${tripName}"${destination ? ` to ${destination}` : ""}.<br><br>[Enter your update details here]<br><br>Please don't hesitate to reach out if you have any questions.<br><br>Best regards`,
        category: "trip_update",
      },
      {
        id: "itinerary_change",
        name: "Itinerary Change",
        subject: `Itinerary update for ${tripName}`,
        body: `Hi ${clientName},<br><br>There has been a change to the itinerary for your trip "${tripName}"${departDate ? ` departing ${departDate}` : ""}.<br><br>[Describe the itinerary changes here]<br><br>The updated itinerary is available in your client portal.<br><br>Best regards`,
        category: "trip_update",
      },
      {
        id: "payment_reminder",
        name: "Payment Reminder",
        subject: `Payment reminder for ${tripName}`,
        body: `Hi ${clientName},<br><br>This is a friendly reminder regarding an upcoming payment for your trip "${tripName}"${destination ? ` to ${destination}` : ""}.<br><br>[Enter payment details and deadline here]<br><br>You can make your payment through the client portal.<br><br>Best regards`,
        category: "payment",
      },
      {
        id: "travel_docs",
        name: "Travel Documents Reminder",
        subject: `Travel documents needed for ${tripName}`,
        body: `Hi ${clientName},<br><br>As your departure date${departDate ? ` (${departDate})` : ""} approaches for "${tripName}", please ensure you have the following documents ready:<br><br><ul><li>Valid passport (check expiration date)</li><li>Visa (if applicable)</li><li>Travel insurance documentation</li><li>Vaccination records (if required)</li></ul><br>[Add any trip-specific document requirements here]<br><br>Best regards`,
        category: "general",
      },
      {
        id: "pre_departure",
        name: "Pre-Departure Info",
        subject: `Pre-departure information for ${tripName}`,
        body: `Hi ${clientName},<br><br>Your trip "${tripName}"${destination ? ` to ${destination}` : ""} is just around the corner${departDate ? ` (${departDate})` : ""}! Here are some important things to keep in mind:<br><br>[Add pre-departure checklist items here]<br><br>Have a wonderful trip!<br><br>Best regards`,
        category: "trip_update",
      },
    ],
    [tripName, clientName, destination, departDate, returnDate]
  );

  const applyTemplate = (template: BuiltInTemplate | EmailTemplate) => {
    let body: string;
    if ("body" in template) {
      setSubject(template.subject);
      body = template.body;
    } else {
      setSubject(template.subject);
      body = template.body_html;
    }
    // Replace placeholders
    body = body.replace(/\{\{clientName\}\}/g, clientName);
    body = body.replace(/\{\{tripName\}\}/g, tripName);
    body = body.replace(/\{\{destination\}\}/g, destination || "");
    body = body.replace(/\{\{departDate\}\}/g, departDate || "");
    body = body.replace(/\{\{returnDate\}\}/g, returnDate || "");
    setMessageHtml(body);
    if (editorRef.current) {
      editorRef.current.innerHTML = body;
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    await saveTemplate.mutateAsync({
      name: templateName,
      subject,
      body_html: messageHtml,
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
    const plainText = editorRef.current?.textContent || "";
    if (!plainText.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setSending(true);
    try {
      const resolvedSubject = resolveVariables(subject);
      let resolvedHtml = resolveVariables(messageHtml);
      // Auto-link plain URLs not already in <a> tags
      resolvedHtml = resolvedHtml.replace(
        /(?<!href=["'])(?<!["'])(https?:\/\/[^\s<"']+)/g,
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
      setMessageHtml("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      setShowPreview(false);
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const previewHtml = useMemo(() => {
    let resolved = resolveVariables(messageHtml);
    // Auto-link plain URLs
    resolved = resolved.replace(
      /(?<!href=["'])(?<!["'])(https?:\/\/[^\s<"']+)/g,
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
          <div style="color: #4a5568; font-size: 14px; line-height: 1.7;">${resolved}</div>
        </div>
        <div style="background: #f7f5f0; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #718096; font-size: 12px; margin: 0;">Crestwell Travel Services</p>
        </div>
      </div>
    `;
  }, [messageHtml, subject, tripLink, portalLink, clientName, tripName, destination, departDate, returnDate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Mail className="h-4 w-4 mr-2" />
          Notify Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Top toolbar */}
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

          {/* Formatting toolbar */}
          {!showPreview && (
            <div className="flex items-center gap-0.5 p-1.5 rounded-md border bg-muted/30 flex-wrap">
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Bold"
                onMouseDown={(e) => { e.preventDefault(); execCommand("bold"); }}>
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Italic"
                onMouseDown={(e) => { e.preventDefault(); execCommand("italic"); }}>
                <Italic className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Underline"
                onMouseDown={(e) => { e.preventDefault(); execCommand("underline"); }}>
                <Underline className="h-3.5 w-3.5" />
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Bullet List"
                onMouseDown={(e) => { e.preventDefault(); execCommand("insertUnorderedList"); }}>
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Numbered List"
                onMouseDown={(e) => { e.preventDefault(); execCommand("insertOrderedList"); }}>
                <ListOrdered className="h-3.5 w-3.5" />
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1" />

              {/* Font Size */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 gap-1 text-xs" title="Font Size">
                    <Type className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32">
                  {FONT_SIZES.map((fs) => (
                    <DropdownMenuItem key={fs.value} className="cursor-pointer text-sm"
                      onMouseDown={(e) => { e.preventDefault(); }}
                      onClick={() => execCommand("fontSize", fs.value)}>
                      {fs.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Text Color */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 gap-1 text-xs" title="Text Color">
                    <Palette className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="grid grid-cols-4 gap-1.5">
                    {TEXT_COLORS.map((tc) => (
                      <button
                        key={tc.color}
                        title={tc.label}
                        className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: tc.color }}
                        onMouseDown={(e) => { e.preventDefault(); execCommand("foreColor", tc.color); }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Message body */}
          {showPreview ? (
            <ScrollArea className="flex-1 min-h-[300px] rounded-md border p-4">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </ScrollArea>
          ) : (
            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorInput}
              data-placeholder="Write your message here..."
              className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto text-sm text-foreground outline-none focus:outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:pointer-events-none"
              style={{ lineHeight: 1.7 }}
            />
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t">
          <div className="flex items-center gap-2">
            {subject && messageHtml && (
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
