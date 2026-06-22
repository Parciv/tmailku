import type { Env } from '../types'
import { uid, now } from './util'

export async function addLog(
	env: Env,
	level: 'info' | 'warn' | 'error',
	scope: string,
	message: string,
	meta?: Record<string, unknown>,
): Promise<void> {
	try {
		await env.DB.prepare(
			'INSERT INTO logs (id, level, scope, message, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
		)
			.bind(uid('log'), level, scope, message, meta ? JSON.stringify(meta) : null, now())
			.run()
	} catch {
		// jangan sampai logging menggagalkan request
	}
}
