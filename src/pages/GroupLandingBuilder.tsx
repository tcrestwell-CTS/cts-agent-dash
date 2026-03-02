import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Globe,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  FileText,
  CheckCircle2,
  ImagePlus,
  Link,
  X,
  Loader2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  GripVertical,
  Plus,
  Trash2,
  Type,
  ClipboardPaste,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────
interface FeatureImage {
  id: string;
  url: string;
  caption?: string;
}

interface AdditionalSection {
  id: string;
  title: string;
  content: string;
}

interface LandingContent {
  feature_images: FeatureImage[];
  additional_sections: AdditionalSection[];
}

const generateId = () => crypto.randomUUID();

// ─── Component ────────────────────────────────────────
const GroupLandingBuilder = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trip, setTrip] = useState<any>(null);

  // Core fields
  const [landingEnabled, setLandingEnabled] = useState(false);
  const [landingHeadline, setLandingHeadline] = useState("");
  const [landingDescription, setLandingDescription] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");

  // Rich content
  const [featureImages, setFeatureImages] = useState<FeatureImage[]>([]);
  const [additionalSections, setAdditionalSections] = useState<AdditionalSection[]>([]);

  // UI state
  const [heroUrlInput, setHeroUrlInput] = useState("");
  const [showHeroUrlInput, setShowHeroUrlInput] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingFeature, setUploadingFeature] = useState(false);
  const [featureUrlInput, setFeatureUrlInput] = useState("");
  const [showFeatureUrlInput, setShowFeatureUrlInput] = useState(false);
  const [dragOverFeature, setDragOverFeature] = useState(false);
  const [draggedImageIdx, setDraggedImageIdx] = useState<number | null>(null);

  const heroFileRef = useRef<HTMLInputElement>(null);
  const featureFileRef = useRef<HTMLInputElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const featureDropRef = useRef<HTMLDivElement>(null);

  // ─── Fetch ────────────────────────────────────────
  const fetchTrip = async () => {
    if (!tripId) return;
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (error || !data) {
      toast.error("Trip not found");
      navigate("/trips");
      return;
    }

    const d = data as any;
    if (d.trip_type !== "group") {
      toast.error("Landing pages are only available for group trips");
      navigate(`/trips/${tripId}`);
      return;
    }

    setTrip(d);
    setLandingEnabled(d.group_landing_enabled || false);
    setLandingHeadline(d.group_landing_headline || "");
    setLandingDescription(d.group_landing_description || "");
    setHeroImageUrl(d.cover_image_url || "");

    const content: LandingContent = d.group_landing_content || {
      feature_images: [],
      additional_sections: [],
    };
    setFeatureImages(content.feature_images || []);
    setAdditionalSections(content.additional_sections || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  // ─── Overview rich-text init ──────────────────────
  useEffect(() => {
    if (overviewRef.current && landingDescription && !overviewRef.current.innerHTML) {
      overviewRef.current.innerHTML = landingDescription;
    }
  }, [landingDescription, loading]);

  // ─── Toggle ───────────────────────────────────────
  const handleToggle = async (enabled: boolean) => {
    setLandingEnabled(enabled);
    const { error } = await supabase
      .from("trips")
      .update({ group_landing_enabled: enabled } as any)
      .eq("id", tripId!);
    if (error) {
      toast.error("Failed to update");
      setLandingEnabled(!enabled);
    } else {
      toast.success(enabled ? "Landing page enabled" : "Landing page disabled");
    }
  };

  // ─── Save all ─────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    const overviewHtml = overviewRef.current?.innerHTML || landingDescription;
    const content: LandingContent = {
      feature_images: featureImages,
      additional_sections: additionalSections,
    };

    const { error } = await supabase
      .from("trips")
      .update({
        group_landing_headline: landingHeadline || null,
        group_landing_description: overviewHtml || null,
        cover_image_url: heroImageUrl || null,
        group_landing_content: content,
      } as any)
      .eq("id", tripId!);

    if (error) {
      toast.error("Failed to save changes");
    } else {
      setLandingDescription(overviewHtml);
      toast.success("Landing page saved");
    }
    setSaving(false);
  };

  // ─── Overview formatting ──────────────────────────
  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    overviewRef.current?.focus();
  };

  // ─── Hero image ───────────────────────────────────
  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploadingHero(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tripId}/landing-hero.${ext}`;
      const { error } = await supabase.storage.from("trip-covers").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("trip-covers").getPublicUrl(path);
      setHeroImageUrl(publicUrl);
      await supabase.from("trips").update({ cover_image_url: publicUrl } as any).eq("id", tripId!);
      toast.success("Hero image uploaded");
    } catch { toast.error("Failed to upload image"); }
    finally { setUploadingHero(false); if (heroFileRef.current) heroFileRef.current.value = ""; }
  };

  const handleHeroUrlSubmit = async () => {
    if (!heroUrlInput.trim()) return;
    setHeroImageUrl(heroUrlInput.trim());
    setShowHeroUrlInput(false);
    await supabase.from("trips").update({ cover_image_url: heroUrlInput.trim() } as any).eq("id", tripId!);
    toast.success("Hero image URL saved");
    setHeroUrlInput("");
  };

  const handleRemoveHero = async () => {
    setHeroImageUrl("");
    await supabase.from("trips").update({ cover_image_url: null } as any).eq("id", tripId!);
    toast.success("Hero image removed");
  };

  const handleHeroPaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setUploadingHero(true);
          try {
            const ext = file.type.split("/")[1] || "png";
            const path = `${tripId}/hero-${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from("trip-covers").upload(path, file, { upsert: true });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from("trip-covers").getPublicUrl(path);
            setHeroImageUrl(publicUrl);
            await supabase.from("trips").update({ cover_image_url: publicUrl } as any).eq("id", tripId!);
            toast.success("Hero image pasted");
          } catch { toast.error("Failed to upload pasted image"); }
          finally { setUploadingHero(false); }
          return;
        }
      }
    }
    // Check for pasted URL text
    const text = e.clipboardData.getData("text/plain");
    if (text && (text.startsWith("http://") || text.startsWith("https://")) && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(text)) {
      e.preventDefault();
      setHeroImageUrl(text);
      await supabase.from("trips").update({ cover_image_url: text } as any).eq("id", tripId!);
      toast.success("Hero image added from clipboard");
    }
  }, [tripId]);

  // ─── Feature images ───────────────────────────────
  const uploadFeatureImage = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploadingFeature(true);
    try {
      const id = generateId();
      const ext = file.name.split(".").pop();
      const path = `${tripId}/feature-${id}.${ext}`;
      const { error } = await supabase.storage.from("trip-covers").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("trip-covers").getPublicUrl(path);
      setFeatureImages((prev) => [...prev, { id, url: publicUrl }]);
      toast.success("Image added");
    } catch { toast.error("Failed to upload image"); }
    finally { setUploadingFeature(false); if (featureFileRef.current) featureFileRef.current.value = ""; }
  };

  const handleFeatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFeatureImage(file);
  };

  const handleFeatureUrlAdd = () => {
    if (!featureUrlInput.trim()) return;
    setFeatureImages((prev) => [...prev, { id: generateId(), url: featureUrlInput.trim() }]);
    setFeatureUrlInput("");
    setShowFeatureUrlInput(false);
    toast.success("Image added");
  };

  const removeFeatureImage = (id: string) => {
    setFeatureImages((prev) => prev.filter((img) => img.id !== id));
  };

  const updateFeatureCaption = (id: string, caption: string) => {
    setFeatureImages((prev) => prev.map((img) => (img.id === id ? { ...img, caption } : img)));
  };

  // Drag & drop for feature images (file drop)
  const handleFeatureDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverFeature(false);

      // If it's a reorder drag (internal), handle reorder
      if (draggedImageIdx !== null) {
        const targetEl = (e.target as HTMLElement).closest("[data-img-idx]");
        if (targetEl) {
          const targetIdx = parseInt(targetEl.getAttribute("data-img-idx") || "0");
          if (targetIdx !== draggedImageIdx) {
            setFeatureImages((prev) => {
              const updated = [...prev];
              const [moved] = updated.splice(draggedImageIdx, 1);
              updated.splice(targetIdx, 0, moved);
              return updated;
            });
          }
        }
        setDraggedImageIdx(null);
        return;
      }

      // External file drop
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        Array.from(files).forEach((file) => {
          if (file.type.startsWith("image/")) uploadFeatureImage(file);
        });
        return;
      }

      // URL drop / text
      const url = e.dataTransfer.getData("text/plain");
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        setFeatureImages((prev) => [...prev, { id: generateId(), url }]);
        toast.success("Image added");
      }
    },
    [draggedImageIdx, tripId]
  );

  // Paste handler for feature images
  const handleFeaturePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            uploadFeatureImage(file);
            return;
          }
        }
      }
      // Check for pasted URL text
      const text = e.clipboardData.getData("text/plain");
      if (text && (text.startsWith("http://") || text.startsWith("https://")) && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(text)) {
        e.preventDefault();
        setFeatureImages((prev) => [...prev, { id: generateId(), url: text }]);
        toast.success("Image added from clipboard");
      }
    },
    [tripId]
  );

  // ─── Additional sections ──────────────────────────
  const addSection = () => {
    setAdditionalSections((prev) => [
      ...prev,
      { id: generateId(), title: "", content: "" },
    ]);
  };

  const updateSection = (id: string, field: "title" | "content", value: string) => {
    setAdditionalSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const removeSection = (id: string) => {
    setAdditionalSections((prev) => prev.filter((s) => s.id !== id));
  };

  // ─── URL ──────────────────────────────────────────
  const PRODUCTION_DOMAIN = "https://app.crestwelltravels.com";
  const landingUrl = trip?.share_token ? `${PRODUCTION_DOMAIN}/group/${trip.share_token}` : null;
  const copyUrl = () => {
    if (landingUrl) { navigator.clipboard.writeText(landingUrl); toast.success("Link copied!"); }
  };

  // ─── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* ─── Header ──────────────────────────────── */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/trips/${tripId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Group Landing Page</h1>
            <p className="text-muted-foreground text-sm">
              {trip?.trip_name} — Build and manage the public signup page
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              landingEnabled
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-muted text-muted-foreground"
            }
          >
            {landingEnabled ? (
              <><Eye className="h-3 w-3 mr-1" /> Live</>
            ) : (
              <><EyeOff className="h-3 w-3 mr-1" /> Draft</>
            )}
          </Badge>
        </div>

        {/* ─── Page Status ─────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" /> Page Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable Landing Page</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, clients can visit the public URL and sign up for your group trip.
                </p>
              </div>
              <Switch checked={landingEnabled} onCheckedChange={handleToggle} />
            </div>
            {landingUrl && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Public URL</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={landingUrl} className="text-xs font-mono" onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <Button size="sm" variant="outline" onClick={copyUrl}><Copy className="h-3.5 w-3.5" /></Button>
                  {landingEnabled && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={landingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                    </Button>
                  )}
                </div>
                {!landingEnabled && (
                  <p className="text-xs text-destructive/80">Enable the landing page to make this URL accessible to clients.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── 1. Page Title ───────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="h-4 w-4" /> Page Title
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder={trip?.trip_name || "Join Our Amazing Group Trip!"}
              value={landingHeadline}
              onChange={(e) => setLandingHeadline(e.target.value)}
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Defaults to the trip name if left blank.
            </p>
          </CardContent>
        </Card>

        {/* ─── 2. Overview (Rich Text) ─────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Overview
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Describe what makes this trip special. Use the toolbar to format your text.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Formatting toolbar */}
            <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30">
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => execFormat("bold")} title="Bold">
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => execFormat("italic")} title="Italic">
                <Italic className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => execFormat("underline")} title="Underline">
                <Underline className="h-3.5 w-3.5" />
              </Button>
              <Separator orientation="vertical" className="h-5 mx-1" />
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => execFormat("insertUnorderedList")} title="Bullet List">
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => execFormat("insertOrderedList")} title="Numbered List">
                <ListOrdered className="h-3.5 w-3.5" />
              </Button>
            </div>
            {/* Editable area */}
            <div
              ref={overviewRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 prose prose-sm max-w-none"
              style={{ wordBreak: "break-word" }}
              data-placeholder="Share what makes this trip special — highlights, inclusions, what's planned..."
            />
          </CardContent>
        </Card>

        {/* ─── 3. Hero Image ───────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImagePlus className="h-4 w-4" /> Hero Image
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Upload an image or paste a URL. Displays as the main banner.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {heroImageUrl ? (
              <div className="relative group rounded-lg overflow-hidden border">
                <img src={heroImageUrl} alt="Landing page hero" className="w-full h-48 object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => heroFileRef.current?.click()} disabled={uploadingHero}>
                    {uploadingHero ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />} Replace
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleRemoveHero}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  onPaste={handleHeroPaste}
                  tabIndex={0}
                  onClick={() => heroFileRef.current?.click()}
                  className="w-full h-36 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {uploadingHero ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                    <>
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-sm font-medium">Upload Hero Image</span>
                      <div className="flex items-center gap-2 text-xs">
                        <ClipboardPaste className="h-3.5 w-3.5" />
                        <span>Paste an image from clipboard (Ctrl+V / Cmd+V)</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><div className="flex-1 h-px bg-border" /><span>or</span><div className="flex-1 h-px bg-border" /></div>
                {showHeroUrlInput ? (
                  <div className="flex gap-2">
                    <Input placeholder="https://example.com/image.jpg" value={heroUrlInput} onChange={(e) => setHeroUrlInput(e.target.value)} className="text-sm" />
                    <Button size="sm" onClick={handleHeroUrlSubmit} disabled={!heroUrlInput.trim()}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowHeroUrlInput(false); setHeroUrlInput(""); }}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setShowHeroUrlInput(true)}>
                    <Link className="h-3.5 w-3.5 mr-1.5" /> Paste Image
                  </Button>
                )}
              </div>
            )}
            <input ref={heroFileRef} type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
          </CardContent>
        </Card>

        {/* ─── 4. Feature Images ───────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImagePlus className="h-4 w-4" /> Feature Images
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Drag and drop images, upload files, or paste images. Drag to reorder.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Image gallery */}
            {featureImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {featureImages.map((img, idx) => (
                  <div
                    key={img.id}
                    data-img-idx={idx}
                    draggable
                    onDragStart={() => setDraggedImageIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedImageIdx !== null && draggedImageIdx !== idx) {
                        setFeatureImages((prev) => {
                          const updated = [...prev];
                          const [moved] = updated.splice(draggedImageIdx, 1);
                          updated.splice(idx, 0, moved);
                          return updated;
                        });
                        setDraggedImageIdx(null);
                      }
                    }}
                    onDragEnd={() => setDraggedImageIdx(null)}
                    className={`relative group rounded-lg overflow-hidden border bg-muted/20 cursor-grab active:cursor-grabbing ${
                      draggedImageIdx === idx ? "opacity-50 ring-2 ring-primary" : ""
                    }`}
                  >
                    <img src={img.url} alt={img.caption || "Feature"} className="w-full h-28 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => removeFeatureImage(img.id)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    </div>
                    <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="h-4 w-4 text-white drop-shadow" />
                    </div>
                    <Input
                      placeholder="Caption (optional)"
                      value={img.caption || ""}
                      onChange={(e) => updateFeatureCaption(img.id, e.target.value)}
                      className="text-xs border-0 border-t rounded-none h-7 bg-background/80"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone / paste zone */}
            <div
              ref={featureDropRef}
              onDragOver={(e) => { e.preventDefault(); if (draggedImageIdx === null) setDragOverFeature(true); }}
              onDragLeave={() => setDragOverFeature(false)}
              onDrop={(e) => { setDragOverFeature(false); handleFeatureDrop(e); }}
              onPaste={handleFeaturePaste}
              tabIndex={0}
              className={`w-full rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground p-6 focus:outline-none focus:ring-2 focus:ring-ring ${
                dragOverFeature
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:text-primary"
              }`}
            >
              {uploadingFeature ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Drop images here, or click to upload
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>You can also paste an image from your clipboard (Ctrl+V / Cmd+V)</span>
                  </div>
                </>
              )}
            </div>

            {/* Upload / URL buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => featureFileRef.current?.click()} disabled={uploadingFeature}>
                <ImagePlus className="h-3.5 w-3.5 mr-1.5" /> Upload Image
              </Button>
              {showFeatureUrlInput ? (
                <div className="flex gap-2 flex-1">
                  <Input placeholder="https://example.com/photo.jpg" value={featureUrlInput} onChange={(e) => setFeatureUrlInput(e.target.value)} className="text-sm" />
                  <Button size="sm" onClick={handleFeatureUrlAdd} disabled={!featureUrlInput.trim()}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowFeatureUrlInput(false); setFeatureUrlInput(""); }}>Cancel</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowFeatureUrlInput(true)}>
                  <Link className="h-3.5 w-3.5 mr-1.5" /> Paste Image
                </Button>
              )}
            </div>
            <input ref={featureFileRef} type="file" accept="image/*" className="hidden" onChange={handleFeatureUpload} />
          </CardContent>
        </Card>

        {/* ─── 5. Additional Sections ──────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Additional Information
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Add extra sections for details like pricing, included items, travel tips, etc.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {additionalSections.map((section, idx) => (
              <div key={section.id} className="space-y-2 p-4 border rounded-lg bg-muted/10 relative group">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Section {idx + 1}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => removeSection(section.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  placeholder="Section Title"
                  value={section.title}
                  onChange={(e) => updateSection(section.id, "title", e.target.value)}
                  className="font-medium"
                />
                <Textarea
                  placeholder="Section content..."
                  value={section.content}
                  onChange={(e) => updateSection(section.id, "content", e.target.value)}
                  rows={4}
                />
              </div>
            ))}

            <Button variant="outline" className="w-full" onClick={addSection}>
              <Plus className="h-4 w-4 mr-2" /> Add Section
            </Button>
          </CardContent>
        </Card>

        {/* ─── Save Bar ────────────────────────────── */}
        <div className="sticky bottom-4 z-10">
          <Card className="shadow-lg border-primary/20">
            <CardContent className="py-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Remember to save your changes before leaving.
              </p>
              <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save All Changes"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ─── Checklist ───────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Landing Page Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <ChecklistItem done={!!landingHeadline} label="Page title set" />
              <ChecklistItem done={!!(overviewRef.current?.textContent?.trim() || landingDescription)} label="Overview written" />
              <ChecklistItem done={!!heroImageUrl} label="Hero image added" />
              <ChecklistItem done={featureImages.length > 0} label="Feature images added" />
              <ChecklistItem done={!!trip?.destination} label="Destination set" />
              <ChecklistItem done={!!trip?.depart_date} label="Travel dates added" />
              <ChecklistItem done={landingEnabled} label="Page enabled" />
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <div
        className={`h-4 w-4 rounded-full flex items-center justify-center text-xs ${
          done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "✓" : "–"}
      </div>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

export default GroupLandingBuilder;
