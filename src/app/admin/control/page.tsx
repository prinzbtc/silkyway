'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { AdmAdminCard } from '@/components/admin/AdmAdminCard';
import { User } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AdminUser extends User {
  adminRole: string;
  adminSince: Date;
  permissions: string[];
}

export default function AdminControlPage() {
  const { isAdmin, user } = useAdminAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('admin');
  const [stats, setStats] = useState({
    totalAdmins: 0,
    superAdmins: 0,
    admins: 0,
    moderators: 0,
  });

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/admin/control');
      if (!response.ok) throw new Error('Failed to fetch admins');
      const data = await response.json();
      setAdmins(data.admins);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdmins();
    }
  }, [isAdmin]);

  const handleAddAdmin = async () => {
    if (!newAdminAddress) {
      alert('Please enter a wallet address');
      return;
    }

    try {
      const response = await fetch('/api/admin/control/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: newAdminAddress,
          role: newAdminRole,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add admin');
      }

      setNewAdminAddress('');
      await fetchAdmins();
    } catch (error) {
      console.error('Error adding admin:', error);
      alert('Failed to add admin. Please try again.');
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/control/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove admin');
      }

      await fetchAdmins();
    } catch (error) {
      console.error('Error removing admin:', error);
      alert('Failed to remove admin. Please try again.');
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      const response = await fetch(`/api/admin/control/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      await fetchAdmins();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role. Please try again.');
    }
  };

  const handleUpdatePermissions = async (userId: string, permissions: string[]) => {
    try {
      const response = await fetch(`/api/admin/control/${userId}/permissions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions }),
      });

      if (!response.ok) {
        throw new Error('Failed to update permissions');
      }

      await fetchAdmins();
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('Failed to update permissions. Please try again.');
    }
  };

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
        <h1 className="text-3xl font-bold text-gray-900">Admin Control</h1>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Admins</p>
          <p className="text-2xl font-semibold">{stats.totalAdmins}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Super Admins</p>
          <p className="text-2xl font-semibold text-purple-600">
            {stats.superAdmins}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Admins</p>
          <p className="text-2xl font-semibold text-indigo-600">
            {stats.admins}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Moderators</p>
          <p className="text-2xl font-semibold text-blue-600">
            {stats.moderators}
          </p>
        </div>
      </div>

      {/* Add New Admin */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Add New Admin</h2>
        <div className="flex items-end space-x-4">
          <div className="flex-grow">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wallet Address
            </label>
            <Input
              type="text"
              value={newAdminAddress}
              onChange={(e) => setNewAdminAddress(e.target.value)}
              placeholder="Enter wallet address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={newAdminRole}
              onChange={(e) => setNewAdminRole(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>
          <Button onClick={handleAddAdmin}>Add Admin</Button>
        </div>
      </div>

      {/* Admin List */}
      <div className="grid gap-6">
        {admins.map((admin) => (
          <AdmAdminCard
            key={admin.id}
            admin={admin}
            onRemoveAdmin={handleRemoveAdmin}
            onUpdateRole={handleUpdateRole}
            onUpdatePermissions={handleUpdatePermissions}
            currentUserId={user?.id || ''}
          />
        ))}
      </div>

      {admins.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No admins found.</p>
        </div>
      )}
    </div>
  );
}
