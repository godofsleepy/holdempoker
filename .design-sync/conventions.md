# Hold'em Party — design conventions

Playful, chunky, cartoon-sky look: bright flat colors, thick white or navy borders, solid drop shadows (no blur), rounded everything. **There are no JS components** — this design system is a stylesheet. Build with plain HTML/JSX using the class names below; never invent new ones when one exists.

## Setup

`styles.css` loads the fonts (Fredoka body, Lilita One display) and every class. Nothing to wrap. The page background is `var(--sky)`; text is `var(--ink)`. Read `_ds/<folder>/_ds_bundle.css` (the full stylesheet) before styling anything new.

## Tokens (CSS custom properties on `:root`)

- Colors: `--sky` `--ink` `--muted` `--slate` `--red` `--blue` `--green` `--yellow` `--orange` `--purple` `--card-red` `--card-black`
- Fonts: `--display` (headings, buttons, numbers) and `--body` (text, weight 500–700)
- Shadows are solid offsets: `box-shadow: 0 6px 0 <darker shade>`; panels use `0 10px 0 var(--ink)`.

## Class vocabulary

| Need | Classes |
|---|---|
| Button | `chunky` + color `red` / `blue` / `green` / `yellow` / `ghost`; size `big` (66px) or `act` (game action) |
| Pill icon button | `hudbtn` (add `round` for icon-only), `guidebtn` (yellow) |
| Text link button | `linkbtn` |
| White card panel | `panel` (h2 inside gets display font); inputs inside `panel` are styled |
| Pills / labels | `pills` (wrap of `span`s), `tagline`, `blinds`, `tablechip` + `chipicon`, `timer`, `handtag` |
| Big title | `title` (yellow, navy stroke, tilted) — `yourturn` for smaller |
| Segmented tabs | `tabs` with `button[aria-selected="true"]` |
| Info box | `note` (blue tint), `note warm` (yellow) |
| List rows | `leaderlist` > `li` with `rank`, `pic`, `who`, `won`; `li.me` highlights |
| Playing card | `card` (+ `red` for hearts/diamonds, `back` for face-down) with `corner tl`, `corner br`, `pip`; size via `--w` |
| Speech bubble | `emote` |
| Divider with text | `or` > `span` + text + `span` |

## Example

```html
<div class="panel" style="max-width:420px">
  <h2>Join a table</h2>
  <input placeholder="Your name">
  <button class="chunky red big">Create table</button>
  <div class="or"><span></span>or<span></span></div>
  <button class="chunky ghost big">Join with code</button>
</div>
<div style="display:flex;gap:10px;--w:78px">
  <div class="card"><div class="corner tl">A<i>♠</i></div><div class="pip">♠</div><div class="corner br">A<i>♠</i></div></div>
  <div class="card red"><div class="corner tl">K<i>♥</i></div><div class="pip">♥</div><div class="corner br">K<i>♥</i></div></div>
  <div class="card back"></div>
</div>
```

Game-screen classes (`stage`, `seat`, `pot`, `board-wrap`, `me`, `actions`) are absolutely positioned for a fixed 1280×720 stage — don't reuse them in other layouts.
