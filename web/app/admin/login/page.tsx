'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { api } from '@/lib/api'

export default function LoginPage() {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [show, setShow] = useState(false)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		api.setupStatus().then((s) => {
			if (!s.setupCompleted) router.replace('/setup')
		})
	}, [router])

	async function submit(e: React.FormEvent) {
		e.preventDefault()
		setError('')
		setLoading(true)
		try {
			const r = await api.login(email, password)
			localStorage.setItem('tmailku.token', r.token)
			router.replace('/admin')
		} catch (e: any) {
			setError(e.message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<main className="min-h-screen flex items-center justify-center p-4">
			<form onSubmit={submit} className="glass p-6 w-full max-w-md space-y-4">
				<div className="text-center"><LogIn className="mx-auto text-primary mb-2" /><h1 className="text-xl font-bold">Login Admin</h1></div>
				{error && <div className="text-sm text-red-400">{error}</div>}
				<div><label className="text-sm">Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
				<div>
					<label className="text-sm">Password</label>
					<div className="relative">
						<input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
						<button type="button" className="absolute right-2 top-2.5" onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
					</div>
				</div>
				<button className="btn btn-primary w-full justify-center" disabled={loading}>{loading ? 'Masuk...' : 'Masuk'}</button>
			</form>
		</main>
	)
}
