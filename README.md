# Auburn Disposable Camera / EventFilm

Mobile-first MVP for QR-based disposable camera albums at college events.

## What Works

- Host sign up, login, logout with JWT auth
- Host dashboard with event list and photo counts
- Event creation with a hard-to-guess public slug
- Event link and QR code generation
- Public guest event page at `/e/:eventSlug`
- Guest nickname stored in local storage
- Guest image upload without an account
- Per-guest upload limits
- Reveal lock for guest album viewing
- Host photo viewing before and after reveal
- Host photo deletion
- Host download of all event photos as a `.zip`
- Supabase Storage-backed photo files with a small storage helper layer

## Project Structure

```text
/client
  React + Vite + Tailwind web app

/server
  Express API
  Prisma schema
  Supabase Storage helper for image files
```

## Requirements

- Node.js 20+
- PostgreSQL
- Supabase project with a private Storage bucket
- npm

On Windows, PostgreSQL can be installed with:

```powershell
winget install PostgreSQL.PostgreSQL.17 --silent --accept-package-agreements --accept-source-agreements
```

The default local development connection used by this project is:

```text
postgresql://postgres:postgres@localhost:5432/eventfilm?schema=public
```

## Environment Variables

Backend: copy `server/.env.example` to `server/.env`.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eventfilm?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
CLIENT_URL="http://localhost:5173"
SERVER_URL="http://localhost:4000"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="replace-with-your-service-role-key"
SUPABASE_STORAGE_BUCKET="event-photos"
MAX_FILE_SIZE_MB="10"
PORT="4000"
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. Do not expose it in the
client app or commit a real key.

Frontend: copy `client/.env.example` to `client/.env`.

```env
VITE_API_URL="http://localhost:4000"
```

## Local Setup

1. Install dependencies.

```bash
cd server
npm install

cd ../client
npm install
```

2. Create a PostgreSQL database named `eventfilm`.

```powershell
$env:PGPASSWORD="postgres"
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -h localhost -U postgres eventfilm
```

3. Create a Supabase Storage bucket for uploaded photos.

In Supabase, create a private bucket named `event-photos`, or set
`SUPABASE_STORAGE_BUCKET` to the bucket name you choose. The server uses the
service role key to upload, fetch, and remove objects while continuing to serve
photos through the existing API routes.

4. From the repo root, configure environment files.

```powershell
copy server\.env.example server\.env
copy client\.env.example client\.env
```

5. Run Prisma migration.

```bash
cd server
npm run prisma:migrate
```

6. Start the backend.

```bash
cd server
npm run dev
```

7. Start the frontend in another terminal.

```bash
cd client
npm run dev
```

Open `http://localhost:5173`.

## MVP Test Flow

Host:

1. Sign up.
2. Log in.
3. Create an event.
4. Copy the event link or download the QR code.
5. Open the manage event page.
6. See uploaded photos.
7. Delete a photo.
8. Download all photos as a zip.

Guest:

1. Open the event link without logging in.
2. Enter a nickname.
3. Upload photos from phone or computer.
4. See remaining uploads.
5. See the album locked before reveal time.
6. View the album after reveal time.

## Known Limitations

- Deleted photos are soft-deleted in the database and removed from Supabase Storage.
- Payment is manual for MVP testing. The landing page includes pricing, but Stripe is intentionally not implemented.
- There is no email verification or password reset yet.
- The public image file endpoint uses hard-to-guess photo IDs and proxies private Supabase objects through the API.

## Private Beta Deployment Notes

- Provision a hosted PostgreSQL database and run Prisma migrations before starting the server.
- Create the private Supabase Storage bucket named by `SUPABASE_STORAGE_BUCKET`.
- Configure backend environment variables on the deployment host: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `SERVER_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `MAX_FILE_SIZE_MB`, and `PORT`.
- Configure the frontend deployment with `VITE_API_URL` pointing at the deployed API.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in the backend environment.
- Verify the private beta flow after deployment: host signup/login, event creation, guest upload, host list, guest reveal list, host delete, direct photo view, and zip download.

## Vercel Frontend Deployment

Use the `/client` directory as the Vercel project root.

```text
Root directory: client
Build command: npm run build
Output directory: dist
```

Required frontend environment variables:

```env
VITE_API_URL="https://your-deployed-api-domain"
```

`VITE_API_URL` must point at the deployed API base URL and should not include a
trailing path such as `/api`.

## Railway Backend Deployment

Use the `/server` directory as the Railway service root.

```text
Root directory: server
Build command: npm run build
Start command: npm start
```

The build command runs `prisma generate`. The `prestart` script also runs
`prisma generate` before `node src/index.js`, so Prisma Client is available
when Railway starts the API.

Run production migrations against the Railway database before first use and
whenever new migrations are added:

```bash
npm run prisma:deploy
```

Required backend environment variables:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="long-random-secret"
CLIENT_URL="https://your-frontend-domain"
SERVER_URL="https://your-railway-api-domain"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_STORAGE_BUCKET="event-photos"
MAX_FILE_SIZE_MB="10"
PORT="4000"
```

Railway normally provides `PORT` automatically. If it is not set, the server
falls back to `4000`.

## Next Steps

- Add image thumbnail generation for faster album loading.
- Add a simple host password reset flow.
- Add basic event capacity limits based on selected pricing tier.
