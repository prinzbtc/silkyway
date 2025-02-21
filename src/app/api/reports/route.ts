import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listingId, reason, attachments } = await req.json();

    // Create report with type 'listing' since it has listingId
    const report = await prisma.report.create({
      data: {
        type: 'listing',
        listingId,
        reason,
        reporterId: session.user.id,
        attachments: attachments || null,
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}
