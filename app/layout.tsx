import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider, themeNoFlashScript } from "@/components/theme/ThemeProvider"

export const metadata: Metadata = {
  title: "LifeOS",
  description: "Map your digital life from your inbox.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" data-style="flat" data-accent="green" data-density="cozy" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
