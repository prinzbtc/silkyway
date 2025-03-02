'use client';

import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import type { Conversation } from '@/types/conversation';
import { formatPrice, formatSOL, getSolPrice, type Currency } from '@/lib/price';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  userId: string;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  userId,
}: ConversationListProps) {
  const { preferredCurrency } = useCurrencyPreference();

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      // First sort by unread messages
      const aCount = a._count.messages;
      const bCount = b._count.messages;
      if (aCount !== bCount) {
        return bCount - aCount;
      }
      // Then by last update
      const aDate = new Date(a.updatedAt);
      const bDate = new Date(b.updatedAt);
      return bDate.getTime() - aDate.getTime();
    });
  }, [conversations]);

  return (
    <div className="divide-y">
      {sortedConversations.map((conversation) => {
        const isBuyer = conversation.buyer.id === userId;
        const otherUser = isBuyer ? conversation.listing.user : conversation.buyer;
        const messageCount = conversation._count.messages;
        const hasUnread = messageCount > 0;

        return (
          <button
            key={conversation.id}
            className={cn(
              'flex w-full items-start gap-3 p-3 text-left transition hover:bg-accent/50',
              selectedId === conversation.id && 'bg-accent',
              hasUnread && 'font-medium'
            )}
            onClick={() => onSelect(conversation)}
          >
            <div className="relative h-12 w-12 shrink-0">
              <Image
                src={conversation.listing.mainImage}
                alt={conversation.listing.title}
                fill
                className="rounded-md object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1">
                {conversation.listing.title}
              </div>
              <div className="mt-1 text-sm">
                <div className="line-clamp-1 text-gray-500">
                  {otherUser.username || 'Anon'}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-medium">
                    {formatSOL(conversation.listing.price)}
                  </span>
                  <PriceInPreferredCurrency
                    amount={conversation.listing.price}
                    currency={preferredCurrency}
                  />
                </div>
              </div>
            </div>
            {hasUnread && (
              <div className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {messageCount}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PriceInPreferredCurrency({
  amount,
  currency,
}: {
  amount: number;
  currency: string;
}) {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    const updatePrice = async () => {
      // Make sure we're not passing 'SOL' to getSolPrice
      if (currency !== 'SOL') {
        const solPrice = await getSolPrice(currency as Exclude<Currency, 'SOL'>);
        setPrice(solPrice ? amount * solPrice : null);
      }
    };

    updatePrice();
  }, [amount, currency]);

  if (!price) return null;

  return (
    <span className="text-xs text-gray-500">
      {formatPrice(price, currency as Currency)}
    </span>
  );
}
