FUTURERECEIPT Web Source
========================

This archive contains the current web frontend, its API server, and the shared workspace libraries it uses. The source is React + TypeScript + Vite, so the UI lives in multiple .tsx/.ts/.css files rather than one standalone HTML file. index.html is the browser entry shell.

Folder guide
------------
- artifacts/ecobill/                 Web app: index.html, src/, public/, Vite and TypeScript config.
- artifacts/ecobill/src/App.tsx      Main routes, landing page, authentication screens, and app UI.
- artifacts/ecobill/src/index.css    Global styles, theme tokens, and responsive styling.
- artifacts/ecobill/src/main.tsx     React entry point and app providers.
- artifacts/ecobill/src/components/  Shared UI components.
- artifacts/ecobill/src/hooks/       Reusable UI hooks.
- artifacts/ecobill/src/lib/         Browser-side helpers.
- artifacts/api-server/              API backend used by the web app.
- lib/api-client-react/              Generated typed React Query API hooks used by the web UI.
- lib/api-spec/                      OpenAPI contract used to define API routes and generate clients.
- lib/api-zod/                       Generated API request/response schemas.
- lib/db/                            Shared database schema and access library.
- package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig*.json  Workspace and build configuration.

The archive excludes node_modules, build outputs, environment files, and secrets. Running the complete app requires installing dependencies and configuring the project's required environment variables and database.
