-- Add unit column to goals table
ALTER TABLE "goals" ADD COLUMN "unit" TEXT;

-- Backfill unit from existing metric names
UPDATE "goals" SET "unit" = 'calories' WHERE "metric" = 'calories';
UPDATE "goals" SET "unit" = 'grams' WHERE "metric" IN ('protein', 'fat', 'carbs');
UPDATE "goals" SET "unit" = 'miles' WHERE "metric" = 'miles';
UPDATE "goals" SET "unit" = 'count' WHERE "metric" IN ('sessions', 'chest_sessions', 'back_sessions', 'leg_sessions', 'arm_sessions', 'shoulder_sessions');
-- Default anything else to count
UPDATE "goals" SET "unit" = 'count' WHERE "unit" IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE "goals" ALTER COLUMN "unit" SET NOT NULL;
ALTER TABLE "goals" ALTER COLUMN "unit" SET DEFAULT 'count';
