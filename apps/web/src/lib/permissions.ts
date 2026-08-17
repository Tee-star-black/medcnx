import type { AuthUser } from '@/types/auth';

export function can(
  user: Pick<AuthUser, 'permissions'> | null | undefined,
  permission: string,
) {
  return Boolean(
    user?.permissions?.includes(permission),
  );
}

export function canAny(
  user: Pick<AuthUser, 'permissions'> | null | undefined,
  permissions: string[],
) {
  return permissions.some((permission) =>
    can(user, permission),
  );
}