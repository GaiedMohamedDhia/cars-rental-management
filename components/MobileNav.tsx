"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import LogoutButton from "./LogoutButton";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <div className="bg-transparent p-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <img src="/logo.svg" alt="TuniCars+" className="h-10 w-auto object-contain" />
        </Link>
        <button onClick={() => setOpen(true)} aria-label="menu" className="p-2 rounded-md bg-[rgba(255,255,255,0.03)]">
          <Menu size={20} />
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute right-0 top-0 h-full w-64 bg-[var(--card)] p-4 shadow-2xl border-l border-[var(--border)]"
          >
            <div className="flex items-center justify-between mb-6">
              <img src="/logo.svg" alt="TuniCars+" className="h-9 w-auto object-contain" />
              <button onClick={() => setOpen(false)} className="p-2 rounded-md">
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-3">
              <Link href="/" className="px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)]">📊 Tableau de bord</Link>
              <Link href="/cars" className="px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)]">🚙 Voitures</Link>
              <Link href="/locataires" className="px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)]">👥 Locataires</Link>
              <Link href="/rentals" className="px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)]">📋 Locations</Link>
              <Link href="/maintenance" className="px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)]">🛠️ Maintenance</Link>
              <Link href="/paiement" className="px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)]">💳 Paiements</Link>
              <Link href="/profile" className="px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)]">👤 Mon Profil</Link>
            </nav>
            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <LogoutButton className="w-full text-left" />
            </div>
          </motion.aside>
        </motion.div>
      )}
    </div>
  );
}
