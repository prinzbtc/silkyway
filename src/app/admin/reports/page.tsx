'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { AdmReportCard } from '@/components/admin/AdmReportCard';
import { Report, User, Listing } from '@prisma/client';

type ReportWithDetails = Report & {
  reporter: User;
  listing?: Listing & {
    user: User;
  };
  reportedUser?: User;
};

export default function ReportControlPage() {
  const { isAdmin } = useAdminAuth();
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, resolved, dismissed
  const [typeFilter, setTypeFilter] = useState('all'); // all, listing, user
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    dismissed: 0,
    listingReports: 0,
    userReports: 0,
  });

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/admin/reports');
      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      setReports(data.reports);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchReports();
    }
  }, [isAdmin]);

  const handleResolve = async (reportId: string) => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to resolve report');
      }

      await fetchReports();
    } catch (error) {
      console.error('Error resolving report:', error);
      alert('Failed to resolve report. Please try again.');
    }
  };

  const handleDismiss = async (reportId: string) => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/dismiss`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss report');
      }

      await fetchReports();
    } catch (error) {
      console.error('Error dismissing report:', error);
      alert('Failed to dismiss report. Please try again.');
    }
  };

  const filteredReports = reports
    .filter((report) => {
      // Status filter
      const statusMatch = filter === 'all' || report.status.toLowerCase() === filter;

      // Type filter
      const typeMatch =
        typeFilter === 'all' || report.type.toLowerCase() === typeFilter;

      // Search filter
      const searchMatch = searchTerm
        ? report.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.reporter.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (report.listing?.title.toLowerCase().includes(searchTerm.toLowerCase()) ??
            false) ||
          (report.reportedUser?.username
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ??
            false)
        : true;

      return statusMatch && typeMatch && searchMatch;
    })
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  if (!isAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Report Control</h1>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Reports</p>
          <p className="text-2xl font-semibold">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-semibold text-yellow-600">
            {stats.pending}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Resolved</p>
          <p className="text-2xl font-semibold text-green-600">
            {stats.resolved}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Dismissed</p>
          <p className="text-2xl font-semibold text-gray-600">
            {stats.dismissed}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Listing Reports</p>
          <p className="text-2xl font-semibold text-blue-600">
            {stats.listingReports}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">User Reports</p>
          <p className="text-2xl font-semibold text-purple-600">
            {stats.userReports}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search reports..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Types</option>
          <option value="listing">Listings</option>
          <option value="user">Users</option>
        </select>
      </div>

      {/* Report List */}
      <div className="grid gap-6">
        {filteredReports.map((report) => (
          <AdmReportCard
            key={report.id}
            report={report}
            onResolve={handleResolve}
            onDismiss={handleDismiss}
          />
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No reports found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
