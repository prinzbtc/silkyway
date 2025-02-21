'use client';

import { useEffect, useState } from 'react';
import { pusherClient } from '@/lib/pusher';

export default function PusherTest() {
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    // Subscribe to a test channel
    const channel = pusherClient.subscribe('test-channel');

    // Listen for test events
    channel.bind('test-event', (data: { message: string }) => {
      setMessage(data.message);
      console.log('Received message:', data.message);
    });

    // Cleanup on unmount
    return () => {
      pusherClient.unsubscribe('test-channel');
    };
  }, []);

  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-lg font-semibold mb-2">Pusher Test</h2>
      <p>Status: {pusherClient.connection.state}</p>
      {message && (
        <p className="mt-2">
          Last message: <span className="font-medium">{message}</span>
        </p>
      )}
    </div>
  );
}
