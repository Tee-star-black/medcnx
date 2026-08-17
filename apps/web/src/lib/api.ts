import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { clearSession } from './session';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

type RetriableRequest = InternalAxiosRequestConfig & {
  _medcnxRetried?: boolean;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export const api = axios.create({ baseURL });
const refreshClient = axios.create({ baseURL });
let refreshPromise: Promise<RefreshResponse> | null = null;

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;

  const token = localStorage.getItem('medcnx_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (typeof window === 'undefined' || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const request = error.config as RetriableRequest | undefined;
    const refreshToken = localStorage.getItem('medcnx_refresh_token');
    const isAuthRequest = request?.url?.startsWith('/auth/');

    if (!request || request._medcnxRetried || !refreshToken || isAuthRequest) {
      clearAndRedirect();
      return Promise.reject(error);
    }

    request._medcnxRetried = true;

    try {
      refreshPromise ??= refreshClient
        .post<RefreshResponse>('/auth/refresh', { refreshToken })
        .then((response) => response.data)
        .finally(() => {
          refreshPromise = null;
        });

      const tokens = await refreshPromise;
      localStorage.setItem('medcnx_access_token', tokens.accessToken);
      localStorage.setItem('medcnx_refresh_token', tokens.refreshToken);
      request.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return api.request(request);
    } catch {
      clearAndRedirect();
      return Promise.reject(error);
    }
  },
);

function clearAndRedirect() {
  clearSession();
  if (window.location.pathname !== '/') {
    window.location.replace('/');
  }
}
