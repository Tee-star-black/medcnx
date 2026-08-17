export function clearSession() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('medcnx_access_token');
  localStorage.removeItem('medcnx_refresh_token');
  localStorage.removeItem('medcnx_user');
}

export function saveSession(
  accessToken: string,
  user: unknown,
  refreshToken?: string,
) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem('medcnx_access_token', accessToken);
  if (refreshToken) {
    localStorage.setItem('medcnx_refresh_token', refreshToken);
  }
  localStorage.setItem('medcnx_user', JSON.stringify(user));
}

export function getAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem('medcnx_access_token');
}
