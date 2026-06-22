// Loop semua akun IMAP aktif, fetch email baru, parse, simpan.
import PostalMime from 'postal-mime'
import type { Env } from '../types'
import { ImapClient, type ImapConfig } from './client'
import { storeEmail, type ParsedEmail } from '../lib/storage'
import { addLog } from '../lib/log'
import { now } from '../lib/util'

export async function pollAllImap(env: Env): Promise<void> {
	const { results } = await env.DB.prepare('SELECT * FROM imap_accounts WHERE enabled = 1').all<any>()
	for (const acc of results ?? []) {
		await pollAccount(env, acc).catch(async (e) => {
			await env.DB.prepare('UPDATE imap_accounts SET last_error = ?, last_sync_at = ? WHERE id = ?')
				.bind(String(e?.message || e), now(), acc.id)
				.run()
			await addLog(env, 'error', 'imap', 'sync gagal ' + (acc.label || acc.username) + ': ' + (e?.message || e))
		})
	}
}

export async function pollAccount(env: Env, acc: any): Promise<number> {
	const cfg: ImapConfig = {
		hostname: acc.hostname,
		port: acc.port,
		encryption: acc.encryption,
		username: acc.username,
		password: acc.password,
		folder: acc.folder || 'INBOX',
	}
	const client = new ImapClient(cfg)
	let count = 0
	await client.connect()
	try {
		await client.login()
		await client.selectFolder()
		const uids = await client.searchSince(acc.last_uid || 0)
		let maxUid = acc.last_uid || 0
		for (const uid of uids.slice(0, 25)) {
			const raw = await client.fetchMessage(uid)
			if (raw) {
				const parsed = await parseRaw(raw)
				if (parsed) {
					await storeEmail(env, 'imap', parsed)
					count++
				}
			}
			if (uid > maxUid) maxUid = uid
		}
		await env.DB.prepare(
			'UPDATE imap_accounts SET last_uid = ?, last_sync_at = ?, last_error = NULL WHERE id = ?',
		)
			.bind(maxUid, now(), acc.id)
			.run()
		if (count > 0) await addLog(env, 'info', 'imap', 'sync ' + (acc.label || acc.username) + ': ' + count + ' email baru')
	} finally {
		await client.logout()
	}
	return count
}

async function parseRaw(raw: Uint8Array): Promise<ParsedEmail | null> {
	try {
		const email = await PostalMime.parse(raw)
		const to = email.to?.[0]?.address || ''
		if (!to) return null
		return {
			messageId: email.messageId,
			fromAddr: email.from?.address,
			fromName: email.from?.name,
			toAddr: to,
			subject: email.subject,
			text: email.text,
			html: email.html || undefined,
			attachments: (email.attachments || []).map((a: any) => ({
				filename: a.filename,
				mimeType: a.mimeType,
				content: a.content,
			})),
			raw,
		}
	} catch {
		return null
	}
}
