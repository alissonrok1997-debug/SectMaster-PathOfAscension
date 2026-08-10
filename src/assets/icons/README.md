# Icon art

All 14 buildings, 6 resources, 4 disciple roles and 4 equipment slots have artwork.
Lookups live in `index.ts`, keyed by the ids the game already uses.

| Folder | Keyed by | Source |
|---|---|---|
| `resources/` | `keyof Resources` | `../ResourceIcon.png` |
| `buildings/` | building id | `../BuildingsIcon.png` + 4 standalone renders |
| `roles/` | `DiscipleRole` | `../RolesEquipmentIcon.png` (top row) |
| `slots/` | `EquipmentSlotId` | `../RolesEquipmentIcon.png` (bottom row) |

`_alt-*.png` are near-duplicates left over from the sheets (a second mine, warehouse
and dormitory; a second ore and crystal). Unused — kept for future building tiers or
resource variants.

## Adding a new icon

Source art: square, single object, flat magenta `#FB24FC` background, 1024px.
Processing pipeline (see `../../../` history — the script is not checked in):

1. Chroma-key the magenta **with unpremultiply** — `fg = (px - bg·(1-α)) / α`.
   A naive key that just drops magenta leaves a pink cast on warm colours; this is
   what turned the gold equipment outlines salmon on the first pass.
2. Trim to the content bounding box (dilate first so sparkle motes stay attached).
3. Pad to a square, 5% margin.
4. Resize — 192px for buildings, 128px for everything else.
5. Quantise to 256 colours, `optimize=True`. Keeps the set at ~370 KB total instead
   of ~3 MB with no visible loss on painterly art.

Then add the import + `BUILDING_ART` (or other map) entry in `index.ts`.

## Style reference for new building art

Hand-painted 2D game icon, semi-realistic stylized fantasy, soft painterly brushwork
with crisp readable silhouettes. Isometric 3/4 view from ~30° above. The building sits
on a small floating island of dark grey rock with mossy green grass on top and a
chipped, irregular underside. Warm interior lighting (golden glow from windows)
against cool daylight ambient. Subtle rim light, gentle drop shadow on the island, a
few tiny white sparkle motes. Chinese xianxia architecture: dark slate tiled roofs
with upturned eaves, warm timber beams, occasional gold trim and red lacquer accents.
Single object, centered, small margin. No text, logos, watermark, UI frame, border,
ground plane beyond the island, or characters. Square 1:1, flat solid magenta
`#FB24FC` background with sharp edges for clean keying.
