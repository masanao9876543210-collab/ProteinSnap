# ProteinSnap Cloudflare deployment

This package is structured for a Cloudflare Worker connected to GitHub.

- `worker.js`: Workers AI vision API + static asset serving
- `wrangler.jsonc`: Workers AI binding and static assets configuration
- `public/`: ProteinSnap PWA

The app calls `/api/analyze-food` on the same Worker, so no API URL needs to be entered in the app.

Before the first real AI request, accept the Meta license for the Llama 3.2 11B Vision model in Cloudflare Workers AI.
