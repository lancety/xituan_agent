## TplPage documentation convention

This folder contains detailed design specs for **feature template pages**. The goal is to keep the overall design docs clean, while allowing each template page to evolve independently with clear, testable UI/UX rules.

### Scope split

- **Overall design / system-level rules**: keep in the corresponding top-level design document (e.g. `xituan-site-design.md`).
- **Template page specs (detailed)**: write in a dedicated `TplPage-*` doc under `devGuide/`.
- **Do not** write deep per-page details in the overall design doc. The overall doc should only keep principles and an index.

### Filename convention

- **Required prefix**: `TplPage-`
- **Recommended pattern**:
  - `TplPage-<project>-<template>.md`
  - Example (site): `TplPage-xituan_site-Home.md`
- **One doc per template page** (and optional shared template docs like shared header).

### Required sections (per template doc)

Each `TplPage-*` doc should include these sections so it can be implemented consistently:

- **Purpose**: what user problem this template solves
- **Layout regions**: header/body blocks; what is fixed vs scrollable
- **Desktop rules**: structure and interaction (not pixel-perfect)
- **Mobile rules**: classic industry pattern reference (e.g. e-commerce search-driven layout)
- **Components**: key component responsibilities (no code dumps)
- **Routing & URL params**: what params exist and what they mean
- **i18n keys**: UI text namespaces/keys that must exist
- **Non-goals**: what is explicitly out of scope

### Index (site templates)

- `TplPage-xituan_site-Header-Shared.md`
- `TplPage-xituan_site-Home.md`
- `TplPage-xituan_site-Search.md`

