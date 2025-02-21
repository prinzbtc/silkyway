'use client';

import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import Link from 'next/link';

const adminPages = [
  {
    title: 'User Control',
    description: 'Manage user accounts and profiles',
    href: '/admin/users',
  },
  {
    title: 'Listing Control',
    description: 'Manage product listings',
    href: '/admin/listings',
  },
  {
    title: 'Transaction Control',
    description: 'Monitor and manage transactions',
    href: '/admin/transactions',
  },
  {
    title: 'Escrow Control',
    description: 'Manage escrow funds and operations',
    href: '/admin/escrow',
  },
  {
    title: 'Report Control',
    description: 'Review and handle user reports',
    href: '/admin/reports',
  },
  {
    title: 'Admin Control',
    description: 'Manage admin permissions and settings',
    href: '/admin/settings',
  },
];

export default function AdminDashboard() {
  const { isAdmin } = useAdminAuth();

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminPages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="block p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900">
              {page.title}
            </h2>
            <p className="mt-2 text-gray-600">{page.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
