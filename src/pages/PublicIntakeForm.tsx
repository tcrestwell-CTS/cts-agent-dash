import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IntakeFieldInput } from "@/components/forms/IntakeFieldInput";
import { usePublicIntakeForm, useSubmitIntakeForm, uploadFormFile } from "@/hooks/useIntakeForms";

export default function PublicIntakeForm() {
  const { slug } = useParams<{ slug: string }>();
  const { data: form, isLoading } = usePublicIntakeForm(slug);
  const submit = useSubmitIntakeForm();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Form unavailable</CardTitle>
            <CardDescription>
              This questionnaire is closed or the link is incorrect. Please contact your travel
              advisor for a new link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const fields = Array.isArray(form.fields) ? form.fields : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = fields.find(
      (f) => f.required && (values[f.id] === undefined || values[f.id] === "" || values[f.id] === null || values[f.id] === false),
    );
    if (missing) return toast.error(`"${missing.label}" is required`);
    if (!name.trim()) return toast.error("Please enter your name");

    setBusy(true);
    try {
      const answers: Record<string, unknown> = {};
      for (const field of fields) {
        const value = values[field.id];
        if (field.type === "file" && value instanceof File) {
          answers[field.id] = await uploadFormFile(form.id, value);
        } else if (value !== undefined) {
          answers[field.id] = value;
        }
      }
      await submit.mutateAsync({
        form_id: form.id,
        submitter_name: name.trim(),
        submitter_email: email.trim() || null,
        answers,
      });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the form");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-3 py-10">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-xl font-semibold">Submitted</h1>
            <p className="text-sm text-muted-foreground">
              {form.thank_you_message || "Thanks! We've received your answers."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{form.title}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="submitter-name">
                  Your name<span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  id="submitter-name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitter-email">Email</Label>
                <Input
                  id="submitter-email"
                  type="email"
                  value={email}
                  maxLength={255}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {fields.map((field) => (
              <IntakeFieldInput
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={(v) => setValues((p) => ({ ...p, [field.id]: v }))}
              />
            ))}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}