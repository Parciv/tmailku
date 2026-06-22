// Middleware auth admin (session JWT via cookie atau Bearer) + API key.
import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Env, Variables, AdminSession } from '../types'
import { verifyJwt } from './util'
import { validateApiKey } from './apikeys'

type Ctx = Context<{ Bindings: Env; Variables: Variables }>

export async function requireAdmin(c: Ctx, next: Next) {
	const bearer = c.req.header('authorization')?.replace(/^Bearer\s+/i, '')
	const token = getCookie(c, 'tmk_session') || bearer
	if (!token) return c.json({ error: 'unauthorized' }, 401)
	const session = await verifyJwt<AdminSession>(token, c.env.JWT_SECRET)
	if (!session) return c.json({ error: 'unauthorized' }, 401)
	c.set('admin', session)
	await next()
}

export async function requireApiKey(c: Ctx, next: Next) {
	const raw = c.req.header('authorization')?.replace(/^Bearer\s+/i, '')
	if (!raw) return c.json({ error: 'missing API key' }, 401)
	const key = await validateApiKey(c.env, raw)
	if (!key) return c.json({ error: 'invalid API key' }, 401)
	c.set('apiKey', key)
	await next()
}
