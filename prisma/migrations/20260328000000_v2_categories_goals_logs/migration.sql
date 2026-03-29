-- RoutineMe v2 migration: replace Habit/Completion with Category/Goal/Log

-- Drop old tables (data will be lost — dev reset accepted)
DROP TABLE IF EXISTS "completions";
DROP TABLE IF EXISTS "habits";

-- Create categories table
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "icon" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Create goals table
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'weekly',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- Create logs table
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- Indexes for categories
CREATE INDEX "categories_user_id_active_idx" ON "categories"("user_id", "active");

-- Indexes for goals
CREATE INDEX "goals_category_id_active_idx" ON "goals"("category_id", "active");

-- Indexes for logs
CREATE INDEX "logs_category_id_date_idx" ON "logs"("category_id", "date");
CREATE INDEX "logs_date_idx" ON "logs"("date");

-- Foreign keys for categories
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for goals
ALTER TABLE "goals" ADD CONSTRAINT "goals_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for logs
ALTER TABLE "logs" ADD CONSTRAINT "logs_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
