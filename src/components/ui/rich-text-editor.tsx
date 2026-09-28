/**
 * RichTextEditor — TipTap-powered rich text input component.
 *
 * Features:
 *   - Bold, Italic, Underline
 *   - Bullet list, Ordered list
 *   - Hyperlinks (add / edit / remove)
 *   - Placeholder text
 *   - Outputs and accepts HTML strings (stored directly in Supabase)
 *   - Plain-text migration: if content has no HTML tags, wraps in <p> automatically
 *   - Compact toolbar that matches the existing shadcn/ui aesthetic
 */

import DOMPurify from "dompurify";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Link as LinkIcon, Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Wrap plain text in <p> so TipTap doesn't strip it */
function normalisePlainText(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  // Already contains HTML tags → pass through as-is
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  // Plain text → wrap each newline-separated paragraph
  return trimmed
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 w-7 rounded flex items-center justify-center transition-colors text-muted-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        active && "bg-accent text-accent-foreground font-bold"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-border mx-0.5 self-center" />;
}

function LinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const currentLink = editor.getAttributes("link").href as string | undefined;
  const isActive = editor.isActive("link");

  const openPopover = () => {
    setUrl(currentLink || "");
    setOpen(true);
  };

  const applyLink = () => {
    if (!url.trim()) return;
    const href = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href, target: "_blank" })
      .run();
    setOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Insert link"
            onClick={openPopover}
            className={cn(
              "h-7 w-7 rounded flex items-center justify-center transition-colors text-muted-foreground",
              "hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground"
            )}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" side="top" align="start">
          <div className="space-y-2">
            <Label className="text-xs">URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyLink()}
              placeholder="https://..."
              className="h-8 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={applyLink}>
                Apply
              </Button>
              {isActive && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={removeLink}>
                  <Unlink className="h-3 w-3 mr-1" /> Remove
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 flex-wrap">
      <ToolbarButton
        title="Bold (Ctrl+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        disabled={!editor.can().toggleBold()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarButton
        title="Italic (Ctrl+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        disabled={!editor.can().toggleItalic()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarButton
        title="Underline (Ctrl+U)"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarButton
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <LinkPopover editor={editor} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  disabled?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = "Add a description…",
  className,
  minHeight = 80,
  disabled = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable heading — paragraphs + lists only for activity descriptions
        heading: false,
        codeBlock: false,
        code: false,
        // StarterKit doesn't include Link/Underline but exclude them here
        // to prevent any future version collision warnings
      }),
      Underline.configure({}),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2 hover:opacity-80",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: normalisePlainText(value),
    editable: !disabled,
    onUpdate({ editor }) {
      // Output empty string when only empty paragraphs remain
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html);
    },
  });

  // Sync external value changes (e.g. AI-generated content) into the editor.
  // Skip when the change came from the editor itself (HTML round-trips identically).
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    const next = normalisePlainText(value);
    if (next !== current) {
      editor.commands.setContent(next, false);
    }
  }, [editor, value]);

  return (
    <div
      onFocusCapture={onFocus}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.();
      }}
      className={cn(
        "rounded-md border border-input bg-background text-sm shadow-sm",
        "focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className={cn(
          "px-3 py-2 outline-none",
          // Prose styles for the editable area
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror]:min-h-[var(--rte-min-h)]",
          "[&_.ProseMirror_p]:my-1",
          "[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:my-1",
          "[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:my-1",
          "[&_.ProseMirror_li]:my-0.5",
          "[&_.ProseMirror_strong]:font-semibold",
          "[&_.ProseMirror_em]:italic",
          "[&_.ProseMirror_u]:underline",
          "[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline",
          // Placeholder
          "[&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_.ProseMirror_.is-editor-empty:first-child::before]:float-left",
          "[&_.ProseMirror_.is-editor-empty:first-child::before]:h-0",
          "[&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none"
        )}
        style={{ "--rte-min-h": `${minHeight}px` } as React.CSSProperties}
      />
    </div>
  );
}

// ── Read-only renderer ─────────────────────────────────────────────────────────

/**
 * SafeHtml — renders stored HTML content safely using DOMPurify.
 * Use this everywhere the stored description needs to be displayed (not edited).
 */
export function SafeHtml({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  if (!html) return null;

  // Sanitise on the client
  const clean = typeof window !== "undefined"
    ? DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "a", "ul", "ol", "li", "span"],
        ALLOWED_ATTR: ["href", "target", "rel", "class"],
      })
    : html;

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-inherit",
        "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1",
        "[&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1",
        "[&_li]:my-0.5",
        "[&_strong]:font-semibold",
        "[&_em]:italic",
        "[&_u]:underline",
        "[&_a]:text-primary [&_a]:underline [&_a:hover]:opacity-80",
        className
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
