import { WalletProvider } from '@/components/wallet/WalletProvider';
import { AdminAuthProvider } from '@/components/admin/AdminAuthProvider';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminFooter } from '@/components/admin/AdminFooter';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <AdminAuthProvider>
        <div className="min-h-screen flex flex-col">
          <AdminHeader />
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <AdminFooter />
        </div>
      </AdminAuthProvider>
    </WalletProvider>
  );
}
