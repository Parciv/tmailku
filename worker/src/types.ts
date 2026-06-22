export interface Env {
	DB: D1Database
	KV: KVNamespace
	R2: R2Bucket
	APP_URL: string
	WEB_ORIGIN: string
	JWT_SECRET: string
}

export interface AdminSession {
	sub: string // admin id
	email: string
	role: string
	exp: number
}

export interface ApiKeyRow {
	id: string
	name: string
	key_prefix: string
	key_hash: string
	scopes: string
	rate_limit: number
	enabled: number
	expires_at: number | null
}

export type Variables = {
	admin?: AdminSession
	apiKey?: ApiKeyRow
}
