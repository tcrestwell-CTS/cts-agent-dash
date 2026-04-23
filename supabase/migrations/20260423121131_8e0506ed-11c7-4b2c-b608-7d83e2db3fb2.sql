
-- ============================================================
-- TRAINING PORTAL SCHEMA
-- ============================================================

-- 1. training_badges (referenced by phases/modules)
CREATE TABLE public.training_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🏆',
  badge_type TEXT NOT NULL DEFAULT 'badge' CHECK (badge_type IN ('badge', 'certificate')),
  criteria_type TEXT CHECK (criteria_type IN ('phase', 'module')),
  criteria_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_badges ENABLE ROW LEVEL SECURITY;

-- 2. training_phases
CREATE TABLE public.training_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  estimated_minutes INTEGER DEFAULT 0,
  badge_id UUID REFERENCES public.training_badges(id) ON DELETE SET NULL,
  cover_image_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_phases ENABLE ROW LEVEL SECURITY;

-- 3. training_modules_v2
CREATE TABLE public.training_modules_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id UUID NOT NULL REFERENCES public.training_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  is_required BOOLEAN NOT NULL DEFAULT true,
  estimated_minutes INTEGER DEFAULT 0,
  unlock_rule TEXT NOT NULL DEFAULT 'none' CHECK (unlock_rule IN ('sequential', 'manual', 'none')),
  badge_id UUID REFERENCES public.training_badges(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_modules_v2 ENABLE ROW LEVEL SECURITY;

-- 4. training_quizzes
CREATE TABLE public.training_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER NOT NULL DEFAULT 70,
  retry_limit INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_quizzes ENABLE ROW LEVEL SECURITY;

-- 5. training_lessons
CREATE TABLE public.training_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.training_modules_v2(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  lesson_type TEXT NOT NULL DEFAULT 'text' CHECK (lesson_type IN ('video', 'text', 'external_link', 'download', 'sop', 'checklist')),
  content_body TEXT,
  video_url TEXT,
  external_url TEXT,
  file_attachments JSONB DEFAULT '[]'::jsonb,
  checklist_items JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  estimated_minutes INTEGER DEFAULT 5,
  quiz_id UUID REFERENCES public.training_quizzes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_lessons ENABLE ROW LEVEL SECURITY;

-- 6. training_quiz_questions
CREATE TABLE public.training_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.training_quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.training_quiz_questions ENABLE ROW LEVEL SECURITY;

-- 7. training_quiz_attempts
CREATE TABLE public.training_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quiz_id UUID NOT NULL REFERENCES public.training_quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- 8. training_user_badges
CREATE TABLE public.training_user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.training_badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID,
  UNIQUE(user_id, badge_id)
);
ALTER TABLE public.training_user_badges ENABLE ROW LEVEL SECURITY;

-- 9. training_user_progress
CREATE TABLE public.training_user_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phase_id UUID REFERENCES public.training_phases(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.training_modules_v2(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.training_lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  percent_complete INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_user_progress ENABLE ROW LEVEL SECURITY;

-- Unique partial indexes for progress
CREATE UNIQUE INDEX idx_training_progress_user_lesson ON public.training_user_progress (user_id, lesson_id) WHERE lesson_id IS NOT NULL;
CREATE UNIQUE INDEX idx_training_progress_user_module ON public.training_user_progress (user_id, module_id) WHERE module_id IS NOT NULL AND lesson_id IS NULL;
CREATE UNIQUE INDEX idx_training_progress_user_phase ON public.training_user_progress (user_id, phase_id) WHERE phase_id IS NOT NULL AND module_id IS NULL AND lesson_id IS NULL;

-- 10. training_announcements
CREATE TABLE public.training_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'agents', 'admins')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_announcements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER update_training_phases_updated_at BEFORE UPDATE ON public.training_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_modules_v2_updated_at BEFORE UPDATE ON public.training_modules_v2 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_lessons_updated_at BEFORE UPDATE ON public.training_lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_user_progress_updated_at BEFORE UPDATE ON public.training_user_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- training_badges
CREATE POLICY "Anyone authenticated can view badges" ON public.training_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage badges" ON public.training_badges FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- training_phases
CREATE POLICY "Authenticated users can view published phases" ON public.training_phases FOR SELECT TO authenticated USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage phases" ON public.training_phases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- training_modules_v2
CREATE POLICY "Authenticated users can view published modules" ON public.training_modules_v2 FOR SELECT TO authenticated USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage modules" ON public.training_modules_v2 FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- training_lessons
CREATE POLICY "Authenticated users can view published lessons" ON public.training_lessons FOR SELECT TO authenticated USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage lessons" ON public.training_lessons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- training_quizzes
CREATE POLICY "Authenticated users can view published quizzes" ON public.training_quizzes FOR SELECT TO authenticated USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage quizzes" ON public.training_quizzes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- training_quiz_questions
CREATE POLICY "Authenticated users can view quiz questions" ON public.training_quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage quiz questions" ON public.training_quiz_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- training_quiz_attempts
CREATE POLICY "Users can view own attempts" ON public.training_quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON public.training_quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON public.training_quiz_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- training_user_badges
CREATE POLICY "Users can view own badges" ON public.training_user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all badges" ON public.training_user_badges FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- training_user_progress
CREATE POLICY "Users can view own progress" ON public.training_user_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.training_user_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.training_user_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all progress" ON public.training_user_progress FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all progress" ON public.training_user_progress FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- training_announcements
CREATE POLICY "Authenticated users can view published announcements" ON public.training_announcements FOR SELECT TO authenticated USING (status = 'published' AND start_date <= CURRENT_DATE AND (end_date IS NULL OR end_date >= CURRENT_DATE));
CREATE POLICY "Admins can manage announcements" ON public.training_announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_training_modules_v2_phase_id ON public.training_modules_v2(phase_id);
CREATE INDEX idx_training_lessons_module_id ON public.training_lessons(module_id);
CREATE INDEX idx_training_quiz_questions_quiz_id ON public.training_quiz_questions(quiz_id);
CREATE INDEX idx_training_quiz_attempts_user_quiz ON public.training_quiz_attempts(user_id, quiz_id);
CREATE INDEX idx_training_user_progress_user ON public.training_user_progress(user_id);
CREATE INDEX idx_training_user_badges_user ON public.training_user_badges(user_id);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Phases
INSERT INTO public.training_phases (id, title, description, sort_order, status, estimated_minutes, created_by) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Phase 1: Foundations', 'Learn the fundamentals of travel advising, how commissions work, and how to navigate the Crestwell CRM. This phase is required for all new agents before moving forward.', 1, 'published', 180, '00000000-0000-0000-0000-000000000000'),
  ('a1000000-0000-0000-0000-000000000002', 'Phase 2: Sales Skills', 'Master the art of qualifying leads, creating compelling quotes, closing sales, and building lasting client relationships.', 2, 'published', 240, '00000000-0000-0000-0000-000000000000'),
  ('a1000000-0000-0000-0000-000000000003', 'Phase 3: Product Training', 'Deep-dive into specific travel products — cruises, all-inclusive resorts, group travel, family vacations, destination weddings, and travel protection.', 3, 'published', 300, '00000000-0000-0000-0000-000000000000'),
  ('a1000000-0000-0000-0000-000000000004', 'Phase 4: Growth & Marketing', 'Build your personal brand, leverage social media, generate referrals, and create systems for sustainable business growth.', 4, 'published', 240, '00000000-0000-0000-0000-000000000000');

-- Phase 1 Modules
INSERT INTO public.training_modules_v2 (id, phase_id, title, description, sort_order, status, is_required, estimated_minutes, created_by) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Welcome to Crestwell Travel Network', 'An introduction to the Crestwell family, our mission, values, and what you can expect as an advisor.', 1, 'published', true, 15, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'What a Travel Advisor Does', 'Understand the day-to-day responsibilities, client expectations, and the advisory role.', 2, 'published', true, 20, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Understanding Commissions', 'Learn how commission structures work, payout timelines, and how to maximize your earnings.', 3, 'published', true, 25, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'How Host Agencies Work', 'Understand the relationship between independent advisors and their host agency.', 4, 'published', true, 20, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'Travel Industry Basics', 'An overview of the travel industry ecosystem — suppliers, GDS, consortia, and more.', 5, 'published', true, 30, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'CRM Orientation', 'A guided walkthrough of the Crestwell CRM — managing clients, trips, bookings, and commissions.', 6, 'published', true, 30, '00000000-0000-0000-0000-000000000000');

-- Phase 2 Modules
INSERT INTO public.training_modules_v2 (id, phase_id, title, description, sort_order, status, is_required, estimated_minutes, created_by) VALUES
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 'Qualifying a Lead', 'Learn how to identify serious prospects and qualify leads effectively.', 1, 'published', true, 30, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 'Creating a Quote', 'Step-by-step guide to building professional, compelling travel quotes.', 2, 'published', true, 30, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', 'Closing the Sale', 'Proven techniques for converting quotes into confirmed bookings.', 3, 'published', true, 25, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', 'Handling Objections', 'Common objections travel clients have and how to address them confidently.', 4, 'published', true, 25, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000002', 'Follow-Up Systems', 'Build reliable follow-up workflows that keep leads engaged and clients happy.', 5, 'published', true, 20, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000002', 'Client Communication Best Practices', 'Email templates, phone scripts, and communication guidelines for every stage.', 6, 'published', true, 20, '00000000-0000-0000-0000-000000000000');

-- Phase 3 Modules
INSERT INTO public.training_modules_v2 (id, phase_id, title, description, sort_order, status, is_required, estimated_minutes, created_by) VALUES
  ('b1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000003', 'Cruise Sales Basics', 'Everything you need to know to confidently sell and book cruise vacations.', 1, 'published', true, 45, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000003', 'All-Inclusive Vacation Sales', 'Master all-inclusive resort sales — from supplier selection to client matching.', 2, 'published', true, 40, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000003', 'Group Travel Basics', 'Learn how to organize, price, and manage group travel bookings effectively.', 3, 'published', true, 40, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000003', 'Family Travel Planning', 'Special considerations for family travel — kid-friendly destinations, multi-gen trips, and more.', 4, 'published', false, 30, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000003', 'Romance & Destination Weddings', 'Guide to selling honeymoons, anniversaries, and destination wedding packages.', 5, 'published', false, 30, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000003', 'Travel Protection & Insurance Basics', 'Understand travel insurance products, when to recommend them, and compliance requirements.', 6, 'published', true, 25, '00000000-0000-0000-0000-000000000000');

-- Phase 4 Modules
INSERT INTO public.training_modules_v2 (id, phase_id, title, description, sort_order, status, is_required, estimated_minutes, created_by) VALUES
  ('b1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000004', 'Personal Brand Setup', 'Establish your unique brand identity as a travel advisor.', 1, 'published', true, 30, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000004', 'Social Media Basics for Travel Advisors', 'Learn which platforms to use, what content to post, and how to grow your following.', 2, 'published', true, 35, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000004', 'Referral Generation', 'Create a referral engine that brings you consistent, high-quality leads.', 3, 'published', true, 25, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000004', 'Repeat Client Strategy', 'Strategies for turning one-time clients into lifelong customers.', 4, 'published', true, 20, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000004', 'Lead Nurture Process', 'Automated and manual nurture workflows to stay top-of-mind with prospects.', 5, 'published', true, 25, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000024', 'a1000000-0000-0000-0000-000000000004', 'Productivity & Time Management', 'Tools and techniques to manage your time and scale your business efficiently.', 6, 'published', false, 20, '00000000-0000-0000-0000-000000000000');

-- Sample Lessons
INSERT INTO public.training_lessons (module_id, title, description, lesson_type, content_body, sort_order, is_required, estimated_minutes, created_by) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Welcome to Crestwell Travel Network', 'Meet the team and learn about our mission to empower travel advisors.', 'text', '<h2>Welcome to the Crestwell Family!</h2><p>We''re thrilled to have you join Crestwell Travel Network. Our mission is to empower independent travel advisors with world-class tools, training, and support.</p><p>In this lesson, you''ll learn about our values, team structure, and what makes Crestwell different.</p><h3>Our Core Values</h3><ul><li><strong>Client First</strong> — Every recommendation starts with the traveler''s needs</li><li><strong>Integrity</strong> — Transparent pricing, honest advice</li><li><strong>Growth</strong> — Continuous learning and professional development</li><li><strong>Community</strong> — We succeed together</li></ul>', 1, true, 10, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000003', 'How Commissions Work', 'A clear breakdown of commission structures, timelines, and tier levels.', 'text', '<h2>Understanding Your Commission Structure</h2><p>As a Crestwell advisor, your income comes from commissions earned on travel bookings. Here''s how it works:</p><h3>Commission Tiers</h3><ul><li><strong>Tier 1 (New Advisors)</strong> — 70/30 split</li><li><strong>Tier 2 (Experienced)</strong> — 80/20 split</li><li><strong>Tier 3 (Top Performers)</strong> — 95/5 split</li></ul><h3>Payout Timeline</h3><p>Commissions are typically paid after the client''s travel is complete and the supplier has remitted payment. This can take 30-90 days depending on the supplier.</p>', 1, true, 15, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000006', 'CRM Walkthrough', 'Navigate the Crestwell CRM — from client management to trip tracking.', 'text', '<h2>Your CRM — Command Center</h2><p>The Crestwell CRM is your all-in-one platform for managing clients, trips, bookings, invoices, and commissions.</p><h3>Key Areas</h3><ul><li><strong>Dashboard</strong> — Your daily overview</li><li><strong>CRM</strong> — Client contacts and history</li><li><strong>Trips</strong> — Itinerary and booking management</li><li><strong>Bookings</strong> — Supplier confirmations and financials</li><li><strong>Commissions</strong> — Track your earnings</li></ul>', 1, true, 20, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000013', 'How to Book a Cruise Client', 'Step-by-step guide to your first cruise booking from inquiry to confirmation.', 'text', '<h2>Booking a Cruise — Step by Step</h2><ol><li><strong>Qualify the Client</strong> — Understand preferences: destination, budget, travel dates, cabin type</li><li><strong>Search Inventory</strong> — Use the Cruise Search tool or supplier portals</li><li><strong>Present Options</strong> — Show 2-3 curated options with pricing</li><li><strong>Handle Questions</strong> — Address cabin selection, dining, shore excursions</li><li><strong>Book & Confirm</strong> — Place the hold, collect deposit, send confirmation</li><li><strong>Follow Up</strong> — Send travel documents, pre-departure reminders</li></ol>', 1, true, 30, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000014', 'How to Quote an All-Inclusive Vacation', 'Learn to create compelling all-inclusive resort quotes that convert.', 'text', '<h2>Quoting All-Inclusive Vacations</h2><p>All-inclusive resorts are one of the most popular travel products. Here''s how to create quotes that win:</p><h3>Key Steps</h3><ol><li>Identify client preferences (beach vs. adventure, adults-only vs. family)</li><li>Match to the right resort brand and room category</li><li>Calculate total cost including transfers and upgrades</li><li>Present with photos, room descriptions, and what''s included</li><li>Highlight value — compare to à la carte pricing</li></ol>', 1, true, 25, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000015', 'Group Travel Basics', 'Fundamentals of organizing and managing group travel bookings.', 'text', '<h2>Group Travel 101</h2><p>Group bookings can be your highest-revenue opportunities. Here''s what you need to know:</p><h3>Group Types</h3><ul><li>Destination Weddings</li><li>Family Reunions</li><li>Corporate Retreats</li><li>Affinity Groups (church, alumni, clubs)</li></ul><h3>Key Considerations</h3><ul><li>Minimum group size requirements (usually 8-16 passengers)</li><li>Group pricing and amenities negotiations</li><li>Deposit and payment collection timelines</li><li>Communication management across all travelers</li></ul>', 1, true, 25, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000011', 'Follow-Up Process', 'Build a systematic follow-up process that converts leads and retains clients.', 'text', '<h2>The Crestwell Follow-Up System</h2><p>Consistent follow-up is the #1 factor in converting leads to bookings.</p><h3>Follow-Up Timeline</h3><ul><li><strong>Day 0</strong> — Initial response within 2 hours</li><li><strong>Day 2</strong> — Check-in with additional info</li><li><strong>Day 5</strong> — Share a curated option or promotion</li><li><strong>Day 10</strong> — Gentle reminder with urgency</li><li><strong>Day 21</strong> — Final touchpoint before archiving</li></ul>', 1, true, 15, '00000000-0000-0000-0000-000000000000'),
  ('b1000000-0000-0000-0000-000000000020', 'Social Media Basics for Travel Advisors', 'Get started with social media marketing for your travel business.', 'text', '<h2>Social Media for Travel Advisors</h2><p>Your social media presence is your storefront. Here''s how to make it work:</p><h3>Platform Priorities</h3><ul><li><strong>Instagram</strong> — Visual storytelling, reels, stories</li><li><strong>Facebook</strong> — Groups, events, longer-form content</li><li><strong>TikTok</strong> — Short-form travel tips and destination highlights</li></ul><h3>Content Ideas</h3><ul><li>Destination spotlights</li><li>Client testimonials (with permission)</li><li>Behind-the-scenes of planning</li><li>Travel tips and packing guides</li><li>Promotions and limited-time offers</li></ul>', 1, true, 20, '00000000-0000-0000-0000-000000000000');

-- Sample Announcement
INSERT INTO public.training_announcements (title, body, status, is_pinned, start_date, audience, created_by) VALUES
  ('Welcome to Crestwell Academy! 🎓', 'We''re excited to launch the Crestwell Training Academy! Start with Phase 1: Foundations to build your knowledge base. New modules and resources will be added regularly. Happy learning!', 'published', true, CURRENT_DATE, 'all', '00000000-0000-0000-0000-000000000000');
