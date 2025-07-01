import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}

export const metadata = {
  title: 'El Vaso',
  description: 'Glass Effect for React',
}
