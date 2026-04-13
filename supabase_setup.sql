-- ================================================================
--  JNV TARIKHET — Supabase Setup SQL
--  Run this ENTIRE file in: supabase.com → SQL Editor
--  Safe to re-run — all operations are idempotent (IF NOT EXISTS /
--  DROP IF EXISTS before every policy).
-- ================================================================

-- ────────────────────────────────────────────────────────────────
--  TABLE 1: attendance
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          BIGSERIAL   PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  teacher     TEXT        NOT NULL,
  period      TEXT        NOT NULL,
  class       TEXT        NOT NULL,
  subject     TEXT        NOT NULL,
  taken       TEXT        NOT NULL,   -- 'Yes' or 'No'
  total       INTEGER     DEFAULT 0,
  present     INTEGER     DEFAULT 0,
  leave_count INTEGER     DEFAULT 0,
  od          INTEGER     DEFAULT 0,
  absent      INTEGER     DEFAULT 0,
  tca         INTEGER     DEFAULT 0,
  nr          INTEGER     DEFAULT 0,
  sick        INTEGER     DEFAULT 0,
  reason      TEXT        DEFAULT '',
  remarks     TEXT        DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON attendance (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_teacher     ON attendance (teacher);
CREATE INDEX IF NOT EXISTS idx_attendance_class       ON attendance (class);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- attendance policies
DROP POLICY IF EXISTS "allow_anon_insert"  ON attendance;
DROP POLICY IF EXISTS "allow_auth_insert"  ON attendance;
DROP POLICY IF EXISTS "allow_anon_select"  ON attendance;
DROP POLICY IF EXISTS "allow_auth_select"  ON attendance;

CREATE POLICY "allow_auth_insert"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_anon_select"
  ON attendance FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "allow_auth_select"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

-- ────────────────────────────────────────────────────────────────
--  TABLE 2: teacher_profiles
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name                  TEXT        NOT NULL,
  designation           TEXT        NOT NULL DEFAULT '',
  email                 TEXT        NOT NULL,
  classes               TEXT[]      NOT NULL DEFAULT '{}',
  subjects              TEXT[]      NOT NULL DEFAULT '{}',
  approved              BOOLEAN     NOT NULL DEFAULT FALSE,
  force_password_reset  BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Add columns if upgrading existing installs
ALTER TABLE teacher_profiles
  ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE teacher_profiles
  ADD COLUMN IF NOT EXISTS designation TEXT NOT NULL DEFAULT '';

ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

-- teacher_profiles policies
DROP POLICY IF EXISTS "teacher_self_insert" ON teacher_profiles;
DROP POLICY IF EXISTS "teacher_self_select" ON teacher_profiles;
DROP POLICY IF EXISTS "teacher_self_update" ON teacher_profiles;
DROP POLICY IF EXISTS "allow_admin_select"  ON teacher_profiles;
DROP POLICY IF EXISTS "allow_admin_update"  ON teacher_profiles;

CREATE POLICY "teacher_self_insert"
  ON teacher_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "teacher_self_select"
  ON teacher_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "teacher_self_update"
  ON teacher_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_admin_select"
  ON teacher_profiles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "allow_admin_update"
  ON teacher_profiles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
--  TABLE 3: admin_settings
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin_settings (key, value)
VALUES (
  'pin_hash',
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_settings_read"   ON admin_settings;
DROP POLICY IF EXISTS "admin_settings_update" ON admin_settings;
DROP POLICY IF EXISTS "admin_settings_insert" ON admin_settings;

CREATE POLICY "admin_settings_read"
  ON admin_settings FOR SELECT TO anon USING (true);

CREATE POLICY "admin_settings_update"
  ON admin_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "admin_settings_insert"
  ON admin_settings FOR INSERT TO anon WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
--  QUICK VERIFICATION
-- ────────────────────────────────────────────────────────────────
SELECT id, name, email, approved, force_password_reset, created_at
FROM teacher_profiles
ORDER BY created_at DESC;
