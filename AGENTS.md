# Project Instructions

## Project shape
- This is a small static, multi-page weather UI named WeFo.
- HTML pages live in `html/`; each page has a matching stylesheet in `css/`.
- Page navigation uses relative links between files in `html/`. Keep those paths valid when moving or adding pages.
- `firebase_config.js` is currently empty and no page imports Firebase or shared JavaScript. Do not assume backend behavior exists.

## Making changes
- Preserve the existing page-specific HTML/CSS organization and visual language unless the task explicitly asks for a redesign.
- Put page styles in the corresponding `css/<page>.css`; avoid introducing inline styles or unrelated global rules.
- Keep semantic HTML, labels, form associations, keyboard access, and existing `aria-*` attributes intact.
- For visual changes, inspect the affected page at desktop and narrow/mobile widths. Check hover, focus, disabled, and active navigation states when relevant.
- For forms or interactive behavior, verify the browser behavior directly; there is no automated test suite or package/build manifest in this repository.
- Use a local HTTP server when testing pages so relative assets and navigation behave as they will when hosted. Opening an HTML file directly is acceptable only for purely local markup/CSS checks.
- Do not add dependencies or configure Firebase unless the task explicitly requires it.

## Validation
- After HTML/CSS edits, load the affected page and follow its main navigation links.
- Check the browser console for missing assets or script errors.
- Keep changes focused to the requested page and its matching stylesheet.
