import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  try {
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
      select: { senderId: true, attachments: true }
    });

    if (!message) {
      return new NextResponse('Message not found', { status: 404 });
    }

    if (message.senderId !== session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Remove the attachment from the attachments array
    const attachments = message.attachments as { url: string; type: string; size: number; }[] | null;
    if (!attachments) {
      return new NextResponse('No attachments found', { status: 404 });
    }

    const updatedAttachments = attachments.filter(attachment => attachment.url !== url);

    // Update the message
    await prisma.message.update({
      where: { id: params.messageId },
      data: { attachments: updatedAttachments }
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
