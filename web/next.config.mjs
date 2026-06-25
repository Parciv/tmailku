/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	output: "export",
	images: {
		unoptimized: true,
	},
	async rewrites() {
		const api = process.env.NEXT_PUBLIC_API_BASE
		if (!api) return []
		return []
	},
}

export default nextConfig
