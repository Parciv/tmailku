/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	async rewrites() {
		const api = process.env.NEXT_PUBLIC_API_BASE
		if (!api) return []
		return []
	},
}

export default nextConfig
