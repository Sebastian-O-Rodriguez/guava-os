---
name: reveal-presentation
description: "Author HTML slide decks with reveal.js — nested slides, Markdown, Auto-Animate, fragments, transitions, backgrounds, speaker notes, PDF export, LaTeX math, and code highlighting."
domain: frontend
role: designer
order: 11
load_when: a slide deck is a deliverable
guidance: nested slides + markdown | one idea per slide | export to PDF if asked

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Build reveal.js presentations: structure slides in HTML (or Markdown), then layer animations, styling, and export features on top.

## Deck Skeleton

```html
<div class="reveal">
  <div class="slides">
    <section><h1>Slide</h1></section>
    <section>
      <section>Vertical 1</section>
      <section>Vertical 2</section>
    </section>
  </div>
</div>
<script>Reveal.initialize({ hash: true });</script>
```

Each `<section>` is a slide; nested `<section>`s create **vertical** slides (Space advances through all; ArrowDown dives down). Always serve over HTTP.

## Markdown

Add `data-markdown` + `<textarea data-template>` (or `data-markdown="file.md"`); delimit horizontal slides with `\n---\n`. Attach attributes via `<!-- .slide: data-background="#f00" -->` and `<!-- .element: class="fragment" data-fragment-index="2" -->`.

## Auto-Animate

Add `data-auto-animate` to **adjacent** slides; matching elements (by text, `src`, or `data-id`) animate between them. Tune with `data-auto-animate-easing/-duration/-unmatched`; group with `data-auto-animate-id`; break with `data-auto-animate-restart`.

```html
<section data-auto-animate><div data-id="box" style="height:50px;background:#fa8072"></div></section>
<section data-auto-animate><div data-id="box" style="height:200px;background:#00f"></div></section>
```

## Fragments

Reveal elements step-by-step with the `fragment` class; choose a style via a second class.

| Class | Effect |
|---|---|
| `fade-in` (default) / `fade-out` | Fade in / start visible then out |
| `fade-up` `-down` `-left` `-right` | Slide in while fading |
| `fade-in-then-out` / `-semi-out` | Fade in, then out / to 50% |
| `grow` / `shrink` / `strike` | Scale up / down / strikethrough |
| `highlight-red` `-green` `-blue` | Color text |
| `highlight-current-*` | Color, then revert next step |

Control order with `data-fragment-index`; nest fragments for multi-step effects; extend with `.fragment.effect` + `.visible` CSS.

## Transitions & Backgrounds

- Transition via `transition` config or per-slide `data-transition`: `none`, `fade`, `slide` (default), `convex`, `concave`, `zoom`. Combine `-in`/`-out` (`slide-in fade-out`); speed via `data-transition-speed="fast|default|slow"`.
- Backgrounds: `data-background="#hex"`, `data-background="img.png"`, `data-background-video="a.mp4"`, `data-background-repeat` + `data-background-size`, `data-background-iframe="url"`; transition via `backgroundTransition` config or `data-background-transition`.

## Speaker Notes & PDF Export

- Notes: `<aside class="notes">…</aside>` inside a slide. Press **S** for speaker view (timer, next-slide preview, notes).
- PDF: open `?print-pdf`, then Print → Save as PDF, **Landscape**, **No margins**, **Background graphics** on. `showNotes: true` (or `'separate-page'`) includes notes. Chrome/Chromium only.

## Math & Code Highlighting

- Math: register `RevealMath.KaTeX`; write inline `$...$` or display `\[...\]` (KaTeX recommended; MathJax 2/3/4 available).
- Code: `<pre><code data-trim data-line-numbers="3,8-10|13-15" class="language-python">`. Use `|` for step highlights, `data-ln-start-from="7"` to offset line numbers, `<script type="text/template">` to avoid escaping HTML.

## r-fit-text & Navigation

Add class `r-fit-text` to auto-size text to fit its slide. Keys: `Esc` overview · `B`/`.` pause · `S` speaker view · `alt/ctrl+click` zoom. `data-state="x"` adds a class and fires `Reveal.on('x', …)`.

## Uses

- Authoring reveal.js decks from scratch or extending existing ones
- Adding Markdown, math, and highlighted code slides
- Animating between slides with Auto-Animate and fragments
- Styling transitions and full-bleed backgrounds
- Preparing decks for print/PDF or speaker-view delivery

## Source

Distilled from the reveal.js feature documentation (https://revealjs.com/) — vertical slides, Markdown, Auto-Animate, fragments, transitions, backgrounds, speaker view, PDF export, math, and code.