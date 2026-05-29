// Tech Troubleshooter Framework — D3 tree visualization

const TRANSITION = 450;
const MAX_LABEL = 35;

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COLOR = {
  nodeDefault: cssVar('--node-default'),
  nodeLeaf: cssVar('--node-leaf'),
  nodeWindows: cssVar('--node-windows'),
  nodeMac: cssVar('--node-mac'),
  nodeBrowser: cssVar('--node-browser'),
  nodeOffice: cssVar('--node-office'),
  nodeEmail: cssVar('--node-email'),
  textPrimary: cssVar('--text-primary'),
};

const BRANCH_COLOR = {
  'Windows': 'nodeWindows',
  'Mac': 'nodeMac',
  'Browser Issues': 'nodeBrowser',
  'Microsoft Office': 'nodeOffice',
  'Email Issues': 'nodeEmail',
};

const truncate = (s) => (s && s.length > MAX_LABEL ? s.slice(0, MAX_LABEL - 1) + '…' : s);
const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Only allow http(s) URLs into href attributes — prevents javascript: / data: injection
// if a future arf.json author drops in something weird.
const safeHref = (s) => {
  const str = String(s ?? '').trim();
  return /^https?:\/\//i.test(str) ? escapeHTML(str) : '';
};
const displayHostname = (s) => {
  try { return new URL(s).hostname.replace(/^www\./, ''); } catch (_) { return s; }
};

let root;
let nodeIdCounter = 0;
let initialTransform;
let svg, gZoom, gLinks, gNodes, zoom;
let treeLayout;
let activePanelNode = null;

fetch('./arf.json')
  .then((r) => r.json())
  .then(boot)
  .catch((err) => {
    console.error('Failed to load arf.json', err);
    const errBox = document.createElement('div');
    errBox.style.cssText = 'position:fixed;top:60px;left:20px;color:#b91c1c;font-family:Inter,sans-serif';
    errBox.textContent = 'Failed to load arf.json — open this site through a local web server or push to GitHub Pages.';
    document.body.appendChild(errBox);
  });

function boot(data) {
  svg = d3.select('#tree');
  gZoom = svg.append('g').attr('class', 'zoom-layer');
  gLinks = gZoom.append('g').attr('class', 'links');
  gNodes = gZoom.append('g').attr('class', 'nodes');

  treeLayout = d3.tree().nodeSize([22, 280]);

  root = d3.hierarchy(data);
  root.x0 = 0;
  root.y0 = 0;
  root.each((d) => { d._id = ++nodeIdCounter; });

  // Collapse everything below the top-level branches (depth >= 1).
  // Root (depth 0) stays expanded; Windows + Mac (depth 1) are visible but collapsed.
  root.each((d) => {
    if (d.depth >= 1 && d.children) {
      d._children = d.children;
      d.children = null;
    }
  });

  zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .on('zoom', (e) => gZoom.attr('transform', e.transform));
  svg.call(zoom);

  const initialY = Math.max(window.innerHeight / 2 - 80, 200);
  initialTransform = d3.zoomIdentity.translate(80, initialY).scale(1);
  svg.call(zoom.transform, initialTransform);

  update(root);
  wireUI();
}

function update(source) {
  treeLayout(root);

  const t = d3.transition().duration(TRANSITION).ease(d3.easeCubicInOut);

  const nodesData = root.descendants();
  const linksData = root.links();

  // --- LINKS ---
  const link = gLinks.selectAll('path.link')
    .data(linksData, (d) => d.target._id);

  const linkEnter = link.enter().append('path')
    .attr('class', 'link')
    .attr('d', () => {
      const o = { x: source.x0 ?? source.x, y: source.y0 ?? source.y };
      return diagonal(o, o);
    });

  link.merge(linkEnter).transition(t)
    .attr('d', (d) => diagonal(d.source, d.target));

  link.exit().transition(t)
    .attr('d', () => {
      const o = { x: source.x, y: source.y };
      return diagonal(o, o);
    })
    .remove();

  // --- NODES ---
  const node = gNodes.selectAll('g.node')
    .data(nodesData, (d) => d._id);

  const nodeEnter = node.enter().append('g')
    .attr('class', 'node')
    .attr('transform', () => `translate(${source.y0 ?? source.y},${source.x0 ?? source.x})`)
    .attr('opacity', 0)
    .on('click', (event, d) => {
      event.stopPropagation();
      toggleNode(d);
      openPanel(d);
    });

  nodeEnter.append('circle');
  nodeEnter.append('text')
    .attr('dy', '0.32em');

  const nodeMerge = node.merge(nodeEnter);

  nodeMerge.select('circle')
    .attr('r', (d) => d.depth === 0 ? 6 : (hasKids(d) ? 4.5 : 4))
    .attr('fill', (d) => circleFill(d))
    .attr('stroke', (d) => circleStroke(d))
    .attr('stroke-width', (d) => hasKids(d) || d.depth === 0 ? 0 : 1.5);

  nodeMerge.select('text')
    .attr('x', (d) => 10)
    .attr('text-anchor', 'start')
    .text((d) => truncate(d.data.name));

  nodeMerge.transition(t)
    .attr('transform', (d) => `translate(${d.y},${d.x})`)
    .attr('opacity', 1);

  node.exit().transition(t)
    .attr('transform', () => `translate(${source.y},${source.x})`)
    .attr('opacity', 0)
    .remove();

  // Stash previous coords for next transition.
  root.each((d) => { d.x0 = d.x; d.y0 = d.y; });
}

function diagonal(s, t) {
  return d3.linkHorizontal()({ source: [s.y, s.x], target: [t.y, t.x] });
}

function hasKids(d) { return !!(d.children || d._children); }

function circleFill(d) {
  if (d.depth === 0) return COLOR.textPrimary;
  if (d.depth === 1) {
    // Top-level branches tinted by their accent.
    const key = BRANCH_COLOR[topLevelName(d)];
    if (key) return COLOR[key];
  }
  if (hasKids(d)) return COLOR.nodeDefault;
  return '#FFFFFF';
}

function circleStroke(d) {
  if (hasKids(d) || d.depth === 0) return 'none';
  return COLOR.nodeLeaf;
}

function topLevelName(d) {
  let cur = d;
  while (cur.depth > 1 && cur.parent) cur = cur.parent;
  return cur.data?.name;
}

function toggleNode(d) {
  if (!d.children && !d._children) return; // leaf: nothing to toggle
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
  update(d);
}

// --- DETAIL PANEL ---
const panel = document.getElementById('detail-panel');
const panelBody = document.getElementById('panel-body');
const panelClose = document.getElementById('panel-close');

function openPanel(d) {
  activePanelNode = d;
  panel.setAttribute('aria-hidden', 'false');
  panel.classList.add('open');

  const branch = topLevelName(d);
  const key = BRANCH_COLOR[branch];
  panel.style.borderLeftColor = key ? COLOR[key] : cssVar('--accent');

  renderPanel(d);
}

function closePanel() {
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  activePanelNode = null;
}

function renderPanel(d) {
  const data = d.data;
  const ancestors = d.ancestors().reverse();
  const crumb = ancestors.map((n) => escapeHTML(n.data.name)).join('<span class="sep">›</span>');

  let html = '';
  html += `<div class="breadcrumb">${crumb}</div>`;
  html += `<h2>${escapeHTML(data.name)}</h2>`;

  if (data.phase) {
    html += `<div class="badge phase">${escapeHTML(data.phase)}</div>`;
  }
  if (data.errorCode) {
    html += `<div class="badge error">${escapeHTML(data.errorCode)}</div>`;
  }

  if (data.description) {
    html += `<p class="description">${escapeHTML(data.description)}</p>`;
  }

  if (Array.isArray(data.steps) && data.steps.length) {
    html += '<ol class="steps">';
    for (const step of data.steps) html += `<li>${escapeHTML(step)}</li>`;
    html += '</ol>';
  }

  if (data.command) {
    html += `
      <div class="command-block">
        <span class="label">Command</span>
        <pre><code>${escapeHTML(data.command)}</code></pre>
        <button class="copy-btn" type="button">Copy</button>
      </div>`;
  }

  if (data.warning) {
    html += `<div class="warning-box">${escapeHTML(data.warning)}</div>`;
  }

  if (data.source) {
    const href = safeHref(data.source);
    if (href) {
      const host = escapeHTML(displayHostname(data.source));
      html += `<a class="source-link" href="${href}" target="_blank" rel="noopener noreferrer"><span class="label">Source</span> ${host}</a>`;
    }
  }

  const kids = d.children || d._children;
  if (kids && kids.length) {
    html += '<div class="children-list"><span class="label">Subcategories</span><div class="chips">';
    for (const child of kids) {
      html += `<button class="chip" data-id="${child._id}">${escapeHTML(child.data.name)}</button>`;
    }
    html += '</div></div>';
  }

  // Safe: every interpolated value above passes through escapeHTML().
  // Data source is the same-origin arf.json — no external/user input reaches this string.
  panelBody.innerHTML = html;

  // Wire copy button
  const copyBtn = panelBody.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const cmd = data.command;
      const reset = () => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); };
      const success = () => {
        copyBtn.textContent = 'Copied ✓';
        copyBtn.classList.add('copied');
        setTimeout(reset, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd).then(success).catch(() => fallbackCopy(cmd) && success());
      } else {
        if (fallbackCopy(cmd)) success();
      }
    });
  }

  // Wire child chips
  panelBody.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = +btn.dataset.id;
      const child = findById(id);
      if (!child) return;
      // Ensure the parent shows the child (expand parent if collapsed).
      if (d._children && !d.children) {
        d.children = d._children;
        d._children = null;
        update(d);
      }
      openPanel(child);
    });
  });
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

function findById(id) {
  let found = null;
  root.each((d) => { if (d._id === id) found = d; });
  return found;
}

// --- SEARCH ---
const searchInput = document.getElementById('search');
const resultCount = document.getElementById('result-count');

function clearSearchHighlights() {
  gNodes.selectAll('g.node').classed('match', false).classed('dim', false);
  gLinks.selectAll('path.link').classed('dim', false);
}

function collapseToInitial() {
  root.each((d) => {
    if (d.depth >= 1 && d.children) {
      d._children = d.children;
      d.children = null;
    }
  });
  update(root);
}

function runSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    clearSearchHighlights();
    resultCount.textContent = '';
    collapseToInitial();
    return;
  }

  // Find matches across the full hierarchy (need to traverse _children too).
  const matches = [];
  walkAll(root, (d) => {
    const name = (d.data.name || '').toLowerCase();
    const desc = (d.data.description || '').toLowerCase();
    if (name.includes(q) || desc.includes(q)) matches.push(d);
  });

  // Expand path from root to each match.
  for (const m of matches) {
    let cur = m.parent;
    while (cur) {
      if (cur._children) {
        cur.children = cur._children;
        cur._children = null;
      }
      cur = cur.parent;
    }
  }

  update(root);

  // Apply highlight/dim after the next frame (so DOM matches new tree).
  requestAnimationFrame(() => {
    const matchIds = new Set(matches.map((m) => m._id));
    gNodes.selectAll('g.node')
      .classed('match', (d) => matchIds.has(d._id))
      .classed('dim', (d) => !matchIds.has(d._id) && !isAncestorOfAny(d, matchIds));
    gLinks.selectAll('path.link')
      .classed('dim', (d) => !matchIds.has(d.target._id) && !isAncestorOfAny(d.target, matchIds));
  });

  resultCount.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
}

function isAncestorOfAny(d, matchIds) {
  // d is "highlighted as path" if any descendant (including _children) is a match.
  let any = false;
  walkAll(d, (n) => { if (matchIds.has(n._id)) any = true; });
  return any;
}

function walkAll(d, fn) {
  fn(d);
  const kids = d.children || d._children || [];
  for (const c of kids) walkAll(c, fn);
}

// --- UI wiring ---
function wireUI() {
  searchInput.addEventListener('input', (e) => runSearch(e.target.value));

  panelClose.addEventListener('click', closePanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  document.getElementById('reset-view').addEventListener('click', () => {
    svg.transition().duration(750).ease(d3.easeCubicInOut)
      .call(zoom.transform, initialTransform);
  });

  window.addEventListener('resize', () => {
    // Keep the existing transform; user can hit Reset View if needed.
  });
}
