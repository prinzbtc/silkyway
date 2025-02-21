'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { pusherClient } from '@/lib/pusher';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Notification } from '@/lib/notifications/types';

export function NotificationBell() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>> | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Load initial notifications
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      });

    // Subscribe to real-time updates
    const channel = pusherClient.subscribe(`user-${session.user.id}`);
    
    channel.bind('new-notification', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      pusherClient.unsubscribe(`user-${session.user.id}`);
    };
  }, [session?.user?.id]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: 'POST',
      });
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
    }

    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative border border-midnight dark:border-[#ffffff] hover:bg-gray-50 dark:bg-[hsl(222.2,84%,4.9%)] dark:hover:bg-[hsl(222.2,84%,4.9%)]/90"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-midnight dark:text-[#ffffff]" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary dark:bg-white text-xs text-primary-foreground dark:text-blue-900">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border border-midnight dark:border-[#ffffff] bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)] text-midnight dark:text-[#ffffff]">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-midnight/60 dark:text-[#ffffff]">
            No notifications
          </div>
        ) : (
          notifications.map(notification => (
            <DropdownMenuItem
              key={notification.id}
              className={cn(
                'flex flex-col items-start p-4',
                !notification.read && 'bg-muted/50 dark:bg-[hsl(222.2,84%,4.9%)]/90'
              )}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="font-medium">{notification.title}</div>
              <div className="text-sm text-muted-foreground">
                {notification.message}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(notification.createdAt).toLocaleDateString()}
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
