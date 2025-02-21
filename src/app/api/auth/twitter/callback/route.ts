import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import type { SessionData } from '@/lib/auth';
import { OAuth } from 'oauth';
import prisma from '@/lib/prisma';

type TwitterOAuthResponse = {
  screen_name: string;
  user_id: string;
};

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

  const searchParams = req.nextUrl.searchParams;
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');
  const tokenSecret = req.cookies.get('twitter_oauth_token_secret')?.value;

  if (!oauthToken || !oauthVerifier || !tokenSecret) {
    return new NextResponse('Invalid OAuth tokens', { status: 400 });
  }

  return new Promise((resolve) => {
    oauth.getOAuthAccessToken(
      oauthToken,
      tokenSecret,
      oauthVerifier,
      async (err: Error | { statusCode: number; data?: any } | null, accessToken: string, accessTokenSecret: string, results: TwitterOAuthResponse) => {
        if (err) {
          console.error('Error getting OAuth access token:', err);
          resolve(new NextResponse('Failed to connect to Twitter', { status: 500 }));
          return;
        }

        try {
          // Update user with Twitter handle
          await prisma.user.update({
            where: { id: session.user.id },
            data: {
              twitterHandle: results.screen_name,
              twitterVerifiedAt: new Date(),
            },
          });

          // Create HTML response that sends a message to the opener window
          const html = `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Twitter Connection Success</title>
              </head>
              <body>
                <script>
                  window.opener.postMessage({ type: 'twitter-connected' }, '*');
                </script>
                <p>Twitter account connected successfully! You can close this window.</p>
              </body>
            </html>
          `;

          const response = new NextResponse(html, {
            headers: { 'Content-Type': 'text/html' },
          });

          // Clear the oauth token secret cookie
          response.cookies.delete('twitter_oauth_token_secret');

          resolve(response);
        } catch (dbError) {
          console.error('Database error:', dbError);
          resolve(new NextResponse('Failed to update user profile', { status: 500 }));
        }
      }
    );
  });
}
