# JobFly

JobFly is a React + Vite job portal hosted on Netlify. Firebase Authentication handles accounts and Cloud Firestore stores job listings and applications. The original Django application and SQLite database remain in the repository, but are not used by the new frontend.

The first release includes public job search, category and location filters, job details, job-seeker/employer registration, login, and job applications. Employer dashboards and job posting are planned for a later phase.

## Current deployment

The frontend is published at [jobfly-shakon53.netlify.app](https://jobfly-shakon53.netlify.app). The dedicated Firebase project [`jobfly-shakon53-prod`](https://console.firebase.google.com/project/jobfly-shakon53-prod/overview) and its Web app have been created. Firestore is not active yet, so live listings, accounts, and applications remain unavailable until the database and Email/Password authentication are enabled and the Netlify environment variables are set.

## Run locally

1. Install Node.js 22 or newer.
2. Install frontend dependencies:

   ```powershell
   npm install --prefix frontend
   ```

3. Copy `frontend/.env.example` to `frontend/.env.local` and add the Firebase web app configuration values.
4. Start the frontend:

   ```powershell
   npm run dev --prefix frontend
   ```

Without Firebase settings, local development uses clearly labelled sample listings; accounts and applications are disabled.

## Set up Firebase

1. Open the existing [JobFly Firebase project](https://console.firebase.google.com/project/jobfly-shakon53-prod/overview). Its Web app is already registered.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. Create the Cloud Firestore database in `asia-south1` (Mumbai). The region cannot be changed later.
4. Deploy the Firestore security rules and query index from this repository. Install and authenticate the Firebase CLI if needed, then run:

   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes --project YOUR_FIREBASE_PROJECT_ID
   ```

   Alternatively, publish `firestore.rules` using the Firestore Rules console. The composite job-listing index is in `firestore.indexes.json`.
5. In **Project settings → General → Your apps**, copy the Web app config values into `frontend/.env.local`:

   ```dotenv
   VITE_FIREBASE_API_KEY=your-web-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_APP_ID=your-web-app-id
   ```

   These Firebase web configuration values are intended for client apps. Never place service-account credentials or private keys in the frontend.
6. In **Authentication → Settings → Authorized domains**, add `jobfly-shakon53.netlify.app` and `localhost`.

The Firestore rules keep user profiles private, allow public reads of active jobs and categories, and restrict applications to their signed-in job-seeker owner. An application's initial status is fixed to `pending`, and duplicate applications use a deterministic document ID.

### Add initial content

The MVP does not yet include an employer job-posting dashboard. Add category documents to the `categories` collection and job documents to `jobs` in the Firebase console. Job documents need `title`, `description`, `requirements`, `location`, `job_type`, `posted_at` (a Firestore timestamp), `is_active` (boolean), `category_name`, `company_name`, and `company_industry`. `job_type` must be `full_time`, `part_time`, `contract`, or `internship`. `salary` and `deadline` are optional.

## Deploy to Netlify

The site is already published at the URL above. Add these variables in **Netlify → Site configuration → Environment variables**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Trigger a new deploy after saving the environment variables. `netlify.toml` configures the `frontend` build and SPA route fallback.

## Build and lint

```powershell
npm run build --prefix frontend
npm run lint --prefix frontend
```

The previous Supabase project was not changed. Its schema is not used by this Firebase-backed frontend; migrate data separately if existing Supabase or Django records need to be retained.
