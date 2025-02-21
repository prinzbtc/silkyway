'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { SmallListingCard } from '@/components/listings/SmallListingCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/ui/file-upload';
import { ListingWithFavorite } from '@/types/listing';
import { useToast } from '@/components/ui/use-toast';

export default function ReportListingPage({
  params,
}: {
  params: { listingId: string };
}) {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [listing, setListing] = useState<ListingWithFavorite | null>(null);
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const response = await fetch(`/api/listings/${params.listingId}`);
        if (response.ok) {
          const data = await response.json();
          // Transform the data to include favorite information
          const listingWithFavorite = {
            ...data,
            isFavorite: data.isFavorite || false,
            favoritesCount: data._count?.favorites || 0,
            user: data.user || { id: '', username: '', walletAddress: '' },
          };
          setListing(listingWithFavorite);
        } else {
          router.push('/404');
        }
      } catch (error) {
        console.error('Error fetching listing:', error);
        router.push('/404');
      }
    };

    fetchListing();
  }, [params.listingId, router]);

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Connect your wallet to report a listing
        </h1>
        <p className="text-gray-500 mb-8 text-center">
          You need to be connected to report listings on Silkyway
        </p>
        <ConnectButton />
      </div>
    );
  }

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    const { url } = await response.json();
    return url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing || !reason.trim() || reason.length > 500 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Upload files first
      const attachments = [];
      let uploadedCount = 0;

      for (const file of files) {
        const url = await uploadFile(file);
        attachments.push({
          url,
          type: file.type,
          size: file.size,
        });
        uploadedCount++;
        setUploadProgress((uploadedCount / files.length) * 100);
      }

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: listing.id,
          reason: reason.trim(),
          reporterAddress: publicKey.toBase58(),
          attachments,
        }),
      });

      if (response.ok) {
        router.push(`/report/${listing.id}/success`);
      } else {
        throw new Error('Failed to submit report');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to submit report',
        description: 'Please try again later. If the problem persists, contact support.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const isReasonValid = reason.trim().length > 0 && reason.length <= 500;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Report Listing</h1>
          
          {/* Listing Card */}
          <div className="border rounded-lg p-4">
            <SmallListingCard listing={listing} />
          </div>

          {/* Report Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Reason for Report
              </label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please provide details about why you are reporting this listing..."
                className="min-h-[120px]"
              />
              <p className={`mt-1 text-sm ${
                reason.length > 500 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {reason.length}/500 characters
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label
                htmlFor="attachments"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Attachments (Optional)
              </label>
              <FileUpload
                files={files}
                onFilesSelected={(newFiles) => setFiles([...files, ...newFiles])}
                onFileRemoved={(index) => {
                  const newFiles = [...files];
                  newFiles.splice(index, 1);
                  setFiles(newFiles);
                }}
              />
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/listing/${listing.id}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isReasonValid || isSubmitting}
              >
                {isSubmitting
                  ? files.length > 0
                    ? `Uploading... ${Math.round(uploadProgress)}%`
                    : 'Submitting...'
                  : 'Submit Report'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
