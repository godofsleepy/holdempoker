# design-sync notes

- Not a component library: plain HTML/CSS/JS app. Synced as a **tokens-only** design system (styles only, 0 components). User chose this on 2026-11-06.
- `.design-sync/entry.js` is an empty module used as `--entry` (the converter needs one).
- `cssEntry` = `public/style.css` (the whole app stylesheet).
- Fonts: Fredoka + Lilita One latin woff2 downloaded from Google Fonts into `.design-sync/fonts/` (OFL) and wired via `extraFonts` — the app itself loads them from Google Fonts in `public/index.html`.
- Playwright isn't in `.ds-sync/node_modules`; symlink the preinstalled one: `ln -sfn /opt/node-tools/node_modules/playwright .ds-sync/node_modules/playwright` (and `playwright-core`).
- Build: `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules .ds-sync/node_modules --entry ./.design-sync/entry.js --out ./ds-bundle`
- Upload NOT done yet: DesignSync needed design authorization (no project created, no `projectId` pinned).

## Re-sync risks
- Fonts are a frozen copy; if `index.html` changes font families, refresh `.design-sync/fonts/`.
- `conventions.md` lists class names from `public/style.css` — re-validate them after CSS renames.
- 2 CSS vars are set inline by JS (`--w`, `--shade`, etc.), so validate's "tokens missing" note is expected.
