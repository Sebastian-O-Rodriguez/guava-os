-- Enable RLS on _prisma_migrations to silence Supabase rls_disabled_in_public lint.
-- No policies added — only the service role (used by Prisma) should access this table.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
