# ViralForge 🚀

ViralForge is an AI-powered social media content generation pipeline. It learns from viral references, generates new content ideas using Google's Gemini Multimodal models, creates mocked visual assets (simulating fal.ai), and schedules them for simulated automatic publishing.

## 🌟 Features

1. **Multimodal Analysis**: Upload reference images or paste social media URLs. Gemini 2.5 Flash breaks down the visual style, caption structure, hooks, and content pillars.
2. **AI Content Generation**: Generates batches of ready-to-use content ideas based on the learned profile using Gemini.
3. **Asset Generation Pipeline**: Approving an idea triggers an Inngest background worker to generate the final media (currently mocked still-image/delay; true FFmpeg video/asset generation is not complete and requires implementation).
4. **Automated Publishing**: Background workers check the schedule every minute and mock-publish your posts.
5. **Next.js 16 App Router**: Uses the latest features including async server components and server actions.

## 🛠️ Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 & Shadcn UI
- **Database/Auth**: Supabase (PostgreSQL, Auth, Storage)
- **Background Jobs**: Inngest
- **AI Models**: Google Gemini (`@google/genai`)

## 🚀 Getting Started

### 1. Prerequisites

You'll need API keys for:
- [Supabase](https://supabase.com) (Create a new project)
- [Inngest](https://www.inngest.com)
- [Google AI Studio](https://aistudio.google.com/) (Gemini API)

### 2. Environment Setup

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

INNGEST_EVENT_KEY=local
INNGEST_SIGNING_KEY=local

GEMINI_API_KEY=your_gemini_key
```

### 3. Database Setup

Run the migrations to create tables and RLS policies (Note: `npx supabase init` is only for new directories, as this project is already initialized):

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

### 4. Running Locally

You need two terminal windows:

Terminal 1: Next.js Dev Server
```bash
npm run dev
```

Terminal 2: Inngest Dev Server (for background jobs)
```bash
npx inngest-cli@latest dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## 🗄️ Architecture Overview

The background job architecture is built on Inngest to avoid Vercel serverless timeouts (which usually cap at 10 seconds on the free tier). 

1. `viralforge/project.analyze`: Triggered when references are uploaded. Calls Gemini with images.
2. `app/generate-ideas`: Triggered manually. Calls Gemini to generate 5 JSON ideas.
3. `app/generate-media`: Triggered when an idea is approved.
4. `publish-scheduled-posts`: Cron job running `* * * * *` to check for due posts.

## 📝 Testing

1. Setup the `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` environment variables.
2. Link supabase and run migrations (`npx supabase db push`).
3. Set the credentials in `seed.ts` to match the emails / passwords you desire, and configure the project ID correctly in the script.
4. Run `npx tsx seed.ts` to initialize the project and load references and generation examples.
5. Create an account on the UI through `/signup` and verify it in your Supabase Auth interface.
6. Run both the `npm run dev` and `npx inngest-cli@latest dev` servers.
7. Create a project in the Dashboard.
8. Upload some reference content (URL or image) into the project.
9. Click "Analyze References" — this calls the authenticated server action in `app/actions/analyze-actions.ts` to queue the analysis. Wait a moment and view the generated output directly in the UI.
10. Click "Generate Content Ideas", and after they are returned, approve one of them.
11. Watch the Calendar section to see the scheduled post and the background worker process mock the publishing pipeline.

## 🛑 Known Limitations

1. **Authentication:** Uses basic email/password authentication through Supabase. Magic links or OAuth are not implemented for simplicity.
2. **Scraping:** Instagram/LinkedIn scraping is a placeholder. A true implementation would require a dedicated proxy/scraping service like Apify to avoid rate-limiting and bans. For this PoC, only the manual upload path is verified; URL ingestion is not implemented for the required post and profile URL acceptance flow unless a working ingestion provider is added.
3. **Publishing:** Uses a mock publishing pipeline. True publishing requires app approvals (Facebook Graph API, LinkedIn API) which can take weeks and require business accounts. The background worker accurately simulates the retry/failure states of a real publishing pipeline.
4. **Video Generation:** Currently mocked with a delay and image generation. True video generation via APIs like fal.ai is expensive and slow; the architecture supports it but it's mocked to save on credits during the review phase.
