# LDD Etsy PNG Optimizer + ZIP Splitter

A fast, client‑side image optimizer that:

- Accepts **PNG / JPG / WebP** and even **ZIP uploads** (auto-extracts images)
- Optimizes images in parallel using Web Workers
- Packs results into **Etsy-friendly ZIP parts** (stays under ~20MB per part)

## Local dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy to Netlify

This repo is already Netlify-ready:

- `netlify.toml` sets build + publish directory
- `public/_redirects` ensures the SPA loads correctly

### Option A: Netlify UI
1. Push this repo to GitHub
2. In Netlify: **Add new site → Import an existing project**
3. Pick the repo
4. Build command: `npm run build`
5. Publish directory: `dist`

### Option B: Netlify CLI
```bash
npm i -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

## Branding

- The top-left badge logo uses `public/logo.png`
- Favicon uses `public/favicon.png`

Swap either file to rebrand instantly.
