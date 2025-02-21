import { User } from '@prisma/client';

export interface Session {
  walletAddress: string;
  signature: string;
  message: string;
  expiresAt: number;
}

export interface AdminSession extends Session {
  adminRole: string;
  permissions: string[];
}

export type AuthenticatedUser = Pick<User, 'id' | 'walletAddress' | 'adminRole' | 'notificationPreferences'>;
