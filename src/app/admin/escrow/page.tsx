'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { AdmEscrowCard } from '@/components/admin/AdmEscrowCard';
import { Transaction, User } from '@prisma/client';
import { Escrow } from '@/types/escrow';
import { Button } from '@/components/ui/button';

type EscrowWithDetails = Escrow & {
  transaction: Transaction & {
    buyer: User;
    seller: User;
  };
};

export default function EscrowControlPage() {
  const { isAdmin } = useAdminAuth();
  const [escrows, setEscrows] = useState<EscrowWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEscrows: 0,
    totalAmount: 0,
    pendingEscrows: 0,
    pendingAmount: 0,
  });
  const [filter, setFilter] = useState('all'); // all, pending, completed, cancelled
  const [isWithdrawingAll, setIsWithdrawingAll] = useState(false);

  const fetchEscrows = async () => {
    try {
      const response = await fetch('/api/admin/escrow');
      if (!response.ok) throw new Error('Failed to fetch escrows');
      const data = await response.json();
      setEscrows(data.escrows);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching escrows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchEscrows();
    }
  }, [isAdmin]);

  const handleWithdrawAll = async () => {
    if (!confirm('Are you sure you want to withdraw all funds to the treasury?')) {
      return;
    }

    setIsWithdrawingAll(true);
    try {
      const response = await fetch('/api/admin/escrow/withdraw-all', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to withdraw funds');
      }

      // Refresh the escrow list
      await fetchEscrows();
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      alert('Failed to withdraw funds. Please try again.');
    } finally {
      setIsWithdrawingAll(false);
    }
  };

  const handleReturnToBuyer = async (escrowId: string) => {
    try {
      const response = await fetch(`/api/admin/escrow/${escrowId}/return`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to return funds');
      }

      // Refresh the escrow list
      await fetchEscrows();
    } catch (error) {
      console.error('Error returning funds:', error);
      alert('Failed to return funds. Please try again.');
    }
  };

  const handleReleaseToSeller = async (escrowId: string) => {
    try {
      const response = await fetch(`/api/admin/escrow/${escrowId}/release`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to release funds');
      }

      // Refresh the escrow list
      await fetchEscrows();
    } catch (error) {
      console.error('Error releasing funds:', error);
      alert('Failed to release funds. Please try again.');
    }
  };

  const filteredEscrows = escrows.filter((escrow) => {
    return filter === 'all' || escrow.status === filter;
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
        <h1 className="text-3xl font-bold text-gray-900">Escrow Control</h1>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Escrows</p>
          <p className="text-2xl font-semibold">{stats.totalEscrows}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-2xl font-semibold text-green-600">
            ${stats.totalAmount.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending Escrows</p>
          <p className="text-2xl font-semibold text-yellow-600">
            {stats.pendingEscrows}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending Amount</p>
          <p className="text-2xl font-semibold text-yellow-600">
            ${stats.pendingAmount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <Button
          onClick={handleWithdrawAll}
          disabled={isWithdrawingAll || stats.pendingAmount === 0}
          className="bg-green-600 hover:bg-green-700"
        >
          {isWithdrawingAll ? 'Withdrawing...' : 'Withdraw All to Treasury'}
        </Button>
      </div>

      {/* Escrow List */}
      <div className="grid gap-6">
        {filteredEscrows.map((escrow) => (
          <AdmEscrowCard
            key={escrow.id}
            escrow={escrow}
            onReturnToBuyer={handleReturnToBuyer}
            onReleaseToSeller={handleReleaseToSeller}
          />
        ))}
      </div>

      {filteredEscrows.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No escrows found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
