// First-run setup wizard: buat admin pertama kalau DB masih kosong.
import { Hono } from 'hono'
import type { Env, Variables } from '../types'
import { uid, now, hashPassword } from '../lib/util'
import { getSetting, setSetting } from '../lib/settings'
import { addLog } from '../lib/log'

export const setupRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

async function isSetupDone(env: Env): Promise<boolean> {
	const flag = await getSetting(env, 'setup_completed')
	if (flag === 'true') return true
	const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM admins').first<{ n: number }>()
	return (row?.n ?? 0) > 0
}

setupRoutes.get('/status', async (c) => {
	return c.json({ setupCompleted: await isSetupDone(c.env) })
})

setupRoutes.post('/', async (c) => {
	if (await isSetupDone(c.env)) return c.json({ error: 'setup already completed' }, 409)
	const body = await c.req.json<{ email?: string; password?: string; name?: string }>().catch(() => ({}))
	const email = (body.email || '').trim().toLowerCase()
	const password = body.password || ''
	if (!email || !email.includes('@')) return c.json({ error: 'email tidak valid' }, 400)
	if (password.length < 8) return c.json({ error: 'password minimal 8 karakter' }, 400)

	const id = uid('adm')
	await c.env.DB.prepare(
		`INSERT INTO admins (id, email, password_hash, name, role, must_change_password, created_at)
		 VALUES (?, ?, ?, ?, 'owner', 0, ?)`,
	)
		.bind(id, email, await hashPassword(password), body.name || 'Admin', now())
		.run()
	await setSetting(c.env, 'setup_completed', 'true')
	await addLog(c.env, 'info', 'setup', 'admin pertama dibuat: ' + email)
	return c.json({ ok: true })
})
