'use client';

import { useMemo } from 'react';
// Import both conversation types to handle different formats
import type { Conversation } from '@/types/conversation';
import type { Conversation as DbConversation } from '@/types/chat';
import ConversationTab from './ConversationTab';

// Define a union type to handle both conversation formats
type AnyConversation = Conversation | DbConversation;

interface ConversationListProps {
  conversations: AnyConversation[];
  selectedId: string | null;
  onSelect: (conversation: AnyConversation) => void;
  userId: string;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  userId,
}: ConversationListProps) {
  // Sort conversations by unread messages and then by last update
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      // First sort by unread messages (safely handle both formats)
      const aCount = a._count?.messages || 0;
      const bCount = b._count?.messages || 0;
      if (aCount !== bCount) {
        return bCount - aCount;
      }
      // Then by last update (safely handle both formats)
      const aDate = new Date(a.updatedAt);
      const bDate = new Date(b.updatedAt);
      return bDate.getTime() - aDate.getTime();
    });
  }, [conversations]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {sortedConversations.map((conversation) => {
          // Get message count safely
          const messageCount = conversation._count?.messages || 0;
          const hasUnread = messageCount > 0;

          return (
            <ConversationTab
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedId === conversation.id}
              hasUnread={hasUnread}
              userId={userId}
              onSelect={() => onSelect(conversation)}
            />
          );
        })}

        {sortedConversations.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
}


