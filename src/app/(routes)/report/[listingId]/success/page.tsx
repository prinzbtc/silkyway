'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

export default function ReportSuccessPage({
  params,
}: {
  params: { listingId: string };
}) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(`/listing/${params.listingId}`);
    }, 3000);

    return () => clearTimeout(timer);
  }, [router, params.listingId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Report Submitted Successfully
        </h1>
        <p className="text-gray-500">
          Thank you for helping keep Silkyway safe. We will review your report and take appropriate action.
        </p>
        <p className="text-sm text-gray-400 mt-4">
          Redirecting back to listing...
        </p>
      </div>
    </div>
  );
}
