import { NextApiRequest, NextApiResponse } from 'next';
import { getSessionFromApiRequest } from '@/lib/auth/api-helpers';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionFromApiRequest(req);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      // Fetch all conversations where the user is either the buyer or seller
      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [
            { buyerId: userId },
            { sellerId: userId }
          ]
        },
        include: {
          buyer: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          },
          seller: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          },
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              currency: true,
              media: true,
              status: true,
              description: true,
              category: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true
                }
              }
            }
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc'
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      // Count unread messages for each conversation
      const conversationsWithUnreadCount = await Promise.all(
        conversations.map(async (conversation: any) => {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conversation.id,
              receiverId: userId,
              read: false
            }
          });

          return {
            ...conversation,
            unreadCount
          };
        })
      );

      return res.status(200).json({ conversations: conversationsWithUnreadCount });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  } else if (req.method === 'POST') {
    try {
      const { listingId, message } = req.body;

      if (!listingId) {
        return res.status(400).json({ error: 'Listing ID is required' });
      }

      // Get the listing to find the seller
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { userId: true }
      });

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      const sellerId = listing.userId;

      // Don't allow users to message themselves
      if (sellerId === userId) {
        return res.status(400).json({ error: 'You cannot message yourself' });
      }

      // Check if a conversation already exists for this listing and users
      let conversation = await prisma.conversation.findFirst({
        where: {
          listingId,
          OR: [
            {
              buyerId: userId,
              sellerId
            },
            {
              buyerId: sellerId,
              sellerId: userId
            }
          ]
        }
      });

      // If no conversation exists, create a new one
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            buyerId: userId, // Assume the current user is the buyer
            sellerId,
            listingId
          }
        });
      }

      // If a message was provided, create it
      if (message) {
        await prisma.message.create({
          data: {
            content: message,
            senderId: userId,
            receiverId: sellerId,
            conversationId: conversation.id
          }
        });
      }

      return res.status(201).json({ conversation });
    } catch (error) {
      console.error('Error creating conversation:', error);
      return res.status(500).json({ error: 'Failed to create conversation' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
