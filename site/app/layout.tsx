import './globals.css'
import { GlassProvider } from '../contexts/glass-context'
import { JetBrains_Mono } from 'next/font/google'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className={jetbrainsMono.className}>
        <GlassProvider>{children}</GlassProvider>
      </body>
    </html>
  )
}

export const metadata = {
  title: 'Vaso',
  description: 'Glass Effect for React',
}
