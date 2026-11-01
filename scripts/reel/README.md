# Instagram reel

A 45-second 1080×1920 reel of the site on an iPad, with a finger working the 3D features and an end card. Everything it writes goes to `reel/` at the project root, which git ignores.

```
npm run dev                                           # the recording drives the dev server
node scripts/reel/music.mjs                           # soundtrack from Lyria 3 on OpenRouter, about $0.08 → reel/music.mp3
node scripts/reel/render-assets.mjs                   # background, iPad, captions, end card → reel/assets/
node scripts/reel/story.mjs reel/frames --preview     # quick low-res check (every third frame)
node scripts/reel/story.mjs reel/frames               # the real capture, 1668×2388 per frame
node scripts/reel/compose.mjs reel/frames reel/sabal-grove-reel.mp4
```

- `lib.mjs` runs the page on a virtual clock, so every frame is exactly 1/30 s apart however long a capture takes.
- `story.mjs` is the storyboard.
- `captions.json` holds the caption for each scene.
