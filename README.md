# smart-charge-demo

Collectus hackathon **frontend** — demo UI for Activity-Triggered Smart Autocharge.

Talks only to `rpm-autopay-service` (never calls AI directly).

## Quick start

```bash
cd smart-charge-demo
cp .env.example .env
npm install
npm run dev
```

Open http://127.0.0.1:3000 — backend must be on http://127.0.0.1:8000.

## Env

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

For production, set this to your Render backend URL.

## Deploy

### Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`
- Env: `VITE_API_BASE_URL=<backend url>`

### Netlify / similar
Same build output (`dist`).

## What the UI shows
1. Seed scenarios (charge / skip / partial)
2. Simulate repayment
3. Always-charge vs Smart-charge comparison
4. Autopay result + audit log
