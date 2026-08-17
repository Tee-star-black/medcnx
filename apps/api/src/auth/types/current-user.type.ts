export type CurrentUser = {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
};
