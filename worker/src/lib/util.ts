// Util umum: id, waktu, hashing, JWT (HMAC-SHA256), password (PBKDF2)

const enc = new TextEncoder()

export function uid(prefix = ''): string {
	return (prefix ? prefix + '_' : '') + crypto.randomUUID().replace(/-/g, '')
}

export function now(): number {
	return Date.now()
}

export function b64url(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
	let s = ''
	for (const b of bytes) s += String.fromCharCode(b)
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(str: string): Uint8Array {
	const s = str.replace(/-/g, '+').replace(/_/g, '/')
	const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
	const bin = atob(s + pad)
	const out = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
	return out
}

export async function sha256hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', enc.encode(input))
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---- Password hashing (PBKDF2) ----
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16))
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
		key,
		256,
	)
	return `pbkdf2$100000$${b64url(salt)}$${b64url(bits)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	try {
		const [scheme, iterStr, saltStr, hashStr] = stored.split('$')
		if (scheme !== 'pbkdf2') return false
		const salt = fromB64url(saltStr)
		const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
		const bits = await crypto.subtle.deriveBits(
			{ name: 'PBKDF2', salt, iterations: Number(iterStr), hash: 'SHA-256' },
			key,
			256,
		)
		return b64url(bits) === hashStr
	} catch {
		return false
	}
}

// ---- JWT (HS256) ----
async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify',
	])
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
	const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
	const body = b64url(enc.encode(JSON.stringify(payload)))
	const data = `${header}.${body}`
	const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data))
	return `${data}.${b64url(sig)}`
}

export async function verifyJwt<T = any>(token: string, secret: string): Promise<T | null> {
	try {
		const [header, body, sig] = token.split('.')
		if (!header || !body || !sig) return null
		const ok = await crypto.subtle.verify(
			'HMAC',
			await hmacKey(secret),
			fromB64url(sig),
			enc.encode(`${header}.${body}`),
		)
		if (!ok) return null
		const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)))
		if (payload.exp && Date.now() / 1000 > payload.exp) return null
		return payload as T
	} catch {
		return null
	}
}

// ---- Random address generator ----
const WORDS = [
	'falcon', 'maple', 'nova', 'pixel', 'echo', 'lunar', 'comet', 'delta', 'amber', 'orbit',
	'zephyr', 'quartz', 'raven', 'cobalt', 'ember', 'frost', 'glide', 'helix', 'iris', 'jade',
]

export function randomLocalPart(format = 'word+num'): string {
	const num = Math.floor(1000 + Math.random() * 9000)
	const word = WORDS[Math.floor(Math.random() * WORDS.length)]
	switch (format) {
		case 'word':
			return `${word}${num}`
		case 'random':
			return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
		case 'word+num':
		default:
			return `${word}.${num}`
	}
}
