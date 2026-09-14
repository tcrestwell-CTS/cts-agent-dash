# CTN Academy source-material workflow

Add a staff-only workflow that turns uploaded CTN documents into polished Academy lessons while preserving the original source for review.

## What staff will get

- A new **Training Materials** tab at `/academy/materials`, visible only to admins and office admins.
- Upload PDF, Word, Markdown, or text files to a private Academy document library.
- Assign each upload to one or more Academy lessons.
- Preview the generated course body beside the current lesson, edit it, then explicitly publish it.
- Clear status labels: Uploaded, Processing, Ready for review, Published, or Failed.
- Source attribution on each updated lesson showing the document name and update date.

## Course conversion

- Extract source text in the browser, then send only the extracted material and selected lesson context to a protected conversion function.
- Rewrite into substantial CTN course material with headings, examples, procedures, key takeaways, and knowledge checks where supported by the source.
- Do not invent policies, prices, legal requirements, supplier rules, or procedures absent from the uploaded material.
- Preserve exact CTN terminology and mark ambiguous or legally sensitive passages for staff review instead of presenting them as settled guidance.
- Never overwrite a lesson until staff selects **Publish lesson**.

## Data and security

- Create a private `academy-materials` file area and a catalogue that records file name, storage path, assigned lesson, extracted text, generated draft, status, uploader, and timestamps.
- Advisors cannot read source files or drafts. Admins and office admins can manage them through role-checked access rules.
- The conversion function verifies the signed-in staff role before reading documents or generating content.
- Published text continues to live in the existing Academy lesson record, so current progress and lesson pages keep working unchanged.

## Current uploads

No files are attached to this message. Once this workflow is live, upload the CTN documents there; I will also process any files attached directly in chat and map them to the matching lessons.

## Technical details

- Reuse `AdminRoute allowOfficeAdmin`, the existing Academy shell, lesson data, private storage patterns, and Lovable AI.
- Add PDF and DOCX text extraction in the staff page; plain text and Markdown use native text reading.
- Add one database migration, private storage policies, one protected conversion function, one Academy admin page, and focused hooks/components.
- Validate upload, preview, publish, permissions, and the unchanged advisor lesson view.
