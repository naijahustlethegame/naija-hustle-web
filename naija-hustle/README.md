# naija-hustle-web
Next.js (App Router) + Canvas 2D. `npm i && npm run dev`.

- `src/app` routes: `/` (hero demo), `/play`, `/customize`
- `src/game/engine` loop, shared types, drawing (backdrop is pre-rendered once)
- `src/game/scenes` one file per scene (StreetScene now; add Minigame, Events later)
- `src/game/avatar` avatar config + renderer shared by editor and game
- `src/components` React shells; engine is lazy-loaded and pauses when off-screen
- Multiplayer/leaderboard: connect via `src/lib` to naija-hustle-server (not wired yet)
