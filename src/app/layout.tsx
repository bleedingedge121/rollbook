import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Roll Book — Attendance & Planning',
  description: 'Verified actual attendance tracker with honest planning and SLCM sync.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0f17] text-slate-100 min-h-screen antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  )
}
