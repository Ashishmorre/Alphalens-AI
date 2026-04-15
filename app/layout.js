import './globals.css'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'AlphaLens AI — Institutional-Grade Stock Analysis',
  description: 'AI-powered stock analysis platform with DCF valuation, investment thesis generation, risk analysis, and sentiment scoring. Built for serious investors.',
  keywords: 'stock analysis, AI, DCF valuation, investment thesis, hedge fund, equity research',
  openGraph: {
    title: 'AlphaLens AI',
    description: 'AI-powered institutional-grade stock analysis',
    type: 'website',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07090d',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-grid scanlines">
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </body>
      <Analytics />
    </html>
  )
}
