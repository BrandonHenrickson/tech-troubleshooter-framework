# Tech Troubleshooter Framework

An interactive D3.js tree of Windows and Mac troubleshooting tools and solutions.

Live at: https://brandonhenrickson.github.io/tech-troubleshooter-framework/

## Adding New Nodes

Edit `arf.json` following the existing structure. Each node supports:

- `name` — display text on the tree
- `description` — full explanation shown in the detail panel
- `command` — optional, shown in a code block with a Copy button (use `\n` for line breaks)
- `phase` — optional pill label (e.g. "Phase 1: Quick Check")
- `warning` — optional yellow warning box
- `errorCode` — optional red badge
- `steps` — optional array of strings, rendered as a numbered list
- `source` — optional URL (http/https only) shown as a clickable "Source" link in the panel
- `children` — optional array of child nodes

## Local Development

Open `index.html` directly in your browser — no server required.

> If the tree doesn't appear when opening the file directly, your browser may be blocking the `fetch('./arf.json')` call due to `file://` CORS restrictions. In that case, serve the folder with any static server (e.g. `python -m http.server` or VS Code Live Server) and open `http://localhost:8000`.

## Deployment to GitHub Pages

1. Create a new GitHub repository (public).
2. Upload all 5 files (`index.html`, `style.css`, `main.js`, `arf.json`, `README.md`) to the repo root.
3. Go to **Settings → Pages**.
4. **Source**: Deploy from a branch → **Branch**: `main` → **Folder**: `/ (root)`.
5. Click **Save**. Your site will be live at `https://[your-username].github.io/[repo-name]/`.
6. To update: edit `arf.json` and push. No build step required.
