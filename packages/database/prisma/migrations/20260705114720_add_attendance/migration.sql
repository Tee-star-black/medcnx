-- Recovered migration.
-- The failed attendance migration created the AttendanceStatus enum in the database
-- but did not create the attendance_records table.
-- This file exists to keep Prisma migration history aligned.

CREATE TYPE "AttendanceStatus" AS ENUM ('CLOCKED_IN', 'CLOCKED_OUT', 'MISSED_CLOCK_OUT');