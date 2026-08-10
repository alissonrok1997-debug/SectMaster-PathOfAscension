# Gemini prompt — app launcher icon

One square source image at **1024×1024**. Save the result as
`public/icons/source-1024.png`, then run `npm run icons` to generate every size the
manifest needs.

## What makes this different from the in-game icons

The `src/assets/icons` set is painted art on a transparent background, viewed at 40–56px
inside a dark UI. A launcher icon is different:

- It sits on the player's home screen against **an unknown wallpaper**, so it needs its
  own opaque background — no transparency.
- Android may crop it to a circle, squircle or rounded square. Everything that matters
  must sit inside the **centre 66%**; the outer ring is disposable padding.
- It's read at ~48px. One shape, high contrast, no fine detail — the three-tier pagoda
  from `BuildingsIcon.png` has far too much roof detail to survive at that size.

---

## Prompt

> A mobile game app icon for a Chinese xianxia cultivation-sect idle game called
> "Sect Master: Path of Ascension".
>
> **Subject:** a single stylised mountain peak with one tiered pagoda silhouette at its
> summit, rendered as a bold, simplified emblem — not an illustration. Behind it, a thin
> circular halo ring suggesting a spirit-energy aura. The whole mark reads as one clear
> shape at thumbnail size.
>
> **Colour:** warm antique gold (`#f2d98a`) subject on a deep near-black indigo
> background (`#12131a`), with a subtle radial glow behind the peak in muted gold. Two
> colours plus the glow — no rainbow, no gradients across the subject itself.
>
> **Style:** hand-painted 2D game art with clean, confident edges; semi-flat with light
> rim-lighting on the gold. Slightly ornamental, evoking carved jade or gilt metalwork.
> Symmetrical, centered composition.
>
> **Composition:** the subject occupies the centre 60–65% of the frame with generous even
> padding on all four sides, so the icon survives being cropped to a circle. Fully opaque
> background extending edge to edge — no transparency anywhere.
>
> **Output:** square 1:1, 1024×1024. No text, no letters, no numbers, no watermark, no
> border or frame, no drop shadow outside the canvas, no UI chrome, no characters or
> people.

---

## Checking the result before running `npm run icons`

- Squint at it, or shrink it to 48px. If the pagoda turns to mush, ask for **fewer roof
  tiers and a heavier silhouette**.
- Cover the outer ~17% on every side. What's left should still read as the icon — that's
  what Android shows on a circular-mask launcher.
- Background must be fully opaque. A transparent one renders black on some launchers and
  white on others.
- If Gemini adds text (it often sneaks in a character or two), regenerate — text at 48px
  is noise and gets cropped anyway.

## Variations worth trying

- Swap the pagoda for **a single upward sword** with the halo ring — simpler and reads
  even better small, though less specific to the sect theme.
- Swap the mountain for **a stylised cloud-and-peak pair**, the classic xianxia motif.
- Ask for a **jade-green** subject instead of gold if the gold looks washed out against
  your wallpaper.
