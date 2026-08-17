ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_lockedUntil_idx"
    ON "users"("lockedUntil");

CREATE INDEX IF NOT EXISTS "auth_sessions_expiresAt_idx"
    ON "auth_sessions"("expiresAt");

CREATE INDEX IF NOT EXISTS "auth_sessions_revokedAt_idx"
    ON "auth_sessions"("revokedAt");
