-- Add user_id column to goals table
ALTER TABLE "goals" ADD COLUMN "user_id" TEXT;

-- Add user_id column to logs table
ALTER TABLE "logs" ADD COLUMN "user_id" TEXT;

-- Backfill user_id from categories
UPDATE "goals" g
SET "user_id" = c."user_id"
FROM "categories" c
WHERE g."category_id" = c."id"
AND g."user_id" IS NULL;

UPDATE "logs" l
SET "user_id" = c."user_id"
FROM "categories" c
WHERE l."category_id" = c."id"
AND l."user_id" IS NULL;

-- Make user_id NOT NULL after backfill
ALTER TABLE "goals" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "logs" ALTER COLUMN "user_id" SET NOT NULL;

-- Add indexes for user_id queries
CREATE INDEX "goals_user_id_idx" ON "goals"("user_id");
CREATE INDEX "logs_user_id_idx" ON "logs"("user_id");
CREATE INDEX "logs_user_id_date_idx" ON "logs"("user_id", "date");
