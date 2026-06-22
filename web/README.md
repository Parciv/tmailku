# TMailku Web (Next.js 15)

Frontend untuk TMailku: inbox publik, setup wizard, dan admin dashboard.

## Jalankan

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE ke URL Worker
npm run dev
```

## Halaman
- `/` — inbox publik (multi-inbox dropdown, OTP copy, theme toggle, SSE real-time)
- `/setup` — wizard pembuatan admin pertama (otomatis redirect bila sudah selesai)
- `/admin/login` — login admin
- `/admin` — dashboard: Overview, Mail Sources, Appearance, Access & Security, API, Integrations, System
- `/docs` — dokumentasi API (dilayani Worker)

Warna Primary/Secondary/Tertiary & branding diambil dari `/api/branding` saat runtime.
