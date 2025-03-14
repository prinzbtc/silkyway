'use client';

import { getSession } from '@/lib/auth/session';
import Image from 'next/image';
import { Message } from '@/types/chat';
import { useEffect, useState } from 'react';
import { TransactionNotisCard } from '@/components/notifications/TransactionNotisCard';
import { cn } from '@/lib/utils';
import { AlertTriangle, FileIcon, Loader2, ShieldAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatMessageProps {
  message: Message;
  className?: string;
}

export function ChatMessage({ message, className }: ChatMessageProps) {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>> | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);
  const isCurrentUser = message.senderId === session?.user?.id;

  if (message.type === 'transaction_notification') {
    const metadata = message.metadata as {
      type: 'buyer' | 'seller' | 'buyerCancel' | 'sellerCancel';
      listingTitle: string;
      counterpartyUsername: string;
      transactionId: string;
    };

    // Only show transaction notifications to the intended recipient
    const shouldShow = (
      (metadata.type.startsWith('buyer') && !isCurrentUser) || // Show buyer cards to buyers
      (metadata.type.startsWith('seller') && isCurrentUser)    // Show seller cards to sellers
    );

    if (!shouldShow) return null;

    return (
      <TransactionNotisCard
        type={metadata.type}
        listingTitle={metadata.listingTitle}
        counterpartyUsername={metadata.counterpartyUsername}
        transactionId={metadata.transactionId}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex w-full',
        isCurrentUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2 space-y-2',
          isCurrentUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <div>{message.content}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment, index) => {
              const isImage = attachment.type.startsWith('image/');
              const isVideo = attachment.type.startsWith('video/');
              const isPdf = attachment.type === 'application/pdf';
              const isProcessing = attachment.isProcessing;
              const isVirusDetected = attachment.isVirusDetected;
              
              // Don't render virus-infected attachments
              if (isVirusDetected) {
                return (
                  <div key={index} className="relative overflow-hidden rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 w-48">
                    <div className="flex items-center space-x-2">
                      <ShieldAlert className="h-6 w-6 text-red-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">Virus Detected</p>
                        <p className="text-xs text-red-500 dark:text-red-400 truncate">{attachment.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-red-500 mt-2">This file was blocked for security reasons.</p>
                  </div>
                );
              }
              
              return (
                <div key={index} className="relative overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                  {isProcessing && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-md">
                      <div className="bg-white dark:bg-gray-800 rounded-md p-2 shadow-lg">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-xs text-center mt-1">Processing...</p>
                      </div>
                    </div>
                  )}
                  
                  {isImage ? (
                    <div className="relative w-48 h-48">
                      <a 
                        href={attachment.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={isProcessing ? 'pointer-events-none' : ''}
                      >
                        <Image
                          src={attachment.url}
                          alt={attachment.name || "Attached image"}
                          fill
                          className={`object-cover rounded-md hover:opacity-90 transition-opacity ${isProcessing ? 'opacity-50' : ''}`}
                          unoptimized
                        />
                      </a>
                    </div>
                  ) : isVideo ? (
                    <div className="w-48">
                      <video 
                        controls 
                        className={`w-full rounded-md ${isProcessing ? 'opacity-50' : ''}`} 
                        preload="metadata"
                      >
                        <source src={attachment.url} type={attachment.type} />
                        Your browser does not support the video tag.
                      </video>
                      <div className="p-2 text-xs truncate">
                        {attachment.name}
                        {attachment.isCompressed && (
                          <span className="ml-1 text-green-500 text-xs">(Compressed)</span>
                        )}
                      </div>
                    </div>
                  ) : isPdf ? (
                    <div className="flex flex-col items-center justify-center w-48 h-48 p-2 bg-gray-50 dark:bg-gray-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <path d="M9 15h6" />
                        <path d="M9 11h6" />
                      </svg>
                      <a 
                        href={attachment.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`mt-2 text-sm text-blue-500 hover:underline truncate max-w-full ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        {attachment.name || "PDF Document"}
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center w-48 h-48 p-2 bg-gray-50 dark:bg-gray-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <a 
                        href={attachment.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`mt-2 text-sm text-blue-500 hover:underline truncate max-w-full ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        {attachment.name || "File"}
                      </a>
                      <span className="text-xs text-gray-500 mt-1">{attachment.type}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
