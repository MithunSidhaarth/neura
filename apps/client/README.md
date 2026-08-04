This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## AI features (optional but recommended)

The "Explain with AI," "Expand with AI," and chat panel features call
[Groq](https://console.groq.com/keys) server-side. To enable them:

```bash
cp .env.local.example .env.local
# then edit .env.local and set GROQ_API_KEY=<your key>
```

Everything else (the graph, search, Wikipedia expansion) works without
this — only the AI-specific actions will show an error until it's set.

"Expand topic with AI" (the button in the info panel that used to be
labeled "Debate with AI") also runs on `GROQ_API_KEY` -- no separate
key needed. Groq's main model stakes out 3-4 claims about the selected
topic, then a second, faster Groq model rebuts each one directly. (This
used to run the rebuttal side on a separate provider, Cerebras, so a
chatty debate wouldn't share Groq's per-minute rate-limit budget with
every other AI feature in the app -- that provider's free-tier account
hit its billing quota, so both debate surfaces now run on Groq alone;
see the MODEL_AGAINST comment in `app/api/ai/route.ts` for the current
trade-off.) Each claim/rebuttal pair is dropped into the graph as a
mirrored, color-coded pair of neurons linked by a crackling "conflict"
edge, and every neuron on the same side (all claims, all rebuttals) is
additionally interlinked with the others on its side, so each side
reads as its own connected, same-colored cluster. Live Debate Mode (the
"Debate" toolbar button) uses the same two-model split for the same
reason.

## Getting Started

First, run the development server:

```bash
yarn dev
# or
npm run dev
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
