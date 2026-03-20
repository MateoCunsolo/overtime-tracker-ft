# Overtime Tracker - Structure and Naming

## Folder strategy

- `core/`: singleton services, guards, interceptors, tokens, global utils.
- `shared/`: reusable UI pieces (`components`, `directives`, `pipes`).
- `features/`: domains for the worker self-tracking flow (`auth`, `dashboard`, `overtime`).
- `layouts/`: standalone shell components with `router-outlet`.
- `state/`: optional global state artifacts (actions, selectors, effects, store).

## Naming convention (standalone)

- Pages: `feature-name-page.component.ts`
- Dumb/presentational components: `thing-card.component.ts`, `thing-table.component.ts`
- Smart/container components: `thing-container.component.ts`
- Services: `feature-name.service.ts`
- Models/interfaces: `feature-name.model.ts`
- Route files per feature: `feature-name.routes.ts`

## Route convention

- Main app routes live in `app.routes.ts`.
- Each feature exposes its own `FEATURE_ROUTES`.
- Use lazy loading with `loadChildren` for feature route files.
- Use `loadComponent` for standalone components.
