-- ================================================================
--  JNV TARIKHET - Supabase Setup SQL (Hardened)
--  Run this in Supabase SQL Editor.
--  Safe to re-run (uses IF NOT EXISTS and DROP POLICY IF EXISTS).
-- ================================================================

-- ----------------------------------------------------------------
--  TABLE 1: teacher_profiles
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  classes    TEXT[]      NOT NULL DEFAULT '{}',
  subjects   TEXT[]      NOT NULL DEFAULT '{}',
  approved   BOOLEAN     NOT NULL DEFAULT FALSE
);

ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_self_insert" ON teacher_profiles;
DROP POLICY IF EXISTS "teacher_self_select" ON teacher_profiles;
DROP POLICY IF EXISTS "teacher_self_update" ON teacher_profiles;
DROP POLICY IF EXISTS "admin_read_profiles" ON teacher_profiles;
DROP POLICY IF EXISTS "admin_update_profiles" ON teacher_profiles;
DROP POLICY IF EXISTS "allow_admin_select"  ON teacher_profiles;
DROP POLICY IF EXISTS "allow_admin_update"  ON teacher_profiles;

-- Teachers can insert and read their own profile only.
CREATE POLICY "teacher_self_insert"
  ON teacher_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND approved = FALSE);

CREATE POLICY "teacher_self_select"
  ON teacher_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- No self-update policy: profile approval and assignments are admin-managed.

-- ----------------------------------------------------------------
--  TABLE 2: admin_users
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note       TEXT        NOT NULL DEFAULT ''
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_self_select" ON admin_users;

CREATE POLICY "admin_self_select"
  ON admin_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin policies for teacher profile management.
CREATE POLICY "admin_read_profiles"
  ON teacher_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_update_profiles"
  ON teacher_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
--  TABLE 3: attendance
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id          BIGSERIAL   PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  teacher_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  teacher     TEXT        NOT NULL,
  period      TEXT        NOT NULL,
  class       TEXT        NOT NULL,
  subject     TEXT        NOT NULL,
  taken       TEXT        NOT NULL,
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

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON attendance (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_teacher     ON attendance (teacher);
CREATE INDEX IF NOT EXISTS idx_attendance_teacher_id  ON attendance (teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class       ON attendance (class);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_insert"             ON attendance;
DROP POLICY IF EXISTS "allow_auth_insert"             ON attendance;
DROP POLICY IF EXISTS "allow_anon_select"             ON attendance;
DROP POLICY IF EXISTS "allow_auth_select"             ON attendance;
DROP POLICY IF EXISTS "teacher_insert_own_attendance" ON attendance;
DROP POLICY IF EXISTS "admin_select_attendance"       ON attendance;

CREATE POLICY "teacher_insert_own_attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM teacher_profiles tp
      WHERE tp.id = auth.uid()
    )
  );

CREATE POLICY "admin_select_attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION sync_attendance_teacher()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.teacher_id IS NULL THEN
    RAISE EXCEPTION 'teacher_id is required';
  END IF;

  SELECT tp.name INTO NEW.teacher
  FROM teacher_profiles tp
  WHERE tp.id = NEW.teacher_id;

  IF NEW.teacher IS NULL THEN
    RAISE EXCEPTION 'teacher profile not found for teacher_id %', NEW.teacher_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_attendance_teacher ON attendance;
CREATE TRIGGER trg_sync_attendance_teacher
  BEFORE INSERT OR UPDATE OF teacher_id
  ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION sync_attendance_teacher();

-- ----------------------------------------------------------------
--  TABLE 4: admin_settings
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin_settings (key, value)
VALUES ('pin_hash', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_settings_read"   ON admin_settings;
DROP POLICY IF EXISTS "admin_settings_update" ON admin_settings;
DROP POLICY IF EXISTS "admin_settings_insert" ON admin_settings;

CREATE POLICY "admin_settings_read"
  ON admin_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_settings_update"
  ON admin_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_settings_insert"
  ON admin_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
--  REQUIRED ONE-TIME STEP
-- ----------------------------------------------------------------
-- Add at least one admin account after the user exists in auth.users:
-- INSERT INTO admin_users (user_id, note)
-- VALUES ('<admin-user-uuid>', 'Primary dashboard admin')
-- ON CONFLICT (user_id) DO NOTHING;

