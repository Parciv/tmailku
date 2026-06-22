import type { Env, ApiKeyRow } from '../types'
import { uid, sha256hex, now } from './util'

export interface CreatedKey {
	id: string
	plaintext: string
	key_prefix: string
}

// Buat API key baru. Plaintext hanya dikembalikan sekali.
export async function createApiKey(
	env: Env,
	opts: { name: string; scopes: string[]; rate_limit?: number; expires_at?: number | null },
): Promise<CreatedKey> {
	const id = uid('key')
	const raw = `tmk_${uid()}`
	const key_prefix = raw.slice(0, 11)
	const key_hash = await sha256hex(raw)
	await env.DB.prepare(
		`INSERT INTO api_keys (id, name, key_prefix, key_hash, scopes, rate_limit, enabled, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
	)
		.bind(
			id,
			opts.name,
			key_prefix,
			key_hash,
			JSON.stringify(opts.scopes ?? []),
			opts.rate_limit ?? 60,
			opts.expires_at ?? null,
			now(),
		)
		.run()
	return { id, plaintext: raw, key_prefix }
}

// Validasi key dari header Authorization: Bearer <key>
export async function validateApiKey(env: Env, raw: string): Promise<ApiKeyRow | null> {
	const key_hash = await sha256hex(raw)
	const row = await env.DB.prepare(
		'SELECT * FROM api_keys WHERE key_hash = ? AND enabled = 1',
	)
		.bind(key_hash)
		.first<ApiKeyRow & { expires_at: number | null }>()
	if (!row) return null
	if (row.expires_at && now() > row.expires_at) return null
	await env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').bind(now(), row.id).run()
	return row
}

export function keyHasScope(row: ApiKeyRow, scope: string): boolean {
	try {
		const scopes: string[] = JSON.parse(row.scopes || '[]')
		return scopes.length === 0 || scopes.includes(scope) || scopes.includes('*')
	} catch {
		return false
	}
}
