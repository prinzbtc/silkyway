'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { Listing, User, Report } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import Link from 'next/link';

interface ListingDetails extends Listing {
  user: User;
  reports: (Report & { reporter: User })[];
  _count: {
    favorites: number;
    offers: number;
    reports: number;
  };
}

export default function ListingPage({
  params,
}: {
  params: { id: string };
}) {
  const { isAdmin } = useAdminAuth();
  const router = useRouter();
  const [listing, setListing] = useState<ListingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedListing, setEditedListing] = useState({
    title: '',
    description: '',
    price: 0,
    category: '',
    condition: '',
    status: '',
  });

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const response = await fetch(`/api/admin/listings/${params.id}`);
        if (!response.ok) throw new Error('Failed to fetch listing');
        const data = await response.json();
        setListing(data);
        setEditedListing({
          title: data.title,
          description: data.description,
          price: data.price,
          category: data.category,
          condition: data.condition,
          status: data.status,
        });
      } catch (error) {
        console.error('Error fetching listing:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) {
      fetchListing();
    }
  }, [isAdmin, params.id]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/admin/listings/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedListing),
      });

      if (!response.ok) throw new Error('Failed to update listing');

      const updatedListing = await response.json();
      setListing(updatedListing);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating listing:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/listings/${params.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete listing');

      router.push('/admin/listings');
    } catch (error) {
      console.error('Error deleting listing:', error);
    }
  };

  if (!isAdmin || !listing) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          Listing: {listing.title}
        </h1>
        <div className="space-x-4">
          {isEditing ? (
            <>
              <Button onClick={() => setIsEditing(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsEditing(true)} variant="outline">
                Edit Listing
              </Button>
              <Button onClick={handleDelete} variant="destructive">
                Delete Listing
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Images */}
          <div className="grid grid-cols-2 gap-4">
            {listing.images.map((image, index) => (
              <div key={index} className="relative aspect-square">
                <Image
                  src={image}
                  alt={`${listing.title} - Image ${index + 1}`}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            ))}
          </div>

          {/* Basic Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Title
                  </label>
                  <Input
                    value={editedListing.title}
                    onChange={(e) =>
                      setEditedListing({ ...editedListing, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <Textarea
                    value={editedListing.description}
                    onChange={(e) =>
                      setEditedListing({
                        ...editedListing,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Price
                  </label>
                  <Input
                    type="number"
                    value={editedListing.price}
                    onChange={(e) =>
                      setEditedListing({
                        ...editedListing,
                        price: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <Input
                      value={editedListing.category}
                      onChange={(e) =>
                        setEditedListing({
                          ...editedListing,
                          category: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Condition
                    </label>
                    <Input
                      value={editedListing.condition}
                      onChange={(e) =>
                        setEditedListing({
                          ...editedListing,
                          condition: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={editedListing.status}
                    onChange={(e) =>
                      setEditedListing({
                        ...editedListing,
                        status: e.target.value,
                      })
                    }
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="sold">Sold</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p>
                  <span className="font-medium">Price:</span> ${listing.price.toFixed(2)}
                </p>
                <p>
                  <span className="font-medium">Category:</span> {listing.category}
                </p>
                <p>
                  <span className="font-medium">Condition:</span>{' '}
                  {listing.condition}
                </p>
                <p>
                  <span className="font-medium">Status:</span> {listing.status}
                </p>
                <p>
                  <span className="font-medium">Listed:</span>{' '}
                  {new Date(listing.createdAt).toLocaleDateString()}
                </p>
                <p>
                  <span className="font-medium">Last Updated:</span>{' '}
                  {new Date(listing.updatedAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Seller Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Seller Information</h2>
            <div className="space-y-4">
              <p>
                <span className="font-medium">Username:</span>{' '}
                {listing.user.username || 'Anonymous'}
              </p>
              <p>
                <span className="font-medium">Wallet Address:</span>{' '}
                {listing.user.walletAddress}
              </p>
              <Link
                href={`/admin/users/${listing.user.id}`}
                className="text-indigo-600 hover:text-indigo-500"
              >
                View Seller Profile
              </Link>
            </div>
          </div>

          {/* Statistics */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Statistics</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-semibold">
                  {listing._count.favorites}
                </p>
                <p className="text-sm text-gray-500">Favorites</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">{listing._count.offers}</p>
                <p className="text-sm text-gray-500">Offers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-red-600">
                  {listing._count.reports}
                </p>
                <p className="text-sm text-gray-500">Reports</p>
              </div>
            </div>
          </div>

          {/* Reports */}
          {listing.reports.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4">Reports</h2>
              <div className="space-y-4">
                {listing.reports.map((report) => (
                  <div
                    key={report.id}
                    className="border-b border-gray-200 pb-4 last:border-0 last:pb-0"
                  >
                    <p className="font-medium">
                      Reported by: {report.reporter.username || 'Anonymous'}
                    </p>
                    <p className="text-gray-600 mt-1">{report.reason}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
