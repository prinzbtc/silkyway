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
  // Smaller badges with reduced font size
  const baseClasses = 'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium';
  
  // Specific styling for each badge type with light/dark mode variants
  switch (type) {
    case 'admin':
      // Light: #020817 outline, #ffffff badge color, #020817 font
      // Dark: no outline, #ffffff badge color, #020817 font
      return `${baseClasses} bg-[#ffffff] text-[#020817] ring-1 ring-[#020817] dark:ring-0 dark:bg-[#ffffff] dark:text-[#020817]`;
      
    case 'newbie':
      // Light: no outline, darkish pink badge color, #ffffff font
      // Dark: #ffffff outline, darkish pink badge color, #ffffff font
      return `${baseClasses} bg-[#d70a64] text-[#ffffff] ring-0 dark:bg-[#d70a64] dark:text-[#ffffff] dark:ring-1 dark:ring-[#ffffff]`;
      
    case 'hobbit':
      // Light: no outline, #0a4614 badge color, #ffffff font
      // Dark: #ffffff outline, #0a4614 badge color, #ffffff font
      return `${baseClasses} bg-[#0a4614] text-[#ffffff] ring-0 dark:bg-[#0a4614] dark:text-[#ffffff] dark:ring-1 dark:ring-[#ffffff]`;
      
    case 'merchant':
      // Light: no outline, #020817 badge color, #ffffff font
      // Dark: #ffffff outline, #020817 badge color, #ffffff font
      return `${baseClasses} bg-[#020817] text-[#ffffff] ring-0 dark:bg-[#020817] dark:text-[#ffffff] dark:ring-1 dark:ring-[#ffffff]`;
      
    case 'grand_merchant':
      // Light: no outline, gradient silver badge color, #020817 font
      // Dark: #020817 outline, gradient silver badge color, #020817 font
      return `${baseClasses} bg-gradient-to-r from-[#C0C0C0] to-[#E8E8E8] text-[#020817] ring-0 dark:bg-gradient-to-r dark:from-[#C0C0C0] dark:to-[#E8E8E8] dark:text-[#020817] dark:ring-1 dark:ring-[#020817]`;
      
    case 'big_boss':
      // Light: no outline, gradient gold badge color, #020817 font
      // Dark: #020817 outline, gradient gold badge color, #020817 font
      return `${baseClasses} bg-gradient-to-r from-[#FFD700] to-[#FFC000] text-[#020817] ring-0 dark:bg-gradient-to-r dark:from-[#FFD700] dark:to-[#FFC000] dark:text-[#020817] dark:ring-1 dark:ring-[#020817]`;
      
    case 'verified':
      // Light: no outline, black badge color, #ffffff font
      // Dark: #ffffff outline, black badge color, #ffffff font
      return `${baseClasses} bg-[#000000] text-[#ffffff] ring-0 dark:bg-[#000000] dark:text-[#ffffff] dark:ring-1 dark:ring-[#ffffff]`;
      
    default:
      return `${baseClasses} bg-[#f3f4f6] text-[#1f2937] dark:bg-[#1f2937] dark:text-[#f3f4f6] ring-0`;
  }
}
