// Endpoint branding publik (dipakai frontend, di-cache di KV).
import { Hono } from 'hono'
import type { Env, Variables } from '../types'
import { getGroup, getSetting } from '../lib/settings'

export const brandingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

brandingRoutes.get('/', async (c) => {
	const rows = await getGroup(c.env, 'branding')
	const out: Record<string, string> = {}
	for (const r of rows as any[]) out[r.key] = r.value ?? ''
	const locked = (await getSetting(c.env, 'site_locked')) === 'true'
	return c.json({
		appName: out['app_name'] || 'TMailku',
		logoUrl: out['logo_url'] || '',
		faviconUrl: out['favicon_url'] || '',
		heroTitle: out['hero_title'] || '',
		heroSubtitle: out['hero_subtitle'] || '',
		defaultTheme: out['default_theme'] || 'dark',
		defaultLang: out['default_lang'] || 'id',
		siteLocked: locked,
	})
})
