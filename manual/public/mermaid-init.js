// Render ```mermaid code blocks to SVG, client-side.
// Starlight/Expressive Code emits <pre data-language="mermaid"> with one
// .ec-line per source line. Reconstruct the source, render via mermaid, and
// replace the figure.
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'inherit' });

let counter = 0;

async function renderAll() {
  const pres = Array.from(document.querySelectorAll('pre[data-language="mermaid"]'));
  for (const pre of pres) {
    const lines = Array.from(pre.querySelectorAll('.ec-line'));
    const source = lines.map((l) => l.textContent || '').join('\n').trim();
    if (!source) continue;
    try {
      const { svg } = await mermaid.render('mmd_' + counter++, source);
      const wrap = document.createElement('div');
      wrap.className = 'mmd';
      wrap.innerHTML = svg;
      const fig = pre.closest('figure') || pre;
      fig.replaceWith(wrap);
    } catch (err) {
      console.warn('mermaid render failed', err);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderAll);
} else {
  renderAll();
}