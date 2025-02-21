'use client';

import { useEffect, useState } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface AnimatedButtonProps extends React.ComponentProps<typeof Button> {
  animationInterval?: number;
}

export function AnimatedButton({ 
  className,
  animationInterval = 30000, // Default to 30 seconds
  ...props 
}: AnimatedButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Initial delay of 2 seconds before starting the animation cycle
    const initialTimeout = setTimeout(() => {
      setIsAnimating(true);
    }, 2000);

    // Set up the interval for subsequent animations
    const interval = setInterval(() => {
      setIsAnimating(true);
    }, animationInterval);

    // Reset animation state after each animation
    const animationResetTimeout = setInterval(() => {
      if (isAnimating) {
        setIsAnimating(false);
      }
    }, 2000); // Match this with the animation duration in CSS

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      clearInterval(animationResetTimeout);
    };
  }, [animationInterval]);

  return (
    <Button
      {...props}
      className={cn(
        className,
        isAnimating && 'animate-heart-bump'
      )}
    />
  );
}
