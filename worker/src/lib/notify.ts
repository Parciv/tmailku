// Notifikasi keluar saat email masuk: Telegram bot + Webhook.
import type { Env } from '../types'
import { getAllSettings, bool } from './settings'

export interface NotifyPayload {
	address: string
	from: string
	subject: string
	otp?: string | null
	receivedAt: number
}

function telegramUrl(token: string, method: string): string {
	return 'https://api.telegram.org/bot' + token + '/' + method
}

export async function dispatchNotifications(env: Env, p: NotifyPayload): Promise<void> {
	const s = await getAllSettings(env)
	const tasks: Promise<unknown>[] = []

	// Telegram
	const token = s['telegram_bot_token']
	const chatId = s['telegram_chat_id']
	if (token && chatId) {
		const lines = [
			'\u{1F4E8} <b>Email baru</b>',
			'Ke: <code>' + escapeHtml(p.address) + '</code>',
			'Dari: ' + escapeHtml(p.from),
			'Subjek: ' + escapeHtml(p.subject || '(tanpa subjek)'),
		]
		if (p.otp) lines.push('\u{1F511} Kode: <b>' + escapeHtml(p.otp) + '</b>')
		tasks.push(
			fetch(telegramUrl(token, 'sendMessage'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML' }),
			}).catch(() => {}),
		)
	}

	// Webhook
	if (bool(s['webhook_enabled']) && s['webhook_url']) {
		tasks.push(
			fetch(s['webhook_url'], {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ event: 'email.received', ...p }),
			}).catch(() => {}),
		)
	}

	await Promise.allSettled(tasks)
}

export async function sendTestNotification(env: Env): Promise<{ telegram: boolean; webhook: boolean }> {
	const s = await getAllSettings(env)
	const result = { telegram: false, webhook: false }

	if (s['telegram_bot_token'] && s['telegram_chat_id']) {
		const r = await fetch(telegramUrl(s['telegram_bot_token'], 'sendMessage'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ chat_id: s['telegram_chat_id'], text: '\u2705 TMailku: tes notifikasi berhasil.' }),
		}).catch(() => null)
		result.telegram = !!r && r.ok
	}

	if (bool(s['webhook_enabled']) && s['webhook_url']) {
		const r = await fetch(s['webhook_url'], {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ event: 'test', message: 'TMailku test webhook' }),
		}).catch(() => null)
		result.webhook = !!r && r.ok
	}
	return result
}

function escapeHtml(s: string): string {
	return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
