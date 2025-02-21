'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { BadgeType } from '@/types/badge';
import { BadgeNotification } from '@/components/badges/BadgeNotification';

interface BadgeContextType {
  showBadgeNotification: (badge: BadgeType) => void;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

const BADGE_HISTORY_KEY = 'silkyway_badge_history';

export function BadgeProvider({ children }: { children: ReactNode }) {
  const [activeBadge, setActiveBadge] = useState<BadgeType | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<BadgeType[]>([]);

  // Load earned badges from localStorage on mount
  useEffect(() => {
    const history = localStorage.getItem(BADGE_HISTORY_KEY);
    if (history) {
      setEarnedBadges(JSON.parse(history));
    }
  }, []);

  const showBadgeNotification = (badge: BadgeType) => {
    // Only show notification for newly earned badges
    if (!earnedBadges.includes(badge)) {
      setActiveBadge(badge);
      // Add to earned badges history
      const updatedBadges = [...earnedBadges, badge];
      setEarnedBadges(updatedBadges);
      localStorage.setItem(BADGE_HISTORY_KEY, JSON.stringify(updatedBadges));
    }
  };

  return (
    <BadgeContext.Provider value={{ showBadgeNotification }}>
      {children}
      {activeBadge && (
        <BadgeNotification
          type={activeBadge}
          onClose={() => setActiveBadge(null)}
        />
      )}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    throw new Error('useBadges must be used within a BadgeProvider');
  }
  return context;
}
