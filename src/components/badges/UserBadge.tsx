'use client';

import { BadgeType, USER_BADGES } from '@/types/badge';
import { getBadgeStyle } from '@/lib/badges';

interface UserBadgeProps {
  type: BadgeType;
  className?: string;
}

export function UserBadge({ type, className }: UserBadgeProps) {
  const badge = USER_BADGES[type];
  const style = getBadgeStyle(type);

  return (
    <span className={`${style} ${className || ''}`}>
      {badge.label}
    </span>
  );
}
