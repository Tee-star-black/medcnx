-- Provision explicit employee lifecycle permission for existing installations.

INSERT INTO "permissions" ("id", "key", "description", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'employees:terminate',
  'Terminate employee employment while preserving HR history',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid()::text,
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."key" = 'employees:terminate'
WHERE r."isSystem" = true
  AND r."name" IN ('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
