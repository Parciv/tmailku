'use client'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getTheme, setTheme } from '@/lib/store'

export default function ThemeToggle() {
	const [theme, setThemeState] = useState<'dark' | 'light'>('dark')
	useEffect(() => {
		const t = getTheme()
		setThemeState(t)
		setTheme(t)
	}, [])
	function toggle() {
		const next = theme === 'dark' ? 'light' : 'dark'
		setThemeState(next)
		setTheme(next)
	}
	return (
		<button className="btn btn-ghost" onClick={toggle} aria-label="Toggle theme">
			{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
		</button>
	)
}
