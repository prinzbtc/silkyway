import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  validateFile,
  saveFile,
  getUploadConfig,
  type UploadType,
} from '@/lib/uploads';

export async function POST(
  request: Request,
  { params }: { params: { type: UploadType } }
) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const type = params.type as UploadType;
    const config = getUploadConfig(type);

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    // Validate number of files
    if (config.maxFiles && files.length > config.maxFiles) {
      return new NextResponse(
        `Too many files. Maximum allowed: ${config.maxFiles}`,
        { status: 400 }
      );
    }

    // Validate each file
    for (const file of files) {
      await validateFile(file, type);
    }

    // Save all files
    const savedFiles = await Promise.all(
      files.map(async (file) => {
        const { url } = await saveFile(file, type);
        return {
          url,
          type: file.type,
          size: file.size,
          name: file.name,
        };
      })
    );

    return NextResponse.json({ files: savedFiles });
  } catch (error) {
    console.error('Error uploading files:', error);
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 400 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
