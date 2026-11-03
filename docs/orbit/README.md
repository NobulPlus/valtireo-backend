# Orbit — Discovery, Product Design & Architecture

Orbit is the proposed name for what was referred to during discovery as "Valtireo Work Management." Every document in this folder uses **Orbit** as the product name. Internally (module key, table prefixes, route prefixes, folder names) it is also `orbit`, not `work_management` — there is no legacy code yet, so there is no reason to carry the old name into the implementation.

This is a **documentation-only discovery package**. Nothing in `server/`, `client/`, or `mobile/` was changed to produce it. Every claim about "how Valtireo currently works" was verified by reading the actual code (models, migrations, controllers, routes, frontend files) — not inferred from marketing copy or prior docs. Where something could not be confirmed, the relevant document says so explicitly rather than guessing.

## Reading order

1. [01 — Product Requirements](01-product-requirements.md)
2. [02 — Operations Centre vs. Orbit Boundary](02-operations-centre-vs-orbit-boundary.md)
3. [03 — Feature Inventory & Gap Analysis](03-feature-inventory-and-gap-analysis.md)
4. [04 — User Journeys](04-user-journeys.md)
5. [05 — Information Architecture (Web & Mobile)](05-information-architecture.md)
6. [06 — Permissions, Privacy & Tenant Isolation](06-permissions-privacy-tenant-isolation.md)
7. [07 — Database Design & Migration Plan](07-database-design-and-migrations.md)
8. [08 — API Contract Proposal](08-api-contracts.md)
9. [09 — Reusable Components & Integration Points](09-reusable-components-and-integration-points.md)
10. [10 — Notifications, Audit, Files & Background Jobs](10-notifications-audit-files-jobs.md)
11. [11 — MVP & Phase Plan](11-mvp-and-phase-plan.md)
12. [12 — Risks, Edge Cases & Testing Strategy](12-risks-edge-cases-testing.md)
13. [13 — Implementation File Plan](13-implementation-file-plan.md)
14. [14 — Acceptance Criteria](14-acceptance-criteria.md)
15. [15 — Executive Summary](15-executive-summary.md)

## Status

Discovery and planning only. No migrations, models, controllers, routes, screens, roles, permissions, seed data, dependencies, or commits have been created for Orbit. Stop point confirmed — this package is for review before any Phase 1 work begins.
