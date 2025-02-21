import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { WalletContextProvider } from '@/context/WalletContextProvider'
import { CurrencyPreferenceProvider } from '@/context/CurrencyPreferenceProvider'
import { BadgeProvider } from '@/providers/BadgeProvider'
import { SessionProvider } from '@/providers/SessionProvider'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Silkyway - The first web3 marketplace on Solana',
  description: 'Buy and sell with confidence using cryptocurrency on Solana. Join the future of P2P commerce.',
  keywords: ['solana', 'marketplace', 'web3', 'cryptocurrency', 'p2p', 'ecommerce'],
  openGraph: {
    title: 'Silkyway - The first web3 marketplace on Solana',
    description: 'Buy and sell with confidence using cryptocurrency on Solana. Join the future of P2P commerce.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Silkyway',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Silkyway - The first web3 marketplace on Solana',
    description: 'Buy and sell with confidence using cryptocurrency on Solana. Join the future of P2P commerce.',
    creator: '@silkyway',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <WalletContextProvider>
            <CurrencyPreferenceProvider>
              <BadgeProvider>
                <Header />
                <main className="min-h-screen">
                  {children}
                </main>
                <Footer />
              </BadgeProvider>
            </CurrencyPreferenceProvider>
          </WalletContextProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
