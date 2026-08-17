export type AuthUser = {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;

  organisation: {
    id: string;
    name: string;
    slug: string;
  };

  roles: string[];
  permissions: string[];
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type LoginResponse = AuthResponse;
