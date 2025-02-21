import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { OAuth } from 'oauth';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY!;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET!;
const CALLBACK_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback`;

const oauth = new OAuth(
  'https://api.twitter.com/oauth/request_token',
  'https://api.twitter.com/oauth/access_token',
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  '1.0A',
  CALLBACK_URL,
  'HMAC-SHA1'
);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  return new Promise((resolve, reject) => {
    oauth.getOAuthRequestToken((error, token, tokenSecret) => {
      if (error) {
        console.error('Error getting OAuth request token:', error);
        resolve(new NextResponse('Failed to connect to Twitter', { status: 500 }));
        return;
      }

      // Store token secret in session
      const response = NextResponse.redirect(
        `https://api.twitter.com/oauth/authenticate?oauth_token=${token}`
      );
      response.cookies.set('twitter_oauth_token_secret', tokenSecret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      resolve(response);
    });
  });
}
