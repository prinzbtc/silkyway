import PusherClient from 'pusher-js';
import PusherServer from 'pusher';

// Configuration for Soketi (local development) or Pusher (production)
const isProd = process.env.NODE_ENV === 'production';

// Client configuration
export const pusherClient = new PusherClient(
  isProd ? process.env.NEXT_PUBLIC_PUSHER_KEY! : 'app-key',
  {
    cluster: isProd ? process.env.NEXT_PUBLIC_PUSHER_CLUSTER! : '',
    wsHost: isProd ? undefined : 'localhost',
    wsPort: isProd ? undefined : 6001,
    wssPort: isProd ? undefined : 6001,
    forceTLS: isProd,
    enabledTransports: isProd ? ['ws', 'wss'] : ['ws'],
    disableStats: true,
  }
);

// Server configuration for production or development (Soketi)
let pusherServerConfig: any;

if (isProd) {
  // Production configuration using Pusher
  pusherServerConfig = {
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  };
} else {
  // Development configuration using Soketi
  pusherServerConfig = {
    appId: 'app-id',
    key: 'app-key',
    secret: 'app-secret',
    host: 'localhost',
    port: '6001',
    useTLS: false,
  };
}

// Create the Pusher server instance
export const pusherServer = new PusherServer(pusherServerConfig);
