'use client'
import { useEffect } from 'react'
import { api, type Branding } from '@/lib/api'
import { getTheme, setTheme } from '@/lib/store'

export default function BrandingProvider({ onLoad }: { onLoad?: (b: Branding) => void }) {
	useEffect(() => {
		setTheme(getTheme())
		api
			.branding()
			.then((b) => {
				const root = document.documentElement
				root.style.setProperty('--color-primary', b.colors.primary)
				root.style.setProperty('--color-secondary', b.colors.secondary)
				root.style.setProperty('--color-tertiary', b.colors.tertiary)
				if (b.appName) document.title = b.appName + ' — Temporary Mail'
				onLoad?.(b)
			})
			.catch(() => {})
	}, [onLoad])
	return null
}
