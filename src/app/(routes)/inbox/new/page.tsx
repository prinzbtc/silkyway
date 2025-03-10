import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

// This page handles creating a new conversation from a listing
export const dynamic = 'force-dynamic';

export default async function NewConversationPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    return redirect('/login');
  }

  // Get the listingId from searchParams - ensure we await the searchParams
  const params = await Promise.resolve(searchParams);
  const { listingId } = params;
  
  if (!listingId) {
    return redirect('/inbox');
  }
  
  // Convert to string if it's an array
  const listingIdString = Array.isArray(listingId) ? listingId[0] : listingId;

  // Log the start of the process
  console.log('Starting new conversation process', { 
    listingId: listingIdString,
    userId: session.user.id 
  });

  try {
    // Get the listing
    console.log(`Fetching listing with ID: ${listingIdString}`);
    const listing = await prisma.listing.findUnique({
      where: { id: listingIdString },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
    
    console.log('Listing fetch result:', { 
      found: !!listing,
      listingId: listingIdString,
      title: listing?.title,
      sellerId: listing?.userId
    });

    if (!listing) {
      console.error(`Listing not found: ${listingId}`);
      return redirect('/inbox');
    }

    // Don't allow messaging yourself
    if (listing.userId === session.user.id) {
      console.error(`Cannot message yourself`);
      return redirect('/inbox');
    }

    // Determine buyer and seller IDs
    const buyerId = session.user.id;
    const sellerId = listing.userId;

    // Check if a conversation already exists
    console.log('Checking for existing conversation', { buyerId, sellerId });
    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          {
            buyerId: buyerId,
            sellerId: sellerId,
          },
          {
            buyerId: sellerId,
            sellerId: buyerId,
          },
        ],
      },
    });
    
    console.log('Existing conversation check result:', { 
      exists: !!conversation,
      conversationId: conversation?.id 
    });

    // If no existing conversation, create one
    if (!conversation) {
      console.log('Creating new conversation', { buyerId, sellerId });
      try {
        // Verify that both buyer and seller exist in the database
        const buyerExists = await prisma.user.findUnique({ where: { id: buyerId } });
        const sellerExists = await prisma.user.findUnique({ where: { id: sellerId } });
        
        console.log('User verification results:', { 
          buyerExists: !!buyerExists, 
          sellerExists: !!sellerExists 
        });
        
        if (!buyerExists || !sellerExists) {
          throw new Error(`User not found: ${!buyerExists ? 'buyer' : 'seller'}`);
        }
        
        // Create the conversation with explicit data validation
        // Now including the listingId to establish the relationship
        conversation = await prisma.conversation.create({
          data: {
            buyerId: buyerId,
            sellerId: sellerId,
            listingId: listing.id, // Include the listing ID to establish the relationship
          },
        });
        
        // Verify the conversation was created successfully
        if (!conversation || !conversation.id) {
          throw new Error('Conversation created but returned invalid data');
        }
        
        console.log('New conversation created successfully', { 
          conversationId: conversation.id,
          buyerId: conversation.buyerId,
          sellerId: conversation.sellerId
        });
      } catch (createError) {
        console.error('Error creating conversation in database:', createError);
        console.error('Create conversation error details:', {
          errorName: createError instanceof Error ? createError.name : 'Unknown',
          errorMessage: createError instanceof Error ? createError.message : String(createError),
          buyerId,
          sellerId
        });
        throw createError; // Re-throw to be caught by the outer catch block
      }

      // No initial message is created - the user will start the conversation themselves
    }

    // Verify that we have a valid conversation object before redirecting
    if (!conversation || !conversation.id) {
      console.error('Invalid conversation object before redirect', { conversation });
      return redirect('/inbox');
    }
    
    // Log the successful redirect
    console.log('Redirecting to inbox with conversation', { 
      conversationId: conversation.id 
    });
    
    // Redirect to the inbox with the conversation ID as a query parameter
    // This will allow the inbox page to automatically select the conversation
    // The NEXT_REDIRECT error is expected and normal behavior for Next.js redirects
    return redirect(`/inbox?conversationId=${conversation.id}`);
  } catch (error) {
    // Check if this is a NEXT_REDIRECT error, which is expected and not a real error
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error; // Let Next.js handle the redirect
    }
    
    // Log detailed error information to help with debugging
    console.error('Error in new conversation process:', error);
    console.error('Error details:', {
      listingId: listingIdString,
      userId: session.user.id,
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    // Add a toast or notification to the user
    console.error('Redirecting to inbox due to error');
    
    // Redirect to inbox in case of error
    return redirect('/inbox');
  }
}
