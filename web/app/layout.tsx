import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
	title: 'TMailku — Temporary Mail',
	description: 'Email sementara instan, multi-domain, privat. Tanpa registrasi.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="id" data-theme="dark">
			<body>{children}</body>
		</html>
	)
}
