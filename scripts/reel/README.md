# Instagram reels

Two 1080×1920 reels of the site on an iPad, with a finger working every feature and an "Asad" end card. The long cut is about 83 seconds: the landing page and its photos, a tour of the neighbourhood, Casa Palma's pool, then lights, sizes and a walk out to the pool. The 15-second cut is edited from the same recording. Everything the scripts write goes to `reel/` at the project root, which git ignores.

```
npm run dev                                             # the recording drives the dev server
node scripts/reel/music.mjs 85 music-long.mp3           # soundtracks from Lyria 3 on OpenRouter, about $0.08 each
node scripts/reel/music.mjs 15 music-15.mp3
node scripts/reel/render-assets.mjs                     # background, iPad, captions, end card → reel/assets/
node scripts/reel/story.mjs reel/frames --preview       # quick low-res check (every third frame)
node scripts/reel/story.mjs reel/frames                 # the real capture, 1668×2388 per frame
node scripts/reel/compose.mjs reel/frames reel/sabal-grove-reel.mp4
node scripts/reel/cut.mjs reel/frames reel/frames-15
node scripts/reel/compose.mjs reel/frames-15 reel/sabal-grove-reel-15s.mp4 --caps cuts-15.json --music music-15.mp3 --music-start 16 --end 2.8 --lead 0
```

- `lib.mjs` runs the page on a virtual clock, so every frame is exactly 1/30 s apart however long a capture takes.
- `story.mjs` is the storyboard; `captions.json` holds the caption for each of its scenes.
- `cuts-15.json` lists the shots in the 15-second cut, each as a scene, an offset into it and a length, with its caption.
