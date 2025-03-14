'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';
import { Notification } from '@/lib/notifications/types';

export function NotificationBell() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>> | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize Socket.IO connection
  const { isConnected, subscribe } = useSocket(session?.user?.id);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Load initial notifications
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      });
  }, [session?.user?.id]);

  // Subscribe to real-time notification updates
  useEffect(() => {
    if (!isConnected || !session?.user?.id) return;
    
    console.log(`Subscribing to notifications for user: ${session.user.id}`);

    // Handler for new notifications (handles both formats)
    const handleNewNotification = (data: Notification | { room?: string, data: Notification }) => {
      // Extract the notification object based on the format
      const notification = 'id' in data ? data : data.data;
      
      console.log('Received new notification:', notification);
      
      // Check if this notification is for the current user
      const notificationData = data as { room?: string, data: Notification };
      if (notificationData.room && !notificationData.room.includes(session.user.id)) {
        console.log(`Notification room ${notificationData.room} doesn't match user ${session.user.id}, ignoring`);
        return;
      }
      
      // Force a refresh of notifications from the server to ensure we have the latest data
      // This is more reliable than trying to merge client-side
      fetch('/api/notifications')
        .then(res => res.json())
        .then(data => {
          console.log('Refreshed notifications after receiving new one:', data);
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        })
        .catch(err => {
          console.error('Error refreshing notifications:', err);
          
          // Fallback to client-side update if server refresh fails
          setNotifications(prev => {
            // Check if notification already exists to avoid duplicates
            const exists = prev.some(n => n.id === notification.id);
            if (exists) {
              console.log(`Notification ${notification.id} already exists, ignoring`);
              return prev;
            }
            console.log(`Adding new notification ${notification.id} to list`);
            return [notification, ...prev];
          });
          
          setUnreadCount(prev => prev + 1);
        });
    };
    
    // Subscribe to both notification event formats
    const unsubscribeNewNotification = subscribe('new-notification', handleNewNotification);
    const unsubscribeServerNotification = subscribe('server-notification', handleNewNotification);

    // Subscribe to notification read updates
    const unsubscribeNotificationRead = subscribe('notification-read', (data: { notificationId: string }) => {
      setNotifications(prev => 
        prev.map(n => n.id === data.notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    return () => {
      unsubscribeNewNotification();
      unsubscribeServerNotification();
      unsubscribeNotificationRead();
    };
  }, [isConnected, session?.user?.id, subscribe]);

  const handleNotificationClick = async (notification: Notification) => {
    console.log(`Handling click on notification: ${notification.id}, read status: ${notification.read}`);
    
    if (!notification.read) {
      try {
        console.log(`Marking notification ${notification.id} as read`);
        const response = await fetch(`/api/notifications/${notification.id}/read`, {
          method: 'POST',
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Failed to mark notification as read: ${response.status}`, errorData);
          return;
        }
        
        console.log(`Successfully marked notification ${notification.id} as read`);
        
        // Update the UI to reflect the read status
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Check for link in notification or metadata
    if (notification.link) {
      window.location.href = notification.link;
    } else if (notification.metadata) {
      // Try to parse metadata if it's a string
      let metadata: any = notification.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          console.error('Failed to parse notification metadata:', e);
        }
      }
      
      // If metadata contains a link, navigate to it
      if (metadata?.link) {
        window.location.href = metadata.link;
      } else if (metadata?.conversationId) {
        // If no link but has conversationId, construct the URL
        window.location.href = `/inbox?conversationId=${metadata.conversationId}`;
      }
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
                {notification.message || notification.content}
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
