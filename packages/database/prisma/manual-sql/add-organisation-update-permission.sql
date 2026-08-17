INSERT INTO "permissions" ("id", "key", "description", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'organisation:update',
  'Update organisation settings',
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid(),
  r."id",
  p."id",
  NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."key" = 'organisation:update'
  AND r."name" IN ('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER')
ON CONFLICT DO NOTHING;