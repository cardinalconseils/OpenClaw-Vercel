'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MenuIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-sans font-bold text-xl text-foreground hover:text-primary transition-colors"
        >
          Murphy
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/login"
            className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          >
            Sign In
          </Link>
        </div>

        {/* Mobile nav trigger */}
        <div className="md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
              <MenuIcon className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background">
              <SheetHeader>
                <SheetTitle className="text-left font-sans font-bold text-foreground">
                  Murphy
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pt-4">
                <Link
                  href="/login"
                  className="text-sm text-primary hover:text-primary/80 transition-colors font-medium py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
