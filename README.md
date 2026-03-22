This is a [Next.js](https://nextjs.org) project configured for static export and GitHub Pages deployment.

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

## Build For Production

Run a static export build:

```bash
npm run build
```

The generated site is written to `out/`.

## Deploy To GitHub Pages

This repository includes a workflow at `.github/workflows/deploy.yml` that deploys automatically when you push to `main`.

1. In your GitHub repository, open **Settings -> Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`.
4. Wait for the **Deploy to GitHub Pages** workflow to finish.

The workflow builds with a repo-aware base path (for project pages like `/your-repo`) and publishes the static output from `out/`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Other Hosting Options

You can also deploy this app to other static hosts. See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
