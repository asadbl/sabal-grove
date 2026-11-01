# Sabal Grove

A gated street of six villas between a golf fairway and a lake, built to scale in 3D for the browser (desktop, iPad and phone).

- **Landing page:** an advertisement for the residences with a live 3D flyover.
- **3D console:** the neighbourhood with the city around it. Tap a villa to go inside and use one of three modes:
  - **Lights:** switch on the lights room by room.
  - **Plan:** see room and furniture sizes.
  - **Walk:** walk through at eye height, with doors that open.

Live: https://asadbl.github.io/sabal-grove/

## Run locally

```
npm install
npm run dev        # http://localhost:5190
npm run deploy     # build and publish to GitHub Pages
```

## Images

- `node scripts/stills.mjs` renders the landing-page stills from the 3D model into `public/stills/`. It needs the dev server running and Google Chrome.
- `node scripts/renders.mjs` renders source frames into `.photo-src/`.
- `node scripts/photos.mjs` turns those frames into photographs through OpenRouter and writes them to `public/photos/`. It needs `OPENROUTER_API_KEY` in `.env.local`, which is never committed. Run it with `--dry` first to see the job count and estimated cost.
