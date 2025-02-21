'use client';

import { User } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface AdmAdminCardProps {
  admin: User & {
    adminRole: string;
    adminSince: Date;
    permissions: string[];
  };
  onRemoveAdmin: (userId: string) => Promise<void>;
  onUpdateRole: (userId: string, role: string) => Promise<void>;
  onUpdatePermissions: (userId: string, permissions: string[]) => Promise<void>;
  currentUserId: string;
}

export function AdmAdminCard({
  admin,
  onRemoveAdmin,
  onUpdateRole,
  onUpdatePermissions,
  currentUserId,
}: AdmAdminCardProps) {
  const isCurrentUser = admin.id === currentUserId;

  const handleRemoveAdmin = async () => {
    if (!confirm('Are you sure you want to remove this admin?')) {
      return;
    }
    await onRemoveAdmin(admin.id);
  };

  const handleRoleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!confirm('Are you sure you want to change this admin\'s role?')) {
      return;
    }
    await onUpdateRole(admin.id, event.target.value);
  };

  const handlePermissionToggle = async (permission: string) => {
    const newPermissions = admin.permissions.includes(permission)
      ? admin.permissions.filter((p) => p !== permission)
      : [...admin.permissions, permission];
    
    await onUpdatePermissions(admin.id, newPermissions);
  };

  const availablePermissions = [
    'manage_users',
    'manage_listings',
    'manage_transactions',
    'manage_escrow',
    'manage_reports',
    'manage_admins',
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {admin.username || 'Anonymous'}
            </h3>
            <p className="text-sm text-gray-500">{admin.walletAddress}</p>
            <p className="text-sm text-gray-500">
              Admin since {formatDistanceToNow(new Date(admin.adminSince))} ago
            </p>
          </div>
          {!isCurrentUser && (
            <Button
              onClick={handleRemoveAdmin}
              variant="destructive"
              size="sm"
            >
              Remove Admin
            </Button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            value={admin.adminRole}
            onChange={handleRoleChange}
            disabled={isCurrentUser}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Permissions
          </label>
          <div className="grid grid-cols-2 gap-2">
            {availablePermissions.map((permission) => (
              <label
                key={permission}
                className="flex items-center space-x-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={admin.permissions.includes(permission)}
                  onChange={() => handlePermissionToggle(permission)}
                  disabled={isCurrentUser}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700">
                  {permission.split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h4>
          {/* Add recent activity log here when available */}
          <p className="text-sm text-gray-500">No recent activity</p>
        </div>
      </div>
    </div>
  );
}
