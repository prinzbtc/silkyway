'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pusherClient } from '@/lib/pusher';
import ConversationList from './ConversationList';
import ConversationFeed from './ConversationFeed';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

import { Conversation } from '@/types/conversation';

interface InboxContainerProps {
  conversations: Conversation[];
  userId: string;
}

export default function InboxContainer({
  conversations: initialConversations,
  userId,
}: InboxContainerProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    // Subscribe to user's conversation channel
    const channel = pusherClient.subscribe(`user-${userId}`);

    channel.bind('new-message', (data: any) => {
      setConversations((prev) => {
        const conversationIndex = prev.findIndex((c) => c.id === data.conversationId);
        if (conversationIndex === -1) return prev;

        const newConversations = [...prev];
        const conversation = { ...newConversations[conversationIndex] };
        
        // Update message count and latest message
        conversation._count = {
          messages: (conversation._count?.messages ?? 0) + (data.senderId !== userId ? 1 : 0)
        };
        conversation.messages = [data.message];
        conversation.updatedAt = new Date().toISOString();

        // Move conversation to top
        newConversations.splice(conversationIndex, 1);
        newConversations.unshift(conversation);

        return newConversations;
      });
    });

    channel.bind('message-viewed', (data: any) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === data.conversationId) {
            return {
              ...conv,
              _count: { messages: 0 },
              messages: conv.messages.map((msg: any) => ({
                ...msg,
                viewed: true,
              })),
            };
          }
          return conv;
        })
      );
    });

    channel.bind('new-offer', (data: any) => {
      setConversations((prev) => {
        const conversationIndex = prev.findIndex((c) => c.id === data.conversationId);
        if (conversationIndex === -1) return prev;

        const newConversations = [...prev];
        const conversation = { ...newConversations[conversationIndex] };
        
        // Update offers
        conversation.offers = [...(conversation.offers ?? []), data.offer];
        conversation.updatedAt = new Date().toISOString();

        // Move conversation to top
        newConversations.splice(conversationIndex, 1);
        newConversations.unshift(conversation);

        return newConversations;
      });
    });

    return () => {
      pusherClient.unsubscribe(`user-${userId}`);
    };
  }, [userId]);

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Mark messages as viewed
    if (conversation._count?.messages ?? 0 > 0) {
      fetch(`/api/conversations/${conversation.id}/view`, {
        method: 'POST',
      });
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Conversation List */}
      <div className="w-80 shrink-0 overflow-y-auto rounded-lg border">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id ?? null}
          onSelect={handleConversationSelect}
          userId={userId}
        />
      </div>

      {/* Conversation Feed */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border">
        {selectedConversation ? (
          <ConversationFeed
            conversation={selectedConversation}
            userId={userId}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-4 text-gray-500">
            Select a conversation to start chatting
          </div>
        )}
      </div>

      {/* Help Button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4"
        onClick={() => router.push('/help')}
      >
        <HelpCircle className="h-5 w-5" />
      </Button>
    </div>
  );
}
