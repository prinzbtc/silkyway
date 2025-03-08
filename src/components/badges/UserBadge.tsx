'use client';

import { BadgeType, USER_BADGES } from '@/types/badge';

interface UserBadgeProps {
  type: BadgeType;
  className?: string;
}

export function UserBadge({ type, className }: UserBadgeProps) {
  const badge = USER_BADGES[type];
  
  // Base styles for all badges
  const baseClasses = 'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium';
  
  // Specific styling for each badge type with light/dark mode variants
  let badgeStyle = '';
  
  switch (type) {
    case 'admin':
      // Light: #020817 outline, #ffffff badge color, #020817 font
      // Dark: no outline, #ffffff badge color, #020817 font
      badgeStyle = `${baseClasses} bg-[#ffffff] text-[#020817] ring-1 ring-[#020817] dark:ring-0 dark:bg-[#ffffff] dark:text-[#020817]`;
      break;
      
    case 'newbie':
      // Light: no outline, dark purple neon badge color, #ffffff font
      // Dark: #ffffff outline, dark purple neon badge color, #ffffff font
      badgeStyle = `${baseClasses} bg-[#8a2be2] text-[#ffffff] ring-0 dark:bg-[#8a2be2] dark:text-[#ffffff] dark:ring-1 dark:ring-[#ffffff]`;
      break;
      
    case 'hobbit':
      // Light: no outline, #0a4614 badge color, #ffffff font
      // Dark: #ffffff outline, #0a4614 badge color, #ffffff font
      badgeStyle = `${baseClasses} bg-[#0a4614] text-[#ffffff] ring-0 dark:bg-[#0a4614] dark:text-[#ffffff] dark:ring-1 dark:ring-[#ffffff]`;
      break;
      
    case 'merchant':
      // Light: no outline, #020817 badge color, #ffffff font
      // Dark: #ffffff outline, #020817 badge color, #ffffff font
      badgeStyle = `${baseClasses} bg-[#020817] text-[#ffffff] ring-0 dark:bg-[#020817] dark:text-[#ffffff] dark:ring-1 dark:ring-[#ffffff]`;
      break;
      
    case 'grand_merchant':
      // Light: no outline, gradient silver badge color, #020817 font
      // Dark: #020817 outline, gradient silver badge color, #020817 font
      badgeStyle = `${baseClasses} bg-gradient-to-r from-[#C0C0C0] to-[#E8E8E8] text-[#020817] ring-0 dark:bg-gradient-to-r dark:from-[#C0C0C0] dark:to-[#E8E8E8] dark:text-[#020817] dark:ring-1 dark:ring-[#020817]`;
      break;
      
    case 'big_boss':
      // Light: no outline, gradient gold badge color, #020817 font
      // Dark: #020817 outline, gradient gold badge color, #020817 font
      badgeStyle = `${baseClasses} bg-gradient-to-r from-[#FFD700] to-[#FFC000] text-[#020817] ring-0 dark:bg-gradient-to-r dark:from-[#FFD700] dark:to-[#FFC000] dark:text-[#020817] dark:ring-1 dark:ring-[#020817]`;
      break;
      
    case 'verified':
      // Light: no outline, black badge color, #ffffff font
      // Dark: #ffffff outline, black badge color, #ffffff font
      badgeStyle = `${baseClasses} bg-[#000000] text-[#ffffff] ring-0 dark:bg-[#000000] dark:text-[#ffffff] dark:ring-1 dark:ring-[#ffffff]`;
      break;
      
    default:
      badgeStyle = `${baseClasses} bg-[#f3f4f6] text-[#1f2937] dark:bg-[#1f2937] dark:text-[#f3f4f6] ring-0`;
  }

  return (
    <span className={`${badgeStyle} ${className || ''}`}>
      {badge.label}
    </span>
  );
}
