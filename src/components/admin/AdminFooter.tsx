'use client';

import Link from 'next/link';

export function AdminFooter() {
  return (
    <footer className="bg-white shadow-sm mt-8">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            To Main Site
          </Link>
        </div>
      </div>
    </footer>
  );
}
