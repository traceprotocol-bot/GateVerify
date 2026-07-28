import { DM_Sans, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler'
import Script from 'next/script'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })
const jakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata = {
  metadataBase: new URL('https://last-trace.net'),
  title: 'GateVerify | Live Mathematical Gate Verification — Last Trace Protocol™ V7',
  description: 'Live browser demo of deterministic SHA-256 physical gate verification. MATCH or MISMATCH in under 100ms. Zero data retention. Zero PII. Part of Last Trace Protocol™ V7.',
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large' as const,
  },
  alternates: {
    canonical: 'https://last-trace.net/gateverify',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    title: 'GateVerify | Live Mathematical Gate Verification — LTP™ V7',
    description: 'Test the deterministic mathematical lock that stops document fraud at the physical gate. Zero data retention. MATCH or MISMATCH.',
    url: 'https://last-trace.net/gateverify',
    siteName: 'Last Trace Protocol™ V7',
    images: [
      {
        url: 'https://last-trace.net/gateverify/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GateVerify | Live Mathematical Gate Verification',
    description: 'Deterministic SHA-256 verification at the physical gate. Zero storage. Binary MATCH/MISMATCH.',
    images: ['https://last-trace.net/gateverify/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
      </head>
      <body className={`${dmSans.variable} ${jakartaSans.variable} ${jetbrainsMono.variable} font-sans`}>
        <Script
          src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js"
          strategy="beforeInteractive"
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <ChunkLoadErrorHandler />
        </ThemeProvider>
        <Script id="register-sw" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js').catch(function() {});
          }
        `}</Script>
      </body>
    </html>
  )
}
