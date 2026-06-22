import type { Env } from '../types'
import { now } from './util'
import { addLog } from './log'

// Hapus alamat & email yang kedaluwarsa + object R2 terkait.
export async function cleanupExpired(env: Env): Promise<void> {
	const t = now()
	const { results: expired } = await env.DB.prepare(
		'SELECT id, address FROM addresses WHERE expires_at IS NOT NULL AND expires_at < ?',
	)
		.bind(t)
		.all<{ id: string; address: string }>()
	if (!expired || expired.length === 0) return

	for (const a of expired) {
		const { results: emails } = await env.DB.prepare('SELECT id, raw_r2_key FROM emails WHERE address_id = ?')
			.bind(a.id)
			.all<{ id: string; raw_r2_key: string | null }>()
		for (const em of emails ?? []) {
			const { results: atts } = await env.DB.prepare('SELECT r2_key FROM attachments WHERE email_id = ?')
				.bind(em.id)
				.all<{ r2_key: string }>()
			for (const at of atts ?? []) if (at.r2_key) await env.R2.delete(at.r2_key).catch(() => {})
			if (em.raw_r2_key) await env.R2.delete(em.raw_r2_key).catch(() => {})
			await env.DB.prepare('DELETE FROM attachments WHERE email_id = ?').bind(em.id).run()
		}
		await env.DB.prepare('DELETE FROM emails WHERE address_id = ?').bind(a.id).run()
		await env.DB.prepare('DELETE FROM addresses WHERE id = ?').bind(a.id).run()
	}
	await addLog(env, 'info', 'cron', 'cleanup: ' + expired.length + ' alamat kedaluwarsa dihapus')
}
