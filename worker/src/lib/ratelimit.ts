import type { Env } from '../types'

// Rate limit sederhana berbasis KV (fixed window per menit).
export async function rateLimit(env: Env, bucket: string, limit: number): Promise<boolean> {
	const windowKey = `rl:${bucket}:${Math.floor(Date.now() / 60000)}`
	const current = Number((await env.KV.get(windowKey)) ?? '0')
	if (current >= limit) return false
	await env.KV.put(windowKey, String(current + 1), { expirationTtl: 120 })
	return true
}
