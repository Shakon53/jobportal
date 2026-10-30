# JobFly

JobFly is being migrated from a server-rendered Django app to a React + Vite frontend hosted on Netlify, with Supabase providing authentication and PostgreSQL.

The first release includes public job search, category and location filters, job details, job-seeker/employer sign-up, login, and job applications. Employer dashboards and job posting are planned for a later phase. The original Django project remains in the repository during the migration.

## Current deployment

The frontend is published at [jobfly-shakon53.netlify.app](https://jobfly-shakon53.netlify.app). The live site currently shows a setup notice until a running Supabase project is connected and its public URL/key are added to Netlify.

## Run the frontend locally

1. Install Node.js 22 or newer.
2. Install frontend dependencies:

   ```powershell
   npm install --prefix frontend
   ```

3. Copy `frontend/.env.example` to `frontend/.env.local` and add your Supabase project URL and publishable (or legacy anon) key. These are public client settings; never put a Supabase `service_role` key in the frontend.
4. Start the development server:

   ```powershell
   npm run dev --prefix frontend
   ```

Without Supabase settings, the app opens in a clearly labelled preview mode with sample listings; accounts and applications are disabled.

## Create and configure Supabase

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the migration in [`supabase/migrations/20261030210000_initial_schema.sql`](./supabase/migrations/20261030210000_initial_schema.sql). It creates the MVP tables, starter categories, signup profile trigger, and row-level security policies.
3. In **Project Settings → API**, copy the Project URL and the publishable key (or legacy anon key) into `frontend/.env.local`:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-client-key
   ```

4. In **Authentication → URL Configuration**, set the local site URL to `http://localhost:5173`. Add the Netlify site URL to the redirect allow list after deployment.
5. Email confirmation may be enabled by default. Configure email delivery before inviting public users; otherwise confirmation emails may be delayed or limited by Supabase's default email service.

The browser uses only the public publishable/anon key. Row-level security protects user records and applications; do not disable it or use the service-role key in the browser.

## Deploy to Netlify

1. Push this repository to GitHub and import it in Netlify.
2. Netlify reads [`netlify.toml`](./netlify.toml): base directory `frontend`, build command `npm run build`, publish directory `frontend/dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Site configuration → Environment variables**.
4. Trigger a deploy. The redirect rule in `netlify.toml` supports direct links to React routes.
5. Add the deployed `https://<site-name>.netlify.app` URL to Supabase's authentication redirect allow list.

## Build and lint

```powershell
npm run build --prefix frontend
npm run lint --prefix frontend
```

The old Django app and its local SQLite database have not been migrated or deleted. Existing Django data will need a separate data import if it should appear in the new Supabase project.
