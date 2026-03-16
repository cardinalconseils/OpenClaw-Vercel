'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  BarChart3,
  Settings,
  Menu,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface User {
  email: string
  avatarUrl?: string
}

interface DashboardShellProps {
  children: React.ReactNode
  user: User
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/missions', label: 'Missions', icon: Target },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function NavLinks({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavClick}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-normal transition-colors hover:bg-muted/50',
              isActive
                ? 'border-l-2 border-primary bg-primary/10 pl-[10px] text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarContent({
  user,
  onSignOut,
  onNavClick,
}: {
  user: User
  onSignOut: () => void
  onNavClick?: () => void
}) {
  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : '??'

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <span className="font-bold text-foreground">Murphy</span>
      </div>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto py-4">
        <NavLinks onNavClick={onNavClick} />
      </div>

      {/* User section at bottom */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.email} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {user.email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={onSignOut}
        >
          Sign Out
        </Button>
      </div>
    </div>
  )
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const handleSignOut = React.useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }, [router])

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar — persistent at lg+ */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border">
        <SidebarContent user={user} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-16 items-center border-b border-border px-4 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open navigation menu"
                />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64" showCloseButton={false}>
              <SidebarContent
                user={user}
                onSignOut={handleSignOut}
                onNavClick={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <span className="ml-3 font-bold text-foreground">Murphy</span>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
