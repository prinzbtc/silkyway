'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

const COMMON_EMOJIS = [
  // Positive reactions
  '😊', '😃', '😄', '🥰', '😍', '🤗', '😎', '🥳',
  // Hand gestures
  '👍', '👎', '👋', '🙌', '🤝', '💪', '🙏', '👌',
  // Hearts and emotions
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  // Shopping and money
  '💰', '💵', '💸', '🛍️', '🎁', '📦', '💎', '💳',
  // Stars and sparkles
  '⭐', '🌟', '✨', '💫', '🌠', '🔥', '💥', '✅',
  // Communication
  '💬', '📱', '📨', '🤔', '🤩', '😇', '💯', '💡',
  // Marketplace specific
  '🏷️', '🔍', '📸', '✂️', '👕', '👗', '👟', '🎮'
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <div className="grid grid-cols-8 gap-1">
          {COMMON_EMOJIS.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-muted"
              onClick={() => {
                onEmojiSelect(emoji);
                setIsOpen(false);
              }}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
