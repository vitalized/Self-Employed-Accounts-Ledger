# Viatlized - SA103F Self-Employment Accounts

## Overview

Viatlized is a UK sole trader accounting application designed to help small business owners track transactions, categorize expenses using HMRC SA103F box codes, and estimate tax liabilities. The app provides a dashboard for viewing financial summaries, managing transactions, generating reports, and calculating UK income tax estimates.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React Context for local state (data mode toggle)
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Charts**: Recharts for data visualization
- **Theme**: next-themes for light/dark mode support

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API under `/api` prefix
- **Development Server**: Vite dev server with HMR, proxied through Express

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` defines tables for users and transactions
- **Migrations**: Drizzle Kit with `drizzle-kit push` for schema syncing
- **Connection**: Uses `DATABASE_URL` environment variable

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory are imported by both client and server
- **Path Aliases**: `@/` for client source, `@shared/` for shared code
- **Mock Data Mode**: Toggle in settings to switch between real API data and mock data for development/demo
- **Type Safety**: Zod schemas generated from Drizzle for validation on both ends

### Application Structure
```
client/           # React frontend
  src/
    components/   # UI components (dashboard, layout, reports, ui)
    pages/        # Route pages (Dashboard, Reports, Settings)
    lib/          # Utilities, API client, queries, types
    hooks/        # Custom React hooks
server/           # Express backend
  index.ts        # Server entry point
  routes.ts       # API route definitions
  storage.ts      # Database access layer
  db.ts           # Database connection
shared/           # Shared code between client/server
  schema.ts       # Drizzle database schema
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management
- **connect-pg-simple**: PostgreSQL session store (available but not currently used)

### Frontend Libraries
- **@tanstack/react-query**: Async state management and caching
- **Radix UI**: Accessible component primitives (dialog, dropdown, tabs, etc.)
- **Recharts**: Charting library for financial visualizations
- **date-fns**: Date manipulation for transaction filtering and reporting
- **wouter**: Minimal routing solution

### Build Tools
- **Vite**: Frontend bundler with React plugin and Tailwind CSS integration
- **esbuild**: Server bundling for production builds
- **tsx**: TypeScript execution for development

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Error overlay during development
- **@replit/vite-plugin-cartographer**: Development tooling (dev only)
- **@replit/vite-plugin-dev-banner**: Development banner (dev only)