import React from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export function PushNotificationWrapper({ children }: { children: React.ReactNode }) {
    usePushNotifications();
    return <>{children}</>;
}
