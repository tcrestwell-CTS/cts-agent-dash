import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Webhook, Send, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useGetWebhookConfig, useUpsertWebhookConfig } from "@/hooks/useWebhookConfiguration";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const EXAMPLE_PAYLOAD = {
  lead_id: "abc123",
  name: "John Smith",
  email: "john@example.com",
  phone: "(555) 123-4567",
  location: "Phoenix, AZ",
  budget: "$45k - $60k",
  project_type: "Full Kitchen Remodel",
  timeline: "1-3 Months",
};

export function LeadsWebhookConfig() {
  const { data: config, isLoading } = useGetWebhookConfig();
  const upsert = useUpsertWebhookConfig();
  const { toast } = useToast();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [httpMethod, setHttpMethod] = useState("POST");
  const [dataFormat, setDataFormat] = useState("JSON");
  const [isActive, setIsActive] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (config) {
      setWebhookUrl(config.webhook_url ?? "");
      setHttpMethod(config.http_method);
      setDataFormat(config.data_format);
      setIsActive(config.is_active);
    }
  }, [config]);

  const handleSave = () => {
    upsert.mutate({
      webhook_url: webhookUrl || null,
      http_method: httpMethod,
      data_format: dataFormat,
      is_active: isActive,
    });
  };

  const handleTest = async () => {
    if (!webhookUrl) {
      toast({ title: "No URL configured", description: "Please enter a webhook URL first.", variant: "destructive" });
      return;
    }
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-webhook", {
        body: { webhook_url: webhookUrl, http_method: httpMethod },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Webhook test successful", description: `Received status ${data.status} from your endpoint.` });
      } else {
        toast({
          title: "Webhook test failed",
          description: data?.error || `Status: ${data?.status} ${data?.statusText}`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Webhook className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Webhook Configuration</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Configure how you receive lead data via webhook integration
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
              {isActive ? "Active" : "Inactive"}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-5">
          {/* Webhook URL */}
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://your-crm.com/api/leads"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">The endpoint where lead data will be sent automatically</p>
          </div>

          {/* HTTP Method + Data Format */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>HTTP Method</Label>
              <Select value={httpMethod} onValueChange={setHttpMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">HTTP POST</SelectItem>
                  <SelectItem value="GET">HTTP GET</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {httpMethod === "POST"
                  ? "POST sends data in body, GET sends as query params"
                  : "GET sends data as query parameters in the URL"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Data Format</Label>
              <Select value={dataFormat} onValueChange={setDataFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JSON">JSON</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Format of the lead data sent to your endpoint</p>
            </div>
          </div>

          {/* Example Payload */}
          <div className="space-y-1.5">
            <Label>Example Payload ({dataFormat})</Label>
            <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto text-foreground leading-relaxed">
              {JSON.stringify(EXAMPLE_PAYLOAD, null, 2)}
            </pre>
          </div>

          {/* Active Toggle + Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Switch
                id="webhook-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="webhook-active" className="cursor-pointer">
                {isActive ? "Webhook active" : "Webhook inactive"}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={isTesting || !webhookUrl}
              >
                <Send className="h-4 w-4 mr-1.5" />
                {isTesting ? "Sending..." : "Test Webhook"}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={upsert.isPending || isLoading}
              >
                <Save className="h-4 w-4 mr-1.5" />
                {upsert.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
