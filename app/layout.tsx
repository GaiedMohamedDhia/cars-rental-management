import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import Image from 'next/image'
import MobileNav from '../components/MobileNav';
import AuthGate from '../components/AuthGate';
import HideSidebarOnLogin from '../components/HideSidebarOnLogin';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Gestion de Location de Voitures',
  description: 'Gérez votre entreprise de location de voitures efficacement',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className} suppressHydrationWarning>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <aside id="app-sidebar" className="hidden lg:flex lg:flex-col lg:w-64 bg-[var(--card)] text-white border-r border-[var(--border)]">
            <div className="flex items-center justify-center h-24 border-b border-[var(--border)] bg-[var(--card)]">
              <Link href="/" className="flex items-center justify-center p-2">
                <Image src="/logo.png" alt="TuniCars+" width={200} height={80} className="object-contain" priority />
              </Link>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2">
              <NavLink href="/" icon="📊">Tableau de bord</NavLink>
              <NavLink href="/cars" icon="🚙">Voitures</NavLink>
              <NavLink href="/renters" icon="👥">Locataires</NavLink>
              <NavLink href="/rentals" icon="📋">Locations</NavLink>
              <NavLink href="/maintenance" icon="🛠️">Maintenance</NavLink>
            </nav>
            <div className="p-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted)]">  Gestion Location Auto</p>
            </div>
          </aside>

          <HideSidebarOnLogin />
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Mobile Navigation */}
            <div id="app-mobile-nav"><MobileNav /></div>

            <AuthGate>{children}</AuthGate>
          </div>
        </div>
      </body>
    </html>
  )
}

function NavLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition-colors"
    >
      <span className="text-xl">{icon}</span>
      <span>{children}</span>
    </Link>
  )
}
