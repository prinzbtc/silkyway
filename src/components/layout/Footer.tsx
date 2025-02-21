'use client';

import { FC, useEffect, useState } from 'react';
import Link from 'next/link';
import { Github, Twitter, MessageSquare } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';

export const Footer: FC = () => {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>> | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  return (
    <footer className="bg-white border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Silkyway</h3>
            <p className="text-gray-600 text-sm">
              The first web3 marketplace on Solana
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Resources
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/about"
                  className="text-gray-600 hover:text-primary transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-gray-600 hover:text-primary transition-colors"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  className="text-gray-600 hover:text-primary transition-colors"
                >
                  Documentation
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Connect
            </h3>
            <div className="flex space-x-4">
              <a
                href="https://github.com/silkyway"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-primary transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-6 h-6" />
              </a>
              <a
                href="https://x.com/silkyway"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-primary transition-colors"
                aria-label="X (formerly Twitter)"
              >
                <Twitter className="w-6 h-6" />
              </a>
              <a
                href="https://discord.gg/silkyway"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-primary transition-colors"
                aria-label="Discord"
              >
                <MessageSquare className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>

        {/* Admin Button */}
        {session?.user?.isAdmin && (
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href="/admin" target="_blank">
                Admin Dashboard
              </Link>
            </Button>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-gray-400 text-sm text-center">
            © {new Date().getFullYear()} Silkyway. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
