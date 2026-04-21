-- Enable RLS on all tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_notes" ENABLE ROW LEVEL SECURITY;

-- Users: can only see/modify own row
CREATE POLICY "users_select_own" ON "users" FOR SELECT USING (id = auth.uid()::text);
CREATE POLICY "users_insert_own" ON "users" FOR INSERT WITH CHECK (id = auth.uid()::text);
CREATE POLICY "users_update_own" ON "users" FOR UPDATE USING (id = auth.uid()::text);

-- Categories: user_id = auth.uid()
CREATE POLICY "categories_select_own" ON "categories" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "categories_insert_own" ON "categories" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "categories_update_own" ON "categories" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "categories_delete_own" ON "categories" FOR DELETE USING (user_id = auth.uid()::text);

-- Goals: user_id = auth.uid()
CREATE POLICY "goals_select_own" ON "goals" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "goals_insert_own" ON "goals" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "goals_update_own" ON "goals" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "goals_delete_own" ON "goals" FOR DELETE USING (user_id = auth.uid()::text);

-- Logs: user_id = auth.uid()
CREATE POLICY "logs_select_own" ON "logs" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "logs_insert_own" ON "logs" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "logs_delete_own" ON "logs" FOR DELETE USING (user_id = auth.uid()::text);

-- Daily notes: user_id = auth.uid()
CREATE POLICY "daily_notes_select_own" ON "daily_notes" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "daily_notes_insert_own" ON "daily_notes" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "daily_notes_update_own" ON "daily_notes" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "daily_notes_delete_own" ON "daily_notes" FOR DELETE USING (user_id = auth.uid()::text);

-- Service role bypasses RLS (used by API routes with supabaseAdmin)
-- This is handled by Supabase automatically for the service_role key.
