# Manga Research Report

This file is maintained by the `koma-fill-overnight` automation.

## Purpose

- Collect manga craft knowledge from many sources
- Distill practical rules relevant to Koma Fill
- Track how those findings should influence prompts, layout rules, naming workflow, and UI

## Latest Summary

- Added practical findings on `flow of current`, storyboard/name as the core pre-production artifact, and keeping dialog / expressions inside safe print borders.
- Reaffirmed the rule that `line breaks = explicit bubble splits`, then tied that rule to preview-level dialogue density warnings so crowded panels are visible before export.
- Implemented low-risk layout updates so long bubbles clamp inside short panels more safely, especially on narrow vertical frames.

## Findings Log

### 2026-04-08

- Report initialized.

### 2026-04-09

- [CLIP STUDIO TIPS: Creating a New Manga and Storyboard](https://tips.clip-studio.com/en-us/articles/501)
  - Storyboard guidance treats dialog and facial acting as content that must remain inside the default border, not edge decoration.
  - This supports adding preview warnings for dense dialogue and edge-risk content before generation/export.
- [SILENT MANGA AUDITION: The "Flow of Current" in Manga – Paneling Basics](https://www.manga-audition.com/japanesemanga101_009/)
  - In right-to-left manga, action drawn in the same right-to-left flow reads faster and lighter; opposing flow reads slower, heavier, and more forceful.
  - This is directly applicable to prompt hints and template semantics: not every panel should maximize speed; some should intentionally resist the page flow.
- Synthesis for Koma Fill
  - Name/storyboard should remain the main authoring surface, with image generation downstream from that draft.
  - Bubble logic should preserve author-written line breaks as separate candidate balloons.
  - Preview should report `how many bubble candidates` and `which panels are overcrowded`, not only whether images exist.

## Open Questions

- How should speech balloon placement prioritize reading order versus avoiding faces?
- When should a manual storyboard image become a first-class input alongside key images?
- Which manga composition heuristics can be encoded safely without overconstraining generation?
