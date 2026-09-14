# CTN Travel Academy

A private, self-contained learning section inside the existing agent dashboard, at `/academy`. It reuses your existing training tables (which already track progress, badges and announcements for 34 CRM modules and 69 lessons) and keeps Academy content strictly separate from that CRM training with a new **track** field.

## What advisors will see

**Academy shell** — its own header on deep blue with the Crestwell logo chip, the "CTN Travel Academy / Crestwell Travel Network" lockup, four tabs (Dashboard, Curriculum, Resource Library, Certificates) with a gold underline on the active tab, and a gold initials avatar. Content sits left-aligned in a 1120px column, main content and sidebar in an asymmetric 1.55 / 1 split.

**Dashboard** (`/academy`)
- "Welcome back, {first name}" with the name in gold, status and enrolment line, and a "Module n in progress" pill.
- **Waypoint route tracker** — six stops in an equal-width grid, dashed track behind, solid blue track filling to the current stop's exact centre, completed stops filled blue with a check, current stop gold with a pulse ring and a small gold "YOU ARE HERE" label, upcoming stops hollow. Built as a CSS grid, not an SVG.
- Continue block: blue panel naming the module, lesson x of y and minutes, with a gold "Resume lesson" button that jumps to the first incomplete lesson.
- All-modules list with numbered circles and status pills (Complete / x of y lessons / Not started / CLIA pathway).
- Sidebar: mentor card with a Message mentor button, badges earned as circular stamps with tooltips, announcements with gold left rules, and three resource-library shortcuts.

**Curriculum** (`/academy/curriculum`) — one card per module expanded to lesson level, each lesson row a status dot, title and duration. Locked modules aren't clickable. Sidebar shows a live track summary (n of 6 complete, gold bar, hours total and remaining, all computed) and an elective CLIA pathway card.

**Resource Library** (`/academy/library`) — search box plus All / Handbooks / Templates / Suppliers / Recordings chips, live-filtering a responsive card grid. Cards show kind, size, title, description, updated date; border turns gold on hover; recordings open in a player modal. Plain empty state offering to clear filters.

**Certificates** (`/academy/certificates`) — earned credentials with a gold seal, issue date, credential ID, Download PDF and Share (copies a verification link); in-progress credentials muted with a requirement checklist. Certificates issue automatically once requirements are met.

**Lesson view** (`/academy/lesson/:id`) — title, markdown body at a comfortable measure, video when present, right rail with the module's lesson list, sticky footer with previous / next and a gold "Mark complete and continue".

Sign-in uses the dashboard's existing login, so advisors don't get a second account.

## Curriculum seeded

One Academy track holding the seven modules verbatim, with draft lesson bodies (not blank shells) and 6–20 minute durations:

1. Orientation & The Crestwell Ecosystem — 6 lessons
2. Travel-Industry Foundations — 9 lessons
3. Client Discovery & Sales — 6 lessons
4. Research, Quoting & Itineraries — 11 lessons
5. CRM & Booking — 7 lessons
6. Payments & Reconciliation — 5 lessons
7. Cruise Sales Mastery — 5 lessons, elective, unlocks after Module 4

Foundations (1–6) total roughly nine hours. Any lesson whose content touches legal, regulatory or compliance matters (concentrated in Module 2) opens with a clearly visible **"Draft — pending review by management and legal counsel"** notice inside the lesson body itself, so nothing reads as settled guidance before it is reviewed. Note: your brief for this build titles Module 2 "Travel-Industry Foundations" rather than "Legal, Ethical and Compliance" — I'll apply the notice by subject matter, so it lands on the legal and compliance lessons wherever they sit.

## Visual identity

Pine `#2C5282`, pine-deep `#1A365D`, gold `#D69E2E`, gold-deep `#9C6B0C`, parchment `#F0F4F3`, white surfaces, ink `#1A202C` / ink-soft `#4A5568`, hairlines at 14% pine. Lora for headings, Inter for body, both from Google Fonts. Cards 14px radius, 1px hairline, no shadows. Gold only as a line, dot, underline or small fill. Gold focus rings on every interactive element. These tokens are scoped to Academy screens only — the rest of the dashboard keeps its current look.

## Technical notes

- **Migration**: add `track text not null default 'crm'` to `training_phases` (Academy rows use `'academy'`), and `unlock_after_module_id uuid` to `training_modules_v2`. All existing training queries stay valid; Academy screens filter on the track, and existing CRM training screens filter to `'crm'` so the two never blend.
- **Reused tables**: `training_phases`, `training_modules_v2`, `training_lessons`, `training_user_progress` (existing `useUpsertProgress` / `useAutoRollupProgress` rollup and badge-award logic reused as-is), `training_badges`, `training_user_badges`, `training_announcements`, `agent_messages` (mentor thread), `mentor_assignments` + `profiles` (mentor card).
- **New tables**: `training_resources` (title, description, kind, category, file_url, size_label, updated_on) and `training_certificates` / `training_user_certificates` (credential prefix, credential ID, issued_on, requirement definition). Each gets GRANTs and RLS: authenticated users read shared catalogue rows; a user reads only their own certificates and progress; admins and office admins manage catalogue rows via `has_role`.
- Certificate issuance runs client-side on lesson completion, mirroring the existing badge-award path, then invalidates the Academy queries so the dashboard updates immediately.
- New files: `src/pages/academy/*` (5 pages), `src/components/academy/*` (shell, waypoint tracker, module card, badge stamp, mentor drawer, resource card, certificate card), `src/hooks/useAcademy*.ts`, `src/styles/academy.css` scoped under an `.academy` root class.
- Routes added to `src/App.tsx` under `ProtectedRoute`, plus an Academy entry in the dashboard nav.

## Not in this pass

The four follow-ups you listed — admin CRUD and roster at `/admin`, real PDF certificate generation, email nudges and congratulations, and the vertical mobile waypoint route — come after this lands. The certificate Download button will produce a simple PDF in the meantime.
