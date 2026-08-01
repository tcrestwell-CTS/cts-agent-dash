import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormFieldEditor } from "@/components/forms/FormFieldEditor";
import { IntakeFieldInput } from "@/components/forms/IntakeFieldInput";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  newField,
  slugifyForm,
  type IntakeField,
  type IntakeFieldType,
  type IntakeForm,
} from "@/lib/intakeForms";
import {
  useDeleteIntakeForm,
  useFormResponses,
  useIntakeForms,
  useSaveIntakeForm,
} from "@/hooks/useIntakeForms";

interface Draft {
  id?: string;
  title: string;
  description: string;
  slug: string;
  fields: IntakeField[];
  is_active: boolean;
  thank_you_message: string;
}

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  slug: "",
  fields: [newField("short_text")],
  is_active: true,
  thank_you_message: "Thanks! We've received your answers and will be in touch shortly.",
});

const toDraft = (form: IntakeForm): Draft => ({
  id: form.id,
  title: form.title,
  description: form.description ?? "",
  slug: form.slug,
  fields: Array.isArray(form.fields) ? form.fields : [],
  is_active: form.is_active,
  thank_you_message: form.thank_you_message ?? "",
});

export default function IntakeForms() {
  const { data: forms = [], isLoading } = useIntakeForms();
  const saveForm = useSaveIntakeForm();
  const deleteForm = useDeleteIntakeForm();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [addType, setAddType] = useState<IntakeFieldType>("short_text");
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [responsesFormId, setResponsesFormId] = useState<string | undefined>();
  const { data: responses = [] } = useFormResponses(responsesFormId);

  const selectedForm = useMemo(
    () => forms.find((f) => f.id === responsesFormId),
    [forms, responsesFormId],
  );

  const publicUrl = (slug: string) => `${window.location.origin}/intake/${slug}`;

  const patchField = (id: string, patch: Partial<IntakeField>) =>
    setDraft((d) =>
      d ? { ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) } : d,
    );

  const moveField = (index: number, direction: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const next = [...d.fields];
      const target = index + direction;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...d, fields: next };
    });

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return toast.error("Give the form a title");
    if (draft.fields.length === 0) return toast.error("Add at least one question");
    const slug = slugifyForm(draft.slug || draft.title);
    if (!slug) return toast.error("Slug is invalid");
    try {
      await saveForm.mutateAsync({
        id: draft.id,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        slug,
        fields: draft.fields,
        is_active: draft.is_active,
        thank_you_message: draft.thank_you_message.trim() || null,
      });
      toast.success(draft.id ? "Form updated" : "Form created");
      setDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the form");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Form Builder</h1>
            <p className="text-sm text-muted-foreground">
              Build client intake questionnaires and share them with a public link.
            </p>
          </div>
          {!draft && (
            <Button onClick={() => setDraft(emptyDraft())}>
              <Plus className="mr-2 h-4 w-4" />
              New form
            </Button>
          )}
        </div>

        {draft ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Form details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={draft.title}
                      placeholder="New Client Intake Questionnaire"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          title: e.target.value,
                          slug: draft.id ? draft.slug : slugifyForm(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intro / description</Label>
                    <Textarea
                      rows={3}
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Public link</Label>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs text-muted-foreground">/intake/</span>
                      <Input
                        value={draft.slug}
                        onChange={(e) => setDraft({ ...draft, slug: slugifyForm(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Thank-you message</Label>
                    <Textarea
                      rows={2}
                      value={draft.thank_you_message}
                      onChange={(e) => setDraft({ ...draft, thank_you_message: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="draft-active"
                      checked={draft.is_active}
                      onCheckedChange={(c) => setDraft({ ...draft, is_active: c })}
                    />
                    <Label htmlFor="draft-active" className="font-normal">
                      Accepting submissions
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {draft.fields.map((field, index) => (
                  <FormFieldEditor
                    key={field.id}
                    field={field}
                    index={index}
                    total={draft.fields.length}
                    onChange={(patch) => patchField(field.id, patch)}
                    onRemove={() =>
                      setDraft({ ...draft, fields: draft.fields.filter((f) => f.id !== field.id) })
                    }
                    onMove={(dir) => moveField(index, dir)}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={addType} onValueChange={(v) => setAddType(v as IntakeFieldType)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {FIELD_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => setDraft({ ...draft, fields: [...draft.fields, newField(addType)] })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add field
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saveForm.isPending}>
                    {saveForm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save form
                  </Button>
                </div>
              </div>
            </div>

            <Card className="h-fit lg:sticky lg:top-6">
              <CardHeader>
                <CardTitle className="text-base">Live preview</CardTitle>
                <CardDescription>How clients will see this form.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{draft.title || "Untitled form"}</h2>
                  {draft.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{draft.description}</p>
                  )}
                </div>
                <Separator />
                {draft.fields.map((field) => (
                  <IntakeFieldInput
                    key={field.id}
                    field={field}
                    value={previewValues[field.id]}
                    onChange={(v) => setPreviewValues((p) => ({ ...p, [field.id]: v }))}
                  />
                ))}
                <Button className="w-full" disabled>
                  Submit
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Tabs defaultValue="forms">
            <TabsList>
              <TabsTrigger value="forms">Forms</TabsTrigger>
              <TabsTrigger value="responses">Responses</TabsTrigger>
            </TabsList>

            <TabsContent value="forms" className="mt-4 space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground">Loading forms…</p>}
              {!isLoading && forms.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <ClipboardList className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No forms yet. Create your first client intake questionnaire.
                    </p>
                    <Button onClick={() => setDraft(emptyDraft())}>
                      <Plus className="mr-2 h-4 w-4" />
                      New form
                    </Button>
                  </CardContent>
                </Card>
              )}
              {forms.map((form) => (
                <Card key={form.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{form.title}</span>
                        <Badge variant={form.is_active ? "default" : "secondary"}>
                          {form.is_active ? "Active" : "Closed"}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {publicUrl(form.slug)} · {(form.fields ?? []).length} questions
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Copy public link"
                        onClick={() => {
                          navigator.clipboard.writeText(publicUrl(form.slug));
                          toast.success("Link copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDraft(toDraft(form))}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete form"
                        onClick={async () => {
                          if (!window.confirm(`Delete "${form.title}" and its responses?`)) return;
                          await deleteForm.mutateAsync(form.id);
                          toast.success("Form deleted");
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="responses" className="mt-4 space-y-4">
              <div className="max-w-sm space-y-2">
                <Label>Form</Label>
                <Select value={responsesFormId ?? ""} onValueChange={setResponsesFormId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a form" />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {responsesFormId && responses.length === 0 && (
                <p className="text-sm text-muted-foreground">No responses yet.</p>
              )}

              {responses.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {r.submitter_name || "Anonymous"}
                      {r.submitter_email ? ` · ${r.submitter_email}` : ""}
                    </CardTitle>
                    <CardDescription>
                      {new Date(r.created_at).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(selectedForm?.fields ?? []).map((field) => {
                      const value = (r.answers as Record<string, unknown>)[field.id];
                      return (
                        <div key={field.id} className="text-sm">
                          <span className="text-muted-foreground">{field.label}: </span>
                          <span>
                            {value === undefined || value === null || value === ""
                              ? "—"
                              : typeof value === "boolean"
                                ? value
                                  ? "Yes"
                                  : "No"
                                : String(value)}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
