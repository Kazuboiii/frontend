This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## HOMS/UEMS project notes

This frontend is the web UI for the HOMS/UEMS enterprise app. It is meant to talk to the deployed backend API.

Environment variables:

- `NEXT_PUBLIC_API_BASE_URL`
  - Public backend URL the browser should use, for example `https://api.example.com/api/v1`.
  - If the frontend and backend are served from the same domain, leave this empty and configure the same-origin proxy at build/deploy time instead.
- `API_PROXY_TARGET`
  - Used by `frontend/next.config.ts` when you want the browser to call the same origin and let the app proxy `/api/v1/*` to the backend.

Do not store backend secrets in this frontend repository or in client environment variables.

For the full deployment steps, see the repository root docs:

- `docs/deployment-guide.md`
- `docs/deployment-audit.md`
- `docs/production-checklist.md`
