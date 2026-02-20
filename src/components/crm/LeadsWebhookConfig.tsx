import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Webhook, Send, Save, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, Loader2, AlertCircle,
} from "lucide-react";
import { useGetWebhookConfig, useUpsertWebhookConfig } from "@/hooks/useWebhookConfiguration";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

interface TestResult {
  success: boolean;
  status?: number;
  statusText?: string;
  error?: string;
  latencyMs: number;
  sentAt: string;
  payload: object;
  url: string;
  method: string;
}

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
  const [testResult, setTestResult] = useState<TestResult | null>(null);

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
    setTestResult(null);
    const sentAt = new Date().toISOString();
    const t0 = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke("test-webhook", {
        body: { webhook_url: webhookUrl, http_method: httpMethod },
      });
      const latencyMs = Date.now() - t0;

      if (error) throw error;

      const result: TestResult = {
        success: data?.success ?? false,
        status: data?.status,
        statusText: data?.statusText,
        error: data?.error,
        latencyMs,
        sentAt,
        payload: { ...EXAMPLE_PAYLOAD, test: true, sent_at: sentAt },
        url: webhookUrl,
        method: httpMethod,
      };
      setTestResult(result);
    } catch (err: any) {
      const latencyMs = Date.now() - t0;
      setTestResult({
        success: false,
        error: err.message,
        latencyMs,
        sentAt,
        payload: { ...EXAMPLE_PAYLOAD, test: true, sent_at: sentAt },
        url: webhookUrl,
        method: httpMethod,
      });
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
              onChange={(e) => { setWebhookUrl(e.target.value); setTestResult(null); }}
            />
            <p className="text-xs text-muted-foreground">The endpoint where lead data will be sent automatically</p>
          </div>

          {/* HTTP Method + Data Format */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>HTTP Method</Label>
              <Select value={httpMethod} onValueChange={(v) => { setHttpMethod(v); setTestResult(null); }}>
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
                {isTesting
                  ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  : <Send className="h-4 w-4 mr-1.5" />}
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

          {/* ── Test Result Panel ── */}
          {testResult && (
            <>
              <Separator />
              <div className="space-y-3">
                {/* Status headline */}
                <div className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5",
                  testResult.success
                    ? "bg-success/10 border border-success/20"
                    : "bg-destructive/10 border border-destructive/20"
                )}>
                  {testResult.success
                    ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  <span className={cn(
                    "text-sm font-medium",
                    testResult.success ? "text-success" : "text-destructive"
                  )}>
                    {testResult.success ? "Payload delivered successfully" : "Delivery failed"}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {testResult.latencyMs}ms
                  </span>
                </div>

                {/* Request metadata table */}
                <div className="rounded-lg border border-border/50 overflow-hidden text-xs">
                  <div className="bg-muted/50 px-3 py-1.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                    Request Details
                  </div>
                  <div className="divide-y divide-border/40">
                    <div className="flex items-center px-3 py-2 gap-3">
                      <span className="text-muted-foreground w-24 shrink-0">Method</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{testResult.method}</Badge>
                    </div>
                    <div className="flex items-start px-3 py-2 gap-3">
                      <span className="text-muted-foreground w-24 shrink-0">Endpoint</span>
                      <span className="font-mono break-all text-foreground">{testResult.url}</span>
                    </div>
                    <div className="flex items-center px-3 py-2 gap-3">
                      <span className="text-muted-foreground w-24 shrink-0">Sent at</span>
                      <span className="font-mono text-foreground">
                        {new Date(testResult.sentAt).toLocaleString()}
                      </span>
                    </div>
                    {testResult.status != null && (
                      <div className="flex items-center px-3 py-2 gap-3">
                        <span className="text-muted-foreground w-24 shrink-0">Response</span>
                        <Badge
                          variant={testResult.success ? "default" : "destructive"}
                          className="text-[10px] font-mono"
                        >
                          {testResult.status} {testResult.statusText}
                        </Badge>
                      </div>
                    )}
                    {testResult.error && (
                      <div className="flex items-start px-3 py-2 gap-3">
                        <span className="text-muted-foreground w-24 shrink-0">Error</span>
                        <span className="font-mono text-destructive break-all">{testResult.error}</span>
                      </div>
                    )}
                    <div className="flex items-center px-3 py-2 gap-3">
                      <span className="text-muted-foreground w-24 shrink-0">Latency</span>
                      <span className={cn(
                        "font-mono",
                        testResult.latencyMs < 500
                          ? "text-success"
                          : testResult.latencyMs < 2000
                          ? "text-accent"
                          : "text-destructive"
                      )}>
                        {testResult.latencyMs}ms
                        {testResult.latencyMs < 500 ? " (fast)" : testResult.latencyMs < 2000 ? " (ok)" : " (slow)"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payload sent */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    <AlertCircle className="h-3 w-3" />
                    Payload Sent
                  </div>
                  <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto text-foreground leading-relaxed">
                    {JSON.stringify(testResult.payload, null, 2)}
                  </pre>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Re-run the test any time to verify your endpoint is receiving data correctly.
                </p>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
