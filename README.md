# Recallr (frontend-only)

Text memorization app inspired by your “recallr-1” UI, but fully client-side.

## Run locally

```bash
npm install
npm run dev
```

## How it works

- Paste your script on the right
- Press **Start** (input clears so you can’t read it)
- Type the next word to reveal it (green)
- Press **Next Word** to reveal it as missed (red)
- Press **Stop** to clear the session + display

## Code layout

- `src/features/recallr/`: Recallr UI + matching logic
- `src/lib/`: small shared hooks/utilities (`useLocalStorageState`, `cn`)
