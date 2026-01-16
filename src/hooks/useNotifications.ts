import { useCallback, useEffect, useState } from 'react';

export type NotificationPermissionState = 'default' | 'granted' | 'denied';

interface UseNotificationsReturn {
  permission: NotificationPermissionState;
  isSupported: boolean;
  requestPermission: () => Promise<boolean>;
  sendNotification: (title: string, options?: NotificationOptions) => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission as NotificationPermissionState);
    }
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission === 'granted' && isSupported) {
      try {
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options
        });

        // Auto close after 10 seconds
        setTimeout(() => notification.close(), 10000);

        // Handle click to focus window
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }
  }, [permission, isSupported]);

  return { permission, isSupported, requestPermission, sendNotification };
};
