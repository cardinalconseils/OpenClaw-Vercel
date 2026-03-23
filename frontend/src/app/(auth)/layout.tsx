export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4" aria-label="Authentication">
      {children}
    </main>
  )
}
