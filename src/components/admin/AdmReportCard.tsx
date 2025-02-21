'use client';

import { Report, User, Listing } from '@prisma/client';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';

interface AdmReportCardProps {
  report: Report & {
    reporter: User;
    listing?: Listing & {
      user: User;
    };
    reportedUser?: User;
  };
  onResolve: (reportId: string) => Promise<void>;
  onDismiss: (reportId: string) => Promise<void>;
}

export function AdmReportCard({
  report,
  onResolve,
  onDismiss,
}: AdmReportCardProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'dismissed':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'listing':
        return 'text-blue-600 bg-blue-50';
      case 'user':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatusColor(
                  report.status
                )}`}
              >
                {report.status}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${getReportTypeColor(
                  report.type
                )}`}
              >
                {report.type}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Reported {formatDistanceToNow(new Date(report.createdAt))} ago
            </p>
          </div>
          {report.status === 'pending' && (
            <div className="flex space-x-2">
              <Button
                onClick={() => onDismiss(report.id)}
                variant="outline"
                size="sm"
              >
                Dismiss
              </Button>
              <Button onClick={() => onResolve(report.id)} size="sm">
                Resolve
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="font-medium">Reason for Report</p>
          <p className="text-gray-600">{report.reason}</p>
          {report.description && (
            <p className="text-sm text-gray-500">{report.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Reported by</p>
            <p>{report.reporter.username || 'Anonymous'}</p>
            <p className="text-xs text-gray-500 truncate">
              {report.reporter.walletAddress}
            </p>
            <Link
              href={`/admin/users/${report.reporter.id}`}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              View Reporter
            </Link>
          </div>

          {report.type === 'LISTING' && report.listing && (
            <div>
              <p className="text-sm font-medium">Reported Listing</p>
              <p>{report.listing.title}</p>
              <p className="text-xs text-gray-500">
                by {report.listing.user.username || 'Anonymous'}
              </p>
              <div className="space-x-2">
                <Link
                  href={`/admin/listings/${report.listing.id}`}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  View Listing
                </Link>
                <Link
                  href={`/admin/users/${report.listing.user.id}`}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  View Seller
                </Link>
              </div>
            </div>
          )}

          {report.type === 'USER' && report.reportedUser && (
            <div>
              <p className="text-sm font-medium">Reported User</p>
              <p>{report.reportedUser.username || 'Anonymous'}</p>
              <p className="text-xs text-gray-500 truncate">
                {report.reportedUser.walletAddress}
              </p>
              <Link
                href={`/admin/users/${report.reportedUser.id}`}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                View User
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
