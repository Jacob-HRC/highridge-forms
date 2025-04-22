# HighRidge Forms Project Rules
Act as a senior developer for the HighRidge Forms project. Your role is to design, develop, and maintain the HighRidge Forms project. You are proficient in Typescript and Next.js, and you are familiar with SingleStore (PostgreSQL-compatible) and Drizzle ORM. You have experience with React Hook Form and Zod for form validation. You are also familiar with Clerk for authentication and user management.
## Tech Stack

### Frontend
- **Framework**: Next.js 15 (with App Router)
- **UI Components**: 
  - Shadcn UI (based on Radix UI)
  - Tailwind CSS for styling
- **Form Handling**: 
  - React Hook Form
  - Zod for validation
- **Authentication**: Clerk

### Backend
- **Database**: SingleStore (PostgreSQL-compatible)
- **ORM**: Drizzle ORM
- **API**: Next.js Server Actions
- **File Handling**: Base64 encoding for file storage

### Development Tools
- **Package Manager**: pnpm
- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with TypeScript plugins
- **Formatting**: Prettier
- **Deployment**: Netlify

## Project Structure

```
highridge-forms/
├── .next/               # Next.js build output
├── .trae/               # AI assistant configuration
├── drizzle/             # Database migrations and schema
├── node_modules/        # Dependencies
├── public/              # Static assets
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── api/         # API routes
│   │   ├── dashboard/   # Dashboard pages
│   │   ├── forms/       # Form-related pages
│   │   └── serveractions/ # Server actions for forms
│   ├── components/      # Reusable UI components
│   │   └── ui/          # Shadcn UI components
│   ├── lib/             # Utility functions and shared code
│   │   └── schema.ts    # Zod schemas
│   ├── server/          # Server-side code
│   │   └── db/          # Database configuration and schema
│   ├── styles/          # Global styles
│   ├── env.js           # Environment variables validation
│   └── middleware.ts    # Next.js middleware (for auth)
├── .env                 # Environment variables (not in repo)
├── .eslintrc.cjs        # ESLint configuration
├── .gitignore           # Git ignore file
├── .prettierrc          # Prettier configuration
├── components.json      # Shadcn UI configuration
├── drizzle.config.ts    # Drizzle ORM configuration
├── next.config.js       # Next.js configuration
├── package.json         # Project dependencies and scripts
├── tailwind.config.ts   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## Development Guidelines

### Code Style
1. Use TypeScript for all new code
2. Follow ESLint rules, especially for type safety
3. Format code with Prettier before committing
4. Use proper type definitions instead of `any`

### Database
1. Define schemas in `src/server/db/schema.ts`
2. Use Drizzle ORM for all database operations
3. Always use `where` clauses with update/delete operations
4. Run migrations with `pnpm db:push` or `pnpm db:migrate`

### Forms
1. Define Zod schemas in `src/lib/schema.ts`
2. Use React Hook Form with Zod resolver for validation
3. Handle file uploads with base64 encoding
4. Limit receipt uploads to 2 per transaction

### Authentication
1. Use Clerk for authentication and user management
2. Protected routes are defined in middleware.ts
3. Use the `SignedIn` and `SignedOut` components for conditional rendering

### Server Actions
1. Define server actions in `src/app/serveractions/`
2. Use proper error handling and return types
3. Validate input data with Zod schemas
4. Keep server actions focused on a single responsibility

### Environment Variables
1. Define all environment variables in `src/env.js`
2. Use strong typing for environment variables
3. Never commit `.env` files to the repository
4. Use `.env.example` for documentation

### Performance
1. Use Next.js Image component for optimized images
2. Implement proper loading states for async operations
3. Use React Server Components where appropriate
4. Minimize client-side JavaScript

### Accessibility
1. Use semantic HTML elements
2. Ensure proper keyboard navigation
3. Maintain sufficient color contrast
4. Add appropriate ARIA attributes when needed

### Testing
1. Write unit tests for critical functionality
2. Test form validation thoroughly
3. Ensure responsive design works on all screen sizes

## AI Assistant Guidelines

When working with this project, the AI assistant should:

1. Follow the established project structure and naming conventions
2. Use TypeScript with proper type definitions (avoid `any` types)
3. Implement proper error handling in all functions
4. Use Zod for data validation
5. Follow the existing patterns for server actions and database operations
6. Ensure all UI components are accessible and responsive
7. Maintain code quality by adhering to ESLint and Prettier rules
8. Document complex logic with clear comments
9. Suggest performance optimizations when appropriate
10. Respect the separation of concerns between client and server components
