'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';

export const NOTIFICATIONS_CHANGED_EVENT =
  'medcnx:notifications-changed';

export type EmployeeNotification = {
  id: string;
  category: string;
  title: string;
  message: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationResponse = {
  unreadCount: number;
  notifications: EmployeeNotification[];
};

type UseEmployeeNotificationsOptions = {
  enabled?: boolean;
  pollInterval?: number;
};

export function announceNotificationsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

export function useEmployeeNotifications({
  enabled = true,
  pollInterval = 15_000,
}: UseEmployeeNotificationsOptions = {}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] =
    useState<EmployeeNotification | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const initialised = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || !localStorage.getItem('medcnx_access_token')) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await api.get<NotificationResponse>(
        '/employee-self-service/notifications',
      );
      const notifications = response.data.notifications ?? [];

      if (initialised.current) {
        const newestUnread = notifications.find(
          (item) => !item.readAt && !knownIds.current.has(item.id),
        );

        if (newestUnread) {
          setLatestNotification(newestUnread);
        }
      }

      knownIds.current = new Set(notifications.map((item) => item.id));
      initialised.current = true;
      setUnreadCount(response.data.unreadCount ?? 0);
    } catch {
      // Some admin accounts are not linked to an employee profile. The
      // workspace must remain usable when employee notifications are unavailable.
      setUnreadCount(0);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      initialised.current = false;
      knownIds.current = new Set();
      return;
    }

    void refresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, pollInterval);

    const handleFocus = () => void refresh();
    const handleChanged = () => void refresh();

    window.addEventListener('focus', handleFocus);
    window.addEventListener(
      NOTIFICATIONS_CHANGED_EVENT,
      handleChanged,
    );

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener(
        NOTIFICATIONS_CHANGED_EVENT,
        handleChanged,
      );
    };
  }, [enabled, pollInterval, refresh]);

  useEffect(() => {
    if (!latestNotification) return;

    const timer = window.setTimeout(
      () => setLatestNotification(null),
      8_000,
    );

    return () => window.clearTimeout(timer);
  }, [latestNotification]);

  const dismissLatest = useCallback(() => {
    setLatestNotification(null);
  }, []);

  const markRead = useCallback(async (notificationId: string) => {
    await api.patch(
      `/employee-self-service/notifications/${notificationId}/read`,
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    announceNotificationsChanged();
  }, []);

  return {
    unreadCount,
    latestNotification,
    dismissLatest,
    markRead,
    refresh,
  };
}
