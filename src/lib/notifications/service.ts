import { Resend } from 'resend';
import { NotificationType, Notification, NotificationPreferences } from './types';
import prisma from '@/lib/prisma';
import { pusherServer } from '@/lib/pusher';
import { redis } from '@/lib/redis';

const resend = new Resend(process.env.RESEND_API_KEY);

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<Notification> {
    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notificationPreferences: true,
        email: true,
      },
    });

    if (!user) throw new Error('User not found');

    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        content: message,
        read: false,
      },
    }) as unknown as Notification;

    // Send real-time notification
    const preferences = user.notificationPreferences as unknown as NotificationPreferences;
    if (preferences?.inApp?.enabled && preferences.inApp.types.includes(type)) {
      await pusherServer.trigger(
        `user-${userId}`,
        'new-notification',
        notification
      );
    }

    // Send email notification if enabled
    if (user.email && this.shouldSendEmail(type, preferences)) {
      await this.sendEmail(user.email, type, title, message, metadata);
    }

    // Clear notification cache
    await redis.del(`notifications:${userId}`).catch(() => {/* ignore error */});

    return notification;
  }

  private shouldSendEmail(type: NotificationType, preferences: any): boolean {
    if (!preferences?.email) return false;

    const marketplaceTypes = [
      'sale',
      'new_offer',
      'offer_accepted',
      'offer_rejected',
      'new_message',
      'item_shipped',
      'item_delivered',
      'favorite_sold',
    ];

    const updateTypes = ['blog_update', 'changelog'];

    if (marketplaceTypes.includes(type)) {
      return preferences.email.marketplace && preferences.email.types.includes(type);
    }

    if (updateTypes.includes(type)) {
      return preferences.email.updates && preferences.email.types.includes(type);
    }

    return false;
  }

  private async sendEmail(
    email: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    const template = this.getEmailTemplate(type, title, message, metadata);

    await resend.emails.send({
      from: 'Silkyway <notifications@silkyway.com>',
      to: email,
      subject: title,
      html: template,
    });
  }

  private getEmailTemplate(
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): string {
    // TODO: Implement proper email templates
    return `
      <div>
        <h1>${title}</h1>
        <p>${message}</p>
        ${metadata?.actionUrl ? `<a href="${metadata.actionUrl}">View Details</a>` : ''}
      </div>
    `;
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        read: true,
      },
    });

    await redis.del(`notifications:${userId}`).catch(() => {/* ignore error */});
  }

  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `notifications:${userId}:unread`;
    const cached = await redis.get<string>(cacheKey).catch(() => null);
    
    if (cached) return parseInt(cached, 10);

    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    await redis.setex(cacheKey, 300, count.toString()); // Cache for 5 minutes

    return count;
  }
}
