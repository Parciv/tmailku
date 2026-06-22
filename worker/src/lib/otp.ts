// Auto-detect kode OTP / verifikasi dari subject + body email.

const KEYWORDS = /(otp|kode|code|verif|verification|pin|password|security|login|masuk|sandi)/i

/**
 * Cari kode OTP. Strategi:
 * 1. Prioritaskan angka/alfanumerik 4-8 char yang dekat dengan kata kunci.
 * 2. Fallback: angka 4-8 digit pertama yang berdiri sendiri.
 */
export function detectOtp(subject = '', text = ''): string | null {
	const haystack = `${subject}\n${text}`.replace(/\u00a0/g, ' ')

	// kandidat token 4-8 char (huruf besar + angka), tidak menempel huruf lain
	const tokenRe = /\b([A-Z0-9]{4,8})\b/g
	const candidates: { value: string; index: number; digits: boolean }[] = []
	let m: RegExpExecArray | null
	while ((m = tokenRe.exec(haystack)) !== null) {
		const value = m[1]
		if (/^[0-9]+$/.test(value) && (value.length < 4 || value.length > 8)) continue
		if (/^[A-Z]+$/.test(value)) continue // semua huruf, kemungkinan kata biasa
		candidates.push({ value, index: m.index, digits: /^[0-9]+$/.test(value) })
	}
	if (candidates.length === 0) return null

	// skor berdasarkan kedekatan dengan keyword
	const kw: number[] = []
	let k: RegExpExecArray | null
	const kwRe = new RegExp(KEYWORDS.source, 'gi')
	while ((k = kwRe.exec(haystack)) !== null) kw.push(k.index)

	function score(c: { index: number; digits: boolean }): number {
		let best = Infinity
		for (const i of kw) best = Math.min(best, Math.abs(i - c.index))
		return best
	}

	candidates.sort((a, b) => score(a) - score(b))
	const top = candidates[0]
	// hanya percaya kalau ada keyword cukup dekat, atau token jelas-jelas kode
	if (kw.length > 0 && score(top) <= 60) return top.value
	const pureDigit = candidates.find((c) => c.digits && c.value.length >= 4 && c.value.length <= 8)
	return pureDigit ? pureDigit.value : null
}
