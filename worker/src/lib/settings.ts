import type { Env } from '../types'
import { now } from './util'

export type SettingsMap = Record<string, string>

export async function getAllSettings(env: Env): Promise<SettingsMap> {
	const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{
		key: string
		value: string
	}>()
	const map: SettingsMap = {}
	for (const r of results ?? []) map[r.key] = r.value ?? ''
	return map
}

export async function getSetting(env: Env, key: string): Promise<string | null> {
	const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>()
	return row?.value ?? null
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
	)
		.bind(key, value, now())
		.run()
}

export async function getGroup(env: Env, group: string) {
	const { results } = await env.DB.prepare(
		'SELECT key, value, type, label FROM settings WHERE "group" = ? ORDER BY rowid',
	)
		.bind(group)
		.all()
	return results ?? []
}

export function bool(v: string | null | undefined): boolean {
	return v === 'true' || v === '1'
}
