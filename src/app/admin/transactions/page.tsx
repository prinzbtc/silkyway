'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { AdmTransactionCard } from '@/components/admin/AdmTransactionCard';
import { Transaction, User, Listing } from '@prisma/client';
import { Button } from '@/components/ui/button';

type TransactionWithDetails = Transaction & {
  buyer: User;
  seller: User;
  listing: Listing;
  escrow?: {
    id: string;
    status: string;
    createdAt: Date;
  };
};

export default function TransactionControlPage() {
  const { isAdmin } = useAdminAuth();
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, completed, pending, cancelled
  const [sort, setSort] = useState('newest'); // newest, oldest, amount-high, amount-low
  const [dateRange, setDateRange] = useState('all'); // all, today, week, month
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    totalAmount: 0,
    totalFees: 0,
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/admin/transactions');
        if (!response.ok) throw new Error('Failed to fetch transactions');
        const data = await response.json();
        setTransactions(data.transactions);
        setStats(data.stats);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) {
      fetchTransactions();
    }
  }, [isAdmin]);

  const getDateFilter = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (dateRange) {
      case 'today':
        return date >= today;
      case 'week':
        return date >= weekAgo;
      case 'month':
        return date >= monthAgo;
      default:
        return true;
    }
  };

  const filteredTransactions = transactions
    .filter((transaction) => {
      // Search filter
      const searchMatch =
        transaction.listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.buyer.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.seller.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.buyer.walletAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.seller.walletAddress.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const statusMatch = filter === 'all' || transaction.status.toLowerCase() === filter;

      // Date filter
      const dateMatch = getDateFilter(new Date(transaction.createdAt));

      return searchMatch && statusMatch && dateMatch;
    })
    .sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'amount-high':
          return b.amount - a.amount;
        case 'amount-low':
          return a.amount - b.amount;
        default: // newest
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

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
        <h1 className="text-3xl font-bold text-gray-900">Transaction Control</h1>
        <Button onClick={() => window.print()} variant="outline">
          Export Report
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Transactions</p>
          <p className="text-2xl font-semibold">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-2xl font-semibold text-green-600">
            ${stats.totalAmount.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Fees</p>
          <p className="text-2xl font-semibold text-blue-600">
            ${stats.totalFees.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Success Rate</p>
          <p className="text-2xl font-semibold">
            {((stats.completed / stats.total) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search transactions..."
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
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="amount-high">Amount: High to Low</option>
          <option value="amount-low">Amount: Low to High</option>
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Transaction List */}
      <div className="grid gap-6">
        {filteredTransactions.map((transaction) => (
          <AdmTransactionCard key={transaction.id} transaction={transaction} />
        ))}
      </div>

      {filteredTransactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No transactions found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
