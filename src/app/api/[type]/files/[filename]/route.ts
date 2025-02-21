import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getFilePath, getUploadConfig, type UploadType } from '@/lib/uploads';

export async function GET(
  request: Request,
  { params }: { params: { type: UploadType; filename: string } }
) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { type, filename } = params;
    const config = getUploadConfig(type);

    // Only serve private files through this endpoint
    if (!config.isPrivate) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Validate filename to prevent directory traversal
    const sanitizedFilename = filename.replace(/\.\./g, '');
    const filepath = getFilePath(sanitizedFilename, type);

    // Check if file exists
    try {
      await stat(filepath);
    } catch (error) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Check user's permission to access the file
    const userHasAccess = await checkFileAccess(type, filename, session.user.id);
    if (!userHasAccess) {
      return new NextResponse('Unauthorized', { status: 403 });
    }

    // Get file mime type from extension
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
    };

    // Create read stream
    const stream = createReadStream(filepath);

    // Return file stream
    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function checkFileAccess(
  type: UploadType,
  filename: string,
  userId: string
): Promise<boolean> {
  const fileUrl = `/api/${type}/files/${filename}`;

  switch (type) {
    case 'message': {
      // Check if user is either sender or receiver of the message
      const message = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
      });
      return !!message;
    }

    case 'report': {
      // Check if user is the reporter and has access to the file
      const report = await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM "Report"
          WHERE "reporterId" = ${userId}
          AND "attachments" IS NOT NULL
          AND "attachments"::jsonb @> jsonb_build_array(jsonb_build_object('url', ${fileUrl}))
        )
      `;
      
      return report[0].exists;
    }

    default:
      return false;
  }
}
