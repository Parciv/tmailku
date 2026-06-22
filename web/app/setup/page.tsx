'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { api } from '@/lib/api'

export default function SetupPage() {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [name, setName] = useState('')
	const [password, setPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [show, setShow] = useState(false)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		api.setupStatus().then((s) => {
			if (s.setupCompleted) router.replace('/admin/login')
		})
	}, [router])

	async function submit(e: React.FormEvent) {
		e.preventDefault()
		setError('')
		if (password !== confirm) return setError('Password tidak sama')
		if (password.length < 8) return setError('Password minimal 8 karakter')
		setLoading(true)
		try {
			await api.setup({ email, password, name })
			router.replace('/admin/login')
		} catch (e: any) {
			setError(e.message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<main className="min-h-screen flex items-center justify-center p-4">
			<form onSubmit={submit} className="glass p-6 w-full max-w-md space-y-4">
				<div className="text-center">
					<UserPlus className="mx-auto text-primary mb-2" />
					<h1 className="text-xl font-bold">Setup Pertama</h1>
					<p className="opacity-70 text-sm">Buat akun admin pertama untuk TMailku.</p>
				</div>
				{error && <div className="text-sm text-red-400">{error}</div>}
				<div><label className="text-sm">Nama</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Admin" /></div>
				<div><label className="text-sm">Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@domain.com" /></div>
				<div>
					<label className="text-sm">Password</label>
					<div className="relative">
						<input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
						<button type="button" className="absolute right-2 top-2.5" onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
					</div>
				</div>
				<div><label className="text-sm">Konfirmasi Password</label><input type={show ? 'text' : 'password'} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
				<button className="btn btn-primary w-full justify-center" disabled={loading}>{loading ? 'Membuat...' : 'Buat Akun Admin'}</button>
			</form>
		</main>
	)
}
