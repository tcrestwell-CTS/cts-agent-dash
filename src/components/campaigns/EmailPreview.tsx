interface Props {
  subject: string;
  fromName: string;
  fromEmail: string;
  preheader?: string | null;
  bodyHtml: string;
}

export function EmailPreview({ subject, fromName, fromEmail, preheader, bodyHtml }: Props) {
  const wrapped = `<!doctype html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
    ${bodyHtml || '<p style="color:#999;">Email body preview will appear here…</p>'}
  </div>
</body></html>`;

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div className="px-4 py-3 border-b bg-muted/50 text-xs space-y-1">
        <div>
          <span className="text-muted-foreground">From:</span>{" "}
          <span className="font-medium">{fromName} &lt;{fromEmail}&gt;</span>
        </div>
        <div>
          <span className="text-muted-foreground">Subject:</span>{" "}
          <span className="font-medium">{subject || "(no subject)"}</span>
        </div>
        {preheader && (
          <div>
            <span className="text-muted-foreground">Preheader:</span>{" "}
            <span className="italic text-muted-foreground">{preheader}</span>
          </div>
        )}
      </div>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={wrapped}
        className="w-full h-[500px] border-0 bg-white"
      />
    </div>
  );
}