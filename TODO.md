# TODO - Future Improvements

## Visual Style Extraction (Parody looks like original)

**Problem:** Parodies don't visually resemble the original site. Generic purple/pink theme for everything.

**Solution:** Use Firecrawl screenshot + Claude Vision to extract design DNA.

### What to extract:
- Colors (primary, secondary, background, text)
- Layout (hero-cards, grid, sidebar, single-column, feed)
- Theme (light/dark)
- Typography (corporate, casual, modern, playful, luxury)
- Density (spacious, balanced, compact)
- Brand vibe (free description)

### Files to modify:
1. `generate-parody-background.ts` - Add `extractVisualStyle()` function (~80 lines)
2. `src/types/index.ts` - Extend `ParodyConfig` interface (~10 lines)
3. `src/views/ParodyView.vue` - Apply dynamic CSS variables (~20 lines)

### Cost:
~$0.01 extra per parody (one vision API call)

### Expected result:
- "De Handige Jongens" (green/white contractor) → green/white parody
- Dark mode sites → dark parody
- Playful brands → playful typography

See full implementation details in `.claude/plans/giggly-orbiting-church.md`

---

## Other Ideas

- [ ] Layout templates that match common site structures
- [ ] Font family extraction (Google Fonts detection)
- [ ] Logo style detection (icon, wordmark, combination)
