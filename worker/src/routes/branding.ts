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
		colors: {
			primary: out['color_primary'] || '#6366f1',
			secondary: out['color_secondary'] || '#22c55e',
			tertiary: out['color_tertiary'] || '#f59e0b',
		},
		defaultTheme: out['default_theme'] || 'dark',
		defaultLang: out['default_lang'] || 'id',
		siteLocked: locked,
	})
})
