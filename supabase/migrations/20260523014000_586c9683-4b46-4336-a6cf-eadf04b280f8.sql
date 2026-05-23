CREATE SEQUENCE IF NOT EXISTS public.blog_posts_id_seq OWNED BY public.blog_posts.id;
SELECT setval('public.blog_posts_id_seq', COALESCE((SELECT MAX(id) FROM public.blog_posts), 0) + 1, false);
ALTER TABLE public.blog_posts ALTER COLUMN id SET DEFAULT nextval('public.blog_posts_id_seq');