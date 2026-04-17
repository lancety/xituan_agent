# Cross-repo `todo/` folder convention

Each shippable app under `xituan_module` may keep a root-level `todo/` directory for **human-tracked** follow-ups that are larger than a single PR or span releases. This is separate from Cursor plan checklists and from GitHub Issues.

## Directory layout

| Path | Purpose |
|------|---------|
| `xituan_backend/todo/` | Backend-only follow-ups |
| `xituan_cms/todo/` | CMS-only follow-ups |
| `xituan_site/todo/` | Site consumer follow-ups |
| `xituan_platform/todo/` | Platform app follow-ups |
| `xituan_wechat_app/todo/` | WeChat mini program follow-ups |

## File naming

- One file per **broad feature** or initiative (not one file per micro-task).
- Use **English kebab-case**, e.g. `shared-barcode-unified-props.md`.
- Prefer stable names so links from PRs and chats stay valid.

## Inside each file

1. **First line block** (optional): one-sentence summary, optional owner, `Last updated: YYYY-MM-DD`.
2. **Priority sections** (highest first):
   - `## P0` — must fix before release / blocks merchants
   - `## P1` — should fix soon
   - `## P2` — nice to have
3. **Line prefix tags** (pick one per line):
   - `[fix]` — bug or incorrect behaviour
   - `[feat]` — new behaviour
   - `[chore]` — tooling, refactor, deps
   - `[doc]` — documentation only
4. Each item: one concise sentence; optional trailing context in parentheses: `(see ProductService.updateProduct)`.

## Relationship to `xituan_agent/devGuide`

- **How / why** a feature works → long-form doc under `xituan_agent/devGuide/` (existing pattern).
- **What is still open** for that feature → short bullets in the relevant repo’s `todo/<feature>.md`, optionally linking to the devGuide doc.

## English-only in todo files

List items and tags are in **English** (comments in code remain English per project rules). UI copy stays in the app, not in these files.
