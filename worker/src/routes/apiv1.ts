// API publik versi 1 (WAJIB Authorization: Bearer <API_KEY>).
import { Hono } from 'hono'
import type { Env, Variables } from '../types'
import { requireApiKey } from '../lib/auth'
import { keyHasScope } from '../lib/apikeys'
import { createAddress, listInbox } from './public'
import { getSetting, bool } from '../lib/settings'

export const apiV1Routes = new Hono<{ Bindings: Env; Variables: Variables }>()

// gate: API harus enabled
apiV1Routes.use('*', async (c, next) => {
	if (!bool(await getSetting(c.env, 'api_enabled'))) return c.json({ error: 'API disabled' }, 403)
	await next()
})

apiV1Routes.use('*', requireApiKey)

apiV1Routes.post('/address', async (c) => {
	const key = c.get('apiKey')!
	if (!keyHasScope(key, 'address:create')) return c.json({ error: 'scope kurang' }, 403)
	const body = await c.req.json().catch(() => ({}))
	const r = await createAddress(c.env, 'apikey:' + key.id, body)
	return c.json(r.json, r.status as any)
})

apiV1Routes.get('/inbox/:addr', async (c) => {
	const key = c.get('apiKey')!
	if (!keyHasScope(key, 'inbox:read')) return c.json({ error: 'scope kurang' }, 403)
	const rows = await listInbox(c.env, c.req.param('addr').toLowerCase())
	if (rows === null) return c.json({ error: 'not found' }, 404)
	return c.json({ emails: rows })
})

apiV1Routes.get('/email/:id', async (c) => {
	const key = c.get('apiKey')!
	if (!keyHasScope(key, 'inbox:read')) return c.json({ error: 'scope kurang' }, 403)
	const row = await c.env.DB.prepare('SELECT * FROM emails WHERE id = ?').bind(c.req.param('id')).first<any>()
	if (!row) return c.json({ error: 'not found' }, 404)
	return c.json(row)
})
