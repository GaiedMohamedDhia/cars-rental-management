"use client"

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function HideSidebarOnLogin() {
  const pathname = usePathname()

  useEffect(() => {
    const sidebar = document.getElementById('app-sidebar')
    const mobileNav = document.getElementById('app-mobile-nav')
    if (pathname === '/login') {
      if (sidebar) sidebar.style.display = 'none'
      if (mobileNav) mobileNav.style.display = 'none'
    } else {
      if (sidebar) sidebar.style.display = ''
      if (mobileNav) mobileNav.style.display = ''
    }
    return () => {
      if (sidebar) sidebar.style.display = ''
      if (mobileNav) mobileNav.style.display = ''
    }
  }, [pathname])

  return null
}
