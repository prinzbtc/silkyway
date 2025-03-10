import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { MessageAttachment } from '@/types/chat';
import { deleteFile } from '@/lib/fileUtils';

/**
 * Deletes an attachment from a message
 * 
 * @param request Request with the attachment URL as a query parameter
 * @param params Contains the messageId
 * @returns Success status or an error response
 */
export async function DELETE(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  try {
    // Authenticate the user
    const session = await getSession();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return new NextResponse('Missing URL parameter', { status: 400 });
    }

    // Get the message and verify ownership
    const message = await prisma.message.findUnique({
      where: { id: params.messageId },
      select: { 
        id: true,
        senderId: true,
        attachments: true
      }
    });

    if (!message) {
      return new NextResponse('Message not found', { status: 404 });
    }

    if (message.senderId !== session.user.id) {
      return new NextResponse('Unauthorized - only the sender can delete attachments', { status: 403 });
    }

    // Process attachments as a JSON field
    const attachments = message.attachments as MessageAttachment[] | null;
    
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return new NextResponse('No attachments found', { status: 404 });
    }

    // Find the attachment to delete
    const attachmentIndex = attachments.findIndex(attachment => attachment.url === url);
    
    if (attachmentIndex === -1) {
      return new NextResponse('Attachment not found', { status: 404 });
    }

    // Get the attachment to delete
    const attachmentToDelete = attachments[attachmentIndex];
    
    // Remove the attachment from the array
    const updatedAttachments = [...attachments];
    updatedAttachments.splice(attachmentIndex, 1);

    // Update the message with the modified attachments array
    // Need to use Prisma.JsonValue to handle the JSON field correctly
    await prisma.message.update({
      where: { id: params.messageId },
      data: { 
        attachments: updatedAttachments as any // Type cast to any to handle the JSON field
      }
    });
    
    // Delete the file from the server
    try {
      await deleteFile(attachmentToDelete.url);
    } catch (error) {
      console.error('Error deleting file from server:', error);
      // Continue even if file deletion fails - the database has been updated
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return new NextResponse(`Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
