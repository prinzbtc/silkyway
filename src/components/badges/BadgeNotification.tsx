'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeType, USER_BADGES } from '@/types/badge';
import { UserBadge } from './UserBadge';
import confetti from 'canvas-confetti';

interface BadgeNotificationProps {
  type: BadgeType;
  onClose: () => void;
}

export function BadgeNotification({ type, onClose }: BadgeNotificationProps) {
  const badge = USER_BADGES[type];

  useEffect(() => {
    // Trigger confetti animation
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6347'],
    });

    // Auto-close after 5 seconds
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.3 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
        className="fixed bottom-4 right-4 flex items-center gap-4 bg-white rounded-lg shadow-lg p-4 z-50"
      >
        <div className="flex-shrink-0">
          <UserBadge type={type} className="scale-125" />
        </div>
        <div className="flex flex-col">
          <h3 className="font-semibold text-gray-900">New Badge Earned!</h3>
          <p className="text-sm text-gray-600">
            Congratulations! You&apos;ve earned the {badge.label} badge.
          </p>
        </div>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
