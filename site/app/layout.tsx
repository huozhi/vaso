import './globals.css'
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
      <body className={jetbrainsMono.className}>{children}</body>
    </html>
  )
}

export const metadata = {
  title: 'El Vaso',
  description: 'Glass Effect for React',
}
