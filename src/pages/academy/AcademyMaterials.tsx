import { useMemo, useRef, useState } from "react";
import { FileText, Loader2, Sparkles, Upload } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AcademyCard, AcademyEyebrow, AcademyLayout } from "@/components/academy/AcademyLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAcademyData } from "@/hooks/useAcademy";
import {
  useAcademyMaterials,
  useGenerateAcademyDraft,
  usePublishAcademyDraft,
  useSaveAcademyDraft,
  useUploadAcademyMaterial,
} from "@/hooks/useAcademyMaterials";
import { toast } from "sonner";

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs: any = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push((content.items as Array<{ str?: string }>).map((item) => item.str || "").join(" "));
    }
    return pages.join("\n\n");
  }
  if (name.endsWith(".docx")) {
    const mammoth: any = await import("mammoth/mammoth.browser");
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value || "";
  }
  if (name.endsWith(".doc")) throw new Error("Save legacy Word files as .docx or PDF first.");
  return file.text();
}

export default function AcademyMaterials() {
  const academy = useAcademyData();
  const { data: materials } = useAcademyMaterials();
  const upload = useUploadAcademyMaterial();
  const generate = useGenerateAcademyDraft();
  const save = useSaveAcademyDraft();
  const publish = usePublishAcademyDraft();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [busyReading, setBusyReading] = useState(false);
  const [editing, setEditing] = useState<{ draftId: string; materialId: string; lessonId: string; sourceName: string; body: string } | null>(null);

  const lessons = useMemo(() => academy.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title, moduleOrder: module.sortOrder }))), [academy.modules]);
  const lessonById = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson])), [lessons]);

  const toggleLesson = (id: string) => setLessonIds((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const handleUpload = async () => {
    if (!file || lessonIds.length === 0) return;
    setBusyReading(true);
    try {
      const text = (await extractText(file)).trim();
      if (text.length < 100) throw new Error("This file does not contain enough readable text.");
      await upload.mutateAsync({ file, text, lessonIds });
      setFile(null);
      setLessonIds([]);
      if (inputRef.current) inputRef.current.value = "";
      toast.success("Material uploaded and assigned.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload that file.");
    } finally {
      setBusyReading(false);
    }
  };

  const handleGenerate = async (materialId: string, lessonId: string) => {
    try {
      await generate.mutateAsync({ materialId, lessonId });
      toast.success("Course draft is ready for review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the course draft.");
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    await save.mutateAsync({ draftId: editing.draftId, generatedDraft: editing.body });
    toast.success("Draft saved.");
  };

  const handlePublish = async () => {
    if (!editing) return;
    await publish.mutateAsync({
      draftId: editing.draftId,
      lessonId: editing.lessonId,
      materialId: editing.materialId,
      content: editing.body,
      sourceName: editing.sourceName,
    });
    toast.success("Lesson published from CTN source material.");
    setEditing(null);
  };

  return (
    <AcademyLayout>
      <header className="mb-8">
        <AcademyEyebrow>Staff workspace</AcademyEyebrow>
        <h1 className="mt-1.5 text-[32px]">Training Materials</h1>
        <p className="mt-2 max-w-[68ch] text-[14.5px]" style={{ color: "var(--academy-ink-soft)" }}>
          Upload official CTN documents, assign them to lessons, and review each course draft before advisors see it.
        </p>
      </header>

      <div className="space-y-6">
        <AcademyCard>
          <div className="flex items-center gap-3">
            <Upload size={20} style={{ color: "var(--academy-gold-deep)" }} />
            <div>
              <h2 className="text-[19px]">Upload source material</h2>
              <p className="text-[13px]" style={{ color: "var(--academy-ink-soft)" }}>PDF, DOCX, Markdown, or text · up to 20 MB</p>
            </div>
          </div>
          <Input ref={inputRef} type="file" accept=".pdf,.docx,.md,.txt" className="mt-5" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {academy.modules.map((module) => (
              <div key={module.id}>
                <p className="mb-2 text-[12px] font-semibold">Module {module.sortOrder} · {module.title}</p>
                <div className="space-y-2">
                  {module.lessons.map((lesson) => (
                    <Label key={lesson.id} className="flex cursor-pointer items-start gap-2 text-[12.5px] font-normal">
                      <Checkbox checked={lessonIds.includes(lesson.id)} onCheckedChange={() => toggleLesson(lesson.id)} />
                      <span>{lesson.title}</span>
                    </Label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button className="mt-6" disabled={!file || lessonIds.length === 0 || busyReading || upload.isPending} onClick={handleUpload}>
            {(busyReading || upload.isPending) ? <Loader2 className="animate-spin" /> : <Upload />}
            Upload and assign to {lessonIds.length || 0} lesson{lessonIds.length === 1 ? "" : "s"}
          </Button>
        </AcademyCard>

        {(materials || []).map((material) => (
          <AcademyCard key={material.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <FileText size={20} style={{ color: "var(--academy-pine)" }} />
                <div>
                  <h2 className="text-[17px]">{material.file_name}</h2>
                  <p className="text-[12px]" style={{ color: "var(--academy-ink-soft)" }}>
                    {(material.file_size / 1024 / 1024).toFixed(1)} MB · uploaded {new Date(material.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase" style={{ background: "var(--academy-parchment)", color: "var(--academy-gold-deep)", border: "1px solid var(--academy-line)" }}>{material.status}</span>
            </div>
            <div className="mt-5 divide-y" style={{ borderColor: "var(--academy-line)" }}>
              {material.academy_material_lesson_drafts.map((draft) => {
                const lesson = lessonById.get(draft.lesson_id);
                if (!lesson) return null;
                return (
                  <div key={draft.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">Module {lesson.moduleOrder} · {lesson.title}</p>
                      <p className="text-[11.5px] capitalize" style={{ color: "var(--academy-ink-soft)" }}>{draft.status.replace("_", " ")}</p>
                    </div>
                    {draft.generated_draft ? (
                      <Button variant="outline" size="sm" onClick={() => setEditing({ draftId: draft.id, materialId: material.id, lessonId: lesson.id, sourceName: material.file_name, body: draft.generated_draft || "" })}>Review draft</Button>
                    ) : (
                      <Button size="sm" disabled={generate.isPending} onClick={() => handleGenerate(material.id, lesson.id)}>
                        {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Build course draft
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </AcademyCard>
        ))}

        {editing && (
          <AcademyCard>
            <AcademyEyebrow>Review before publishing</AcademyEyebrow>
            <h2 className="mt-1.5 text-[20px]">{lessonById.get(editing.lessonId)?.title}</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <Label htmlFor="course-draft">Course body</Label>
                <Textarea id="course-draft" value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} className="mt-2 min-h-[560px] font-mono text-xs" />
              </div>
              <div>
                <Label>Advisor preview</Label>
                <div className="academy-prose mt-2 max-h-[560px] overflow-auto rounded-[10px] p-5" style={{ border: "1px solid var(--academy-line)", background: "var(--academy-parchment)" }}>
                  <ReactMarkdown>{editing.body}</ReactMarkdown>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" onClick={handleSave} disabled={save.isPending}>Save draft</Button>
              <Button onClick={handlePublish} disabled={!editing.body.trim() || publish.isPending}>Publish lesson</Button>
            </div>
          </AcademyCard>
        )}
      </div>
    </AcademyLayout>
  );
}