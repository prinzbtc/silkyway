export interface User {
  id: string;
  username: string | null;
  avatar?: string | null;
  walletAddress: string;
  bio: string | null;
  location: string | null;
  email: string | null;
  isAdmin?: boolean;
  hideWalletAddress: boolean;
  allowInAppNotifications: boolean;
  allowEmailNotifications: boolean;
  allowUpdates: boolean;
  // Social connections
  twitterHandle: string | null;
  twitterVerifiedAt: Date | null;
  // Stats
  completedTransactionCount: number;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
}
