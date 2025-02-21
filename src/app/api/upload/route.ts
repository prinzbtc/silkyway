import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'private', 'uploads', 'reports');

// Ensure upload directory exists
mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/pdf',
];

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new NextResponse('No file provided', { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return new NextResponse('Invalid file type', { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new NextResponse('File too large', { status: 400 });
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.${fileExtension}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Convert file to buffer and save it
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Return the private file path (will be served through a secure endpoint)
    const url = `/api/reports/files/${filename}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error uploading file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
