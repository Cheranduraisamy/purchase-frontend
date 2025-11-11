# Copilot Instructions for Purchase Frontend

## Architecture Overview
This is a modern **Angular 20** application using standalone components, signals, and the latest Angular patterns. The project follows Angular's new application builder and component structure.

### Key Architectural Patterns
- **Standalone Components**: No NgModules - all components use `imports` array directly (see `src/app/app.ts`)
- **Signal-based State**: Uses Angular signals for reactive state management (`signal()`, not observables for simple state)
- **Functional Configuration**: App config uses providers array pattern in `src/app/app.config.ts`
- **Template-Style Separation**: Components use separate `.html` and `.css` files (not inline templates)

## Project Structure
```
src/app/
├── app.ts              # Root component (standalone)
├── app.html            # Root template 
├── app.css             # Root styles (currently empty)
├── app.config.ts       # Application configuration & providers
├── app.routes.ts       # Routing configuration
└── app.spec.ts         # Tests
```

## Development Patterns

### Component Creation
- Use Angular CLI: `ng generate component feature-name`
- Components should be standalone with explicit imports
- Follow the existing pattern: separate `.ts`, `.html`, `.css` files
- Use `signal()` for component state instead of properties when reactive updates needed

### Styling Approach
- Global styles in `src/styles.css`
- Component-specific styles in individual `.css` files
- Current root template uses extensive inline styles - consider extracting to `app.css` for maintainability
- CSS custom properties (variables) are used extensively (see `app.html` `:host` selector)

### TypeScript Configuration
- **Strict mode enabled** - all code must handle null/undefined explicitly
- Uses `ES2022` target with module preservation
- Angular compiler has strict templates and injection parameters enabled

## Development Workflow

### Essential Commands
```bash
npm start          # Development server (ng serve)
npm run build      # Production build
npm run watch      # Watch mode development build
npm test           # Unit tests with Karma/Jasmine
```

### Build Configuration
- Uses `@angular/build:application` (not webpack-based)
- Production builds have strict bundle size limits (500kB initial, 1MB max)
- Development builds preserve source maps and skip optimization

## Current State & Next Steps
This is a **fresh Angular project** with default starter content. The main `app.html` contains Angular's welcome template that should be replaced with actual application content.

### When Adding Features
1. Replace the placeholder content in `app.html` with actual application UI
2. Add routes to `app.routes.ts` for navigation
3. Create feature components using `ng generate component`
4. Add services using `ng generate service` for business logic
5. Configure HTTP client in `app.config.ts` if API calls needed

### Import Patterns
- Standalone components: Use `imports: [ComponentName, DirectiveName]` array
- Services: Inject via constructor or `inject()` function
- Router: Already configured - add routes to expand navigation