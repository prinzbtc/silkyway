import { BadgeType, USER_BADGES } from '@/types/badge';
import { User } from '@/types/user';

export function getUserBadges(user: Partial<User> & Pick<User, 'id' | 'walletAddress'> & {
  isAdmin?: boolean;
  twitterHandle?: string | null;
  completedTransactionCount?: number;
}): BadgeType[] {
  const badges: BadgeType[] = [];

  // Admin badge
  if (user.isAdmin) {
    badges.push('admin');
  }

  // Verified badge (Twitter/X connection)
  if (user.twitterHandle) {
    badges.push('verified');
  }

  // Transaction-based badges
  const completedTransactions = user.completedTransactionCount || 0;

  if (completedTransactions >= 20) {
    badges.push('big_boss');
  } else if (completedTransactions >= 10) {
    badges.push('grand_merchant');
  } else if (completedTransactions >= 5) {
    badges.push('merchant');
  } else if (completedTransactions >= 1) {
    badges.push('hobbit');
  } else {
    badges.push('newbie');
  }

  return badges;
}

export function getBadgeStyle(type: BadgeType) {
  const badge = USER_BADGES[type];
  
  const baseClasses = 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset';
  
  switch (badge.color) {
    case 'white':
      return `${baseClasses} bg-white text-gray-900 ring-gray-200`;
    case 'pink':
      return `${baseClasses} bg-pink-50 text-pink-700 ring-pink-700/10`;
    case 'green':
      return `${baseClasses} bg-green-50 text-green-700 ring-green-600/20`;
    case 'blue':
      return `${baseClasses} bg-blue-50 text-blue-700 ring-blue-700/10`;
    case 'silver':
      return `${baseClasses} bg-gray-100 text-gray-600 ring-gray-500/10`;
    case 'gold':
      return `${baseClasses} bg-yellow-50 text-yellow-800 ring-yellow-600/20`;
    case 'black':
      return `${baseClasses} bg-gray-900 text-white ring-gray-900/10`;
    default:
      return `${baseClasses} bg-gray-50 text-gray-600 ring-gray-500/10`;
  }
}
