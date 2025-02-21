import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Store challenges in memory (in production, use Redis or similar)
const challenges = new Map<string, { challenge: string; timestamp: number }>();

// Clean up expired challenges every hour
setInterval(() => {
  const now = Date.now();
  Array.from(challenges.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > 3600000) { // 1 hour
      challenges.delete(key);
    }
  });
}, 3600000);

export async function GET() {
  const challenge = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();
  
  // Store challenge with timestamp
  challenges.set(challenge, { challenge, timestamp });

  return NextResponse.json({ challenge });
}

// Export challenges map for use in verify endpoint
export { challenges };
