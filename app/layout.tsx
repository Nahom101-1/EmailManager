import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "LifeOS",
  description: "Your digital life, organized.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-cream">{children}</body>
    </html>
  )
}
