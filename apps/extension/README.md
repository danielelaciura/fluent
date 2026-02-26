# MeetFluent Chrome Extension

AI-powered English coaching for Google Meet calls.

## Development

```bash
# From the monorepo root
npm install
npm run dev --workspace=@meetfluent/extension
```

This builds the extension to `apps/extension/dist/` and watches for changes.

## Load in Chrome (unpacked)

1. Run the dev build: `npm run dev --workspace=@meetfluent/extension`
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `apps/extension/dist/` folder
6. The MeetFluent icon appears in the toolbar

After code changes, the extension rebuilds automatically. Click the reload
button on the extension card in `chrome://extensions/` to pick up changes.

## Build for production

```bash
npm run build --workspace=@meetfluent/extension
```

Output is in `apps/extension/dist/`.
