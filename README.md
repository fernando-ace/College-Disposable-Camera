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
- Local development photo storage with a small storage helper layer

## Project Structure

```text
/client
  React + Vite + Tailwind web app

/server
  Express API
  Prisma schema
  Local uploads folder for development
```

## Requirements

- Node.js 20+
- PostgreSQL
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
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB="10"
PORT="4000"
```

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

3. From the repo root, configure environment files.

```powershell
copy server\.env.example server\.env
copy client\.env.example client\.env
```

4. Run Prisma migration.

```bash
cd server
npm run prisma:migrate
```

5. Start the backend.

```bash
cd server
npm run dev
```

6. Start the frontend in another terminal.

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

- Local file storage is for development only. Move the storage helper to S3, Cloudflare R2, or Supabase Storage before production.
- Deleted photos are soft-deleted in the database and removed from disk.
- Payment is manual for MVP testing. The landing page includes pricing, but Stripe is intentionally not implemented.
- There is no email verification or password reset yet.
- The public image file endpoint uses hard-to-guess photo IDs. For production, add signed URLs or authenticated object storage access.

## Next Steps

- Add hosted object storage.
- Add image thumbnail generation for faster album loading.
- Add a simple host password reset flow.
- Add deployment configuration for the chosen hosting provider.
- Add basic event capacity limits based on selected pricing tier.
