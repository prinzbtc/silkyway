import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';

const UPLOAD_DIR = path.join(process.cwd(), 'private', 'uploads', 'reports');

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate filename to prevent directory traversal
    const filename = params.filename.replace(/\.\./g, '');
    const filepath = path.join(UPLOAD_DIR, filename);

    // Check if file exists
    try {
      await stat(filepath);
    } catch (error) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Find the report associated with this file
    const report = await prisma.report.findFirst({
      where: {
        attachments: {
          path: ['$[*].url'],
          array_contains: `/api/reports/files/${filename}`,
        },
      },
      include: {
        reporter: true,
      },
    });

    if (!report) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Check if user has access to this file
    // Only allow access to:
    // 1. The reporter
    // 2. Admins (you can add admin check here)
    if (report.reporter.walletAddress !== session.user.walletAddress) {
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
