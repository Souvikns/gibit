import '../globals.css'
export const metadata = {
  title: 'Gibit',
  description: 'Find issues in any GitHub Organisation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="lofi">
      <body>{children}</body>
    </html>
  )
}
