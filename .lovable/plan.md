
# Travel Agent Training Portal — Build Plan

## Overview
Build a full-featured training academy inside the CRM with a Phase > Module > Lesson hierarchy, quiz engine, badge/certificate system, admin content management, and agent progress tracking. Replaces the current flat `training_modules` page with a rich, multi-page training portal.

---

## Phase 1: Database Schema (Migration)

Create these new tables (keeping existing `training_modules` and `agent_training_progress` for backward compatibility, then migrating data):

### New Tables

**`training_phases`** — top-level groupings
- id, title, description, sort_order, status (draft/published), estimated_minutes, badge_id (nullable), cover_image_url, created_by, created_at, updated_at

**`training_modules_v2`** — modules within phases
- id, phase_id (FK), title, description, cover_image_url, sort_order, status (draft/published), is_required, estimated_minutes, unlock_rule (text: 'sequential'/'manual'/'none'), badge_id (nullable), created_by, created_at, updated_at

**`training_lessons`** — lessons within modules
- id, module_id (FK), title, description, lesson_type (video/text/external_link/download/sop/checklist), content_body (text — rich text/HTML), video_url, external_url, file_attachments (jsonb), checklist_items (jsonb), sort_order, is_required, estimated_minutes, quiz_id (nullable FK), status (draft/published), created_by, created_at, updated_at

**`training_quizzes`** — standalone quiz entities
- id, title, description, passing_score (integer, default 70), retry_limit (integer, default 3), status (draft/published), created_by, created_at

**`training_quiz_questions`** — questions in a quiz
- id, quiz_id (FK), question_text, answer_options (jsonb array), correct_answer (text), explanation, sort_order

**`training_quiz_attempts`** — agent quiz submissions
- id, user_id (FK auth.users), quiz_id (FK), score (integer), passed (boolean), answers (jsonb), submitted_at (timestamptz default now())

**`training_badges`** — badge/certificate definitions
- id, title, description, icon (text — emoji or icon name), badge_type (badge/certificate), criteria_type (phase/module), criteria_id (uuid), created_at

**`training_user_badges`** — earned badges
- id, user_id (FK), badge_id (FK), earned_at (timestamptz default now()), issued_by (uuid nullable — for manual issuance)

**`training_user_progress`** — granular progress tracking
- id, user_id (FK), phase_id (nullable FK), module_id (nullable FK), lesson_id (nullable FK), status (not_started/in_progress/completed), percent_complete (integer default 0), completed_at, last_viewed_at, notes (text), created_at, updated_at
- Unique constraint on (user_id, lesson_id) where lesson_id is not null, (user_id, module_id) where module_id is not null, etc.

**`training_announcements`**
- id, title, body (text), status (draft/published), is_pinned (boolean default false), start_date (date), end_date (date nullable), audience (text: 'all'/'agents'/'admins'), created_by, created_at

### RLS Policies
- Agents can SELECT published phases/modules/lessons/quizzes/badges/announcements
- Agents can INSERT/UPDATE/SELECT their own progress, quiz attempts, and notes
- Admins (via `has_role`) can full CRUD on all training tables
- Announcements visible to all authenticated users when published and within date range

### Seed Data
Insert the 4 phases, 24 modules, and 8 sample lessons as specified in the request via the migration.

---

## Phase 2: Core Hooks & Data Layer

Create new hooks in `src/hooks/`:

- **`useTrainingPhases.ts`** — CRUD for phases, ordered list
- **`useTrainingModulesV2.ts`** — CRUD for modules within a phase
- **`useTrainingLessons.ts`** — CRUD for lessons within a module
- **`useTrainingQuizzes.ts`** — quiz CRUD, question management, attempt submission
- **`useTrainingBadges.ts`** — badge definitions, earned badges, awarding logic
- **`useTrainingProgress.ts`** — progress tracking per lesson/module/phase, rollup calculations
- **`useTrainingAnnouncements.ts`** — announcement CRUD, active announcements query
- **`useTrainingReporting.ts`** — admin reporting queries (progress by agent, by module, quiz scores)

---

## Phase 3: Agent-Facing Pages

### 3a. Training Dashboard (`/training`)
Replace current Training page with a rich dashboard:
- Welcome message with agent name
- Overall progress percentage (circular or bar)
- Current phase indicator
- Next recommended lesson
- Modules in progress (cards)
- Recently completed items
- Earned badges/certificates row
- Active announcements banner
- Search bar for training content
- Quick link to resume last lesson

### 3b. Training Library (`/training/library`)
- Phases displayed as expandable sections in order
- Filter by category, status (all/in-progress/completed/not-started), required/optional
- Search by keyword across phases/modules/lessons
- Locked/unlocked labels with lock icons
- Lesson type tags (Video, Quiz, SOP, External Link, Download)
- Progress bars per module
- Resume button for partially completed modules

### 3c. Phase Detail (`/training/phase/:phaseId`)
- Phase title, overview, estimated time
- Progress summary bar
- Ordered module list with status indicators
- Lock/unlock visual treatment
- Recommended completion path note

### 3d. Module Detail (`/training/module/:moduleId`)
- Module title, description, cover image
- Estimated time, status badge
- Ordered lesson list with completion checkmarks
- Completion requirements summary
- Notes textarea (saved per user per module)
- Resources/downloads section
- Mark Complete button (when all required lessons done)
- Badge earned indicator

### 3e. Lesson Detail (`/training/lesson/:lessonId`)
- Video embed (YouTube/Vimeo iframe or uploaded)
- External URL with "Open in new tab" button
- Rich text content area
- Downloadable files list
- Checklist with toggleable items
- Lesson notes (auto-saved)
- Completion toggle
- Quiz section (if attached) — inline multiple choice
- Previous/Next lesson navigation buttons
- Auto-save progress on unmount

---

## Phase 4: Quiz Engine

### Quiz Component (`TrainingQuiz.tsx`)
- Renders questions one at a time or all at once
- Multiple choice with radio buttons
- Submit button, score calculation
- Pass/fail display with passing score threshold
- Explanation shown after submission
- Retry button if attempts remain
- Score saved to `training_quiz_attempts`

### Quiz Admin
- Create/edit quiz with title, passing score, retry limit
- Add/edit/reorder questions
- Set correct answer and explanation per question

---

## Phase 5: Admin Pages

### 5a. Admin Training Dashboard (`/training/admin`)
- Active agent count
- Overall completion rates (donut chart)
- Module performance table
- Overdue/stalled learners list
- Most-used resources
- Quiz performance summaries
- Recent activity feed
- Quick-create buttons (Phase, Module, Lesson, Announcement)

### 5b. Content Manager (`/training/admin/content`)
- Tree view: Phases > Modules > Lessons
- Drag-and-drop reorder (using `sort_order` updates)
- Inline status toggle (draft/published)
- Required/optional toggle
- Create/Edit/Delete for each level
- Clone module functionality
- Archive toggle
- Attach quiz, badge, files, links, video URL

### 5c. Phase/Module/Lesson Editor Dialogs
- **Phase Editor**: title, description, sort order, status, badge assignment
- **Module Editor**: title, description, phase assignment, cover image, required flag, unlock rule, badge, estimated time
- **Lesson Editor**: title, type selector, content body (textarea/rich text), video URL, external URL, file attachments (URLs), checklist items (JSON editor), quiz attachment, required flag, estimated time

### 5d. User Progress Reporting (`/training/admin/reports`)
- Table: agents with progress percentage, phase, last active
- Filter by completed/in-progress/not-started
- Drill down by agent to see per-module/lesson status
- Quiz score column
- Export to CSV
- Manual mark complete / reset buttons per agent per item

### 5e. Announcements Manager (`/training/admin/announcements`)
- Create/edit/delete announcements
- Pin/unpin toggle
- Status (draft/published)
- Start/end date pickers
- Audience selector
- Preview

---

## Phase 6: Badge & Certificate System

- Badge display cards with icon, title, earned date
- Profile/dashboard section showing earned credentials
- Auto-award badge when module/phase completed (check `criteria_type` + `criteria_id`)
- Admin manual issue/revoke via reporting page

---

## Phase 7: Navigation & Routing

### New Routes in `App.tsx`
```
/training                    — Agent Dashboard
/training/library            — Training Library
/training/phase/:phaseId     — Phase Detail
/training/module/:moduleId   — Module Detail
/training/lesson/:lessonId   — Lesson Detail
/training/admin              — Admin Dashboard
/training/admin/content      — Content Manager
/training/admin/reports      — Progress Reporting
/training/admin/announcements — Announcements
```

### Sidebar Updates
- Expand the existing "Training" sidebar item into a collapsible group:
  - Dashboard, Library, My Badges
  - Admin sub-section (visible to admin/office_admin): Content, Reports, Announcements

---

## Phase 8: Progress Logic

- Lesson completion: manual toggle or quiz pass
- Module completion: all required lessons completed
- Phase completion: all required modules completed
- Auto-award badges on completion
- Admin can manually unlock, mark complete, or reset
- Optional content doesn't block required completion
- Progress bars at every level (lesson, module, phase, overall)
- Auto-save `last_viewed_at` when entering a lesson
- Onboarding: first-login welcome screen with Phase 1 prompt (check if any progress exists)

---

## Technical Notes

- All new pages use `DashboardLayout` wrapper
- Lazy-loaded route components
- Existing `usePermissions` hook for role checks
- Navy/gold/white design tokens already in theme
- Reuse existing UI components (Card, Badge, Progress, Dialog, Tabs, etc.)
- Mobile responsive with stacked layouts on small screens
- The old `training_modules` and `agent_training_progress` tables remain untouched; the new system is additive

---

## Estimated Scope
- 1 large migration (schema + seed data)
- ~8 new hooks
- ~15 new component files
- ~9 new page files
- Router and sidebar updates
- This will be built incrementally across multiple implementation steps
