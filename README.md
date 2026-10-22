# SafeSignal 🛡️
### Women's Incident Reporting and Community Safety Dashboard

SafeSignal is a secure, responsive full-stack web application designed for women to submit confidential incident reports, and for authorized community coordinators and safety administrators to review reports, spot location-based danger clusters, and take deliberate action to contact verified responders.

> **CRITICAL SAFETY DISCLAIMER:** SafeSignal is an incident reporting and community coordination dashboard, **not an emergency response service**. Never claim that a report has been verified or that help has been dispatched. Do not automatically call police or emergency services. Users in immediate danger must contact their local emergency numbers (**112** or Women's Helpline **1091**).

---

## 1. Architecture & Key Assumptions

- **Reporting Principle**: Mobile-first, low-friction, anonymous by default. No account required for reporters. No GPS coordinates mandated.
- **Privacy Boundary**: Public endpoints expose zero reporter identities, images, or incident lists. Image files are stripped of EXIF/GPS metadata and stored privately outside public web directories.
- **Aggregation Engine**: Automatically normalizes place names (collapsing punctuation, whitespace, and applying canonical place mappings). Calculates report clusters within a configurable rolling time window (default: 24 hours). When the count reaches the threshold (default: 5), it creates or updates a persistent alert for administrators without spamming duplicate alerts.
- **Deliberate Responder Action**: Admin contact actions are strictly deliberate. The system requires reviewing the alert and clicking a confirmation step before opening a phone dial link (`tel:`) or copying numbers. Every action is logged to an immutable audit trail without recording sensitive personal data.
- **Database Engine**: Production MySQL 8.0 with `mysql2` parameterized queries, versioned SQL migrations, and seed scripts. Includes an automatic embedded dev data store so tests and local UI run immediately out-of-the-box even before MySQL daemon/Docker starts.

---

## 2. Monorepo Project Structure

```text
safesignal/
├── client/                     # React.js + Vite frontend
│   ├── src/
│   │   ├── components/         # Navbar, ReportForm, ReportSuccess
│   │   ├── pages/              # PublicReportPage, AdminLoginPage, AdminDashboardPage
│   │   ├── services/           # REST API client with credentials & auth token support
│   │   ├── App.jsx             # React Router routing
│   │   ├── index.css           # Design tokens, accessibility focus rings, animations
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── server/                     # Node.js + Express.js REST API
│   ├── src/
│   │   ├── controllers/        # reportController.js, adminController.js
│   │   ├── db/                 # MySQL pool, query wrapper & fallback engine
│   │   ├── middleware/         # auth.js, rateLimiter.js, upload.js
│   │   ├── routes/             # reportRoutes.js, adminRoutes.js
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── services/           # aggregationService.js, storageService.js, auditService.js
│   │   ├── utils/              # normalizer.js, reference ID generator, IP hasher
│   │   ├── app.js              # Express app setup, CORS, security headers
│   │   └── server.js           # Server bootstrap & cluster sync
│   ├── tests/                  # 15 Unit & Integration test suites
│   │   ├── unit/               # validation, aggregation, storage tests
│   │   └── integration/        # end-to-end API & auth flow tests
│   ├── package.json
│   └── .env
├── database/                   # Versioned SQL migrations & seed data
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql                # Includes 5-report KPHB Metro sample cluster
├── storage/                    # Private local image storage (outside public directory)
│   └── uploads/
├── docker-compose.yml          # Local MySQL 8.0 and optional MinIO storage
├── .env.example                # Documented configuration template
├── package.json                # Monorepo root scripts
└── README.md
```

---

## 3. Prerequisites

- **Node.js**: v18.0.0 or later (v20+ or v24 recommended)
- **npm**: v9.0.0 or later
- **Docker & Docker Compose** (optional for running local containerized MySQL)

---

## 4. Quick Start & Setup

### 1. Install Dependencies
From the repository root:
```bash
npm install --prefix server
npm install --prefix client
```

### 2. Configure Environment Variables
Copy `.env.example` to `server/.env` (or use the preconfigured default):
```bash
cp .env.example server/.env
```

Key environment settings:
```ini
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=safesignal_user
DB_PASSWORD=safesignal_password
DB_NAME=safesignal
SESSION_SECRET=safesignal_development_secret_change_in_production_991823
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=../storage/uploads
DEFAULT_ALERT_THRESHOLD=5
DEFAULT_ALERT_WINDOW_HOURS=24
```

### 3. Run MySQL (Docker Compose) & Apply Migrations
If Docker is installed:
```bash
docker compose up -d
npm run migrate
```
*Note: If Docker is not running, SafeSignal automatically activates its local storage engine with 100% MySQL syntax compatibility so development and testing can proceed seamlessly.*

### 4. Seed Sample Data (Includes KPHB Metro Cluster)
```bash
npm run seed
```
This seeds:
- **Default Administrator**: `admin` / `Admin@SafeSignal2026!`
- **Sample Reports**: 5 reports near **KPHB Metro** within the last 24 hours (triggers the alert immediately), plus surrounding reports in Hitec City and Gachibowli.
- **Configured Responders**: Transit Patrol, SafeWalk Volunteer Network, Women's Counseling Support, Campus Security.
- **Default Settings**: Threshold = 5, Window = 24 hours.

---

## 5. Running the Application

### Start Backend API:
```bash
npm run dev:server
# or
node server/src/server.js
```
API runs at: `http://localhost:5000` (Healthcheck: `http://localhost:5000/api/health`)

### Start Frontend Client:
In a separate terminal:
```bash
npm run dev:client
# or
npm --prefix client run dev -- --port 5173
```
Client runs at: `http://localhost:5173`

---

## 6. Default Admin Account & Access

Navigate to `http://localhost:5173/admin/login`:
- **Username**: `admin`
- **Password**: `Admin@SafeSignal2026!`

*(A convenient "Auto-fill Seed Credentials" button is provided on the login card for instant local testing).*

---

## 7. Running Tests

The test suite runs against Node's native runner with zero external runner overhead:
```bash
npm test
```
**Tests Covered (15 passing tests):**
- **Unit**:
  - `validation.test.js`: Zod report schemas, boundary limits, and input constraints.
  - `normalizer.test.js`: Punctuation normalization, acronym dots (e.g. `K.P.H.B.` → `kphb`), case folding.
  - `storage.test.js`: Magic byte signatures (JPEG, PNG, WebP), executable file rejection, EXIF stripping.
  - `aggregation.test.js`: Rolling 24-hour window counts, exclusion of out-of-window reports, separate place logic.
- **Integration**:
  - `api.test.js`: Full end-to-end flow:
    - Public submission returning reference ID (`SFR-2026-XXXXXX`) without leaking PII.
    - Blocking unauthenticated visitors from admin endpoints (401).
    - Admin login, HTTP-only session cookie issuance, dashboard overview metrics.
    - Report status update and audit trail logging.
    - Deliberate responder contact initiation and audit logging.

---

## 8. Feature Deep-Dive

### User Reporting Experience (`/`)
- **Quick Exit Button (`ESC` key)**: Redirects immediately to Google Search / Weather if someone approaches the reporter's device.
- **No Account Required**: Completely anonymous submission by default.
- **Recognizable Place Selection**: Autocomplete suggestions (e.g., KPHB Metro, Hitec City) plus freeform manual entry. Optional landmark/gate field. No GPS forced.
- **Optional Geolocation**: If requested, requires explicit consent dialog and records approximate coordinates only.
- **Private Media Upload**: Supports up to 3 photos (JPEG, PNG, WebP ≤ 5MB). Strips EXIF camera and GPS metadata automatically upon upload.
- **Reference ID**: On success, displays an opaque reference code (e.g. `SFR-2026-478CE4`) for follow-up without disclosing personal data.

### Administrator Control Center (`/admin`)
- **Overview Cards**: Total reports, rolling window count, locations at/above threshold, and reports awaiting review.
- **Place-Based Alert Banner**: Prominently highlights clusters reaching the configured threshold (e.g. *"5 reports near KPHB Metro in the last 24 hours — review reports"*). Links directly to filtered report tables.
- **Report Table**: Sortable & filterable by place, category, status, and time range. Displays rolling 24h count pill. Sensitive contact details and raw images are suppressed from the bulk list.
- **Detail View Modal**: Inspects full description, authorized private images, and reveals optional contact information behind an audit-logged privacy boundary.
- **Deliberate Responder Action Modal**:
  - Explicit confirmation checkbox required before opening phone instructions.
  - Shows configured contact name, category, phone number, and operating instructions.
  - Copies phone number or triggers `tel:` link.
  - Records an immutable audit log entry without storing personal numbers.
- **Threshold Settings**: Modify threshold count (1-100) and rolling window (1-168 hours). Updates trigger instant recalculation of active clusters.
- **Audit Trail**: Complete log of admin logins, status changes, contact viewings, and responder contact actions.

---

## 9. Security & Privacy Guarantees

1. **Authentication & Authorization**: Server-side session verification via HMAC tokens stored in HTTP-only, SameSite cookies.
2. **SQL Injection Protection**: All MySQL operations use parameterized queries (`?` placeholders).
3. **No Public Bulk Exposure**: Search engine robots are blocked, and reports are never served on public endpoints.
4. **File Safety**: Uploads are inspected for binary magic bytes, rejecting executables and scripts.
5. **Rate Limiting**: Express rate limiters protect report submissions (30 / 15m) and admin login attempts (10 / 15m).
6. **Data Minimization**: Passwords, contact numbers, and IP hashes are excluded from error messages, logs, and public responses.

---

## 10. Production Deployment Guide (Vercel + Render + Cloud MySQL)

This section provides the complete step-by-step procedure for deploying SafeSignal in production using the selected **Modern Multi-Cloud Architecture**.

### 10.1 Architecture & Costs Overview

| Service Tier | Selected Provider | Plan / Tier | Expected Cost | Notes |
|---|---|---|---|---|
| **Frontend** | Vercel (or Cloudflare Pages) | Hobby / Free | **$0.00 / mo** | Global edge CDN, automated SSL, custom domain |
| **Backend REST API** | Render | Free or Starter ($7/mo) | **$0.00 - $7.00 / mo** | Node.js web service with `/api/health` monitoring |
| **Database** | Aiven MySQL (or PlanetScale) | Free (5GB) or $10/mo | **$0.00 - $10.00 / mo** | Encrypted TLS connections, automated daily backups |
| **Object Storage** | Cloudflare R2 (or AWS S3) | Free (10GB) | **$0.00 / mo** | $0 egress fees, private encrypted S3-compatible bucket |
| **Custom Domain & SSL** | Namecheap/Porkbun/Cloudflare | Optional | **~$10 / year** | Free `*.vercel.app` and `*.onrender.com` URLs provided |

---

### 10.2 Step 1: Provision Managed MySQL Database (Aiven or PlanetScale)

1. Sign up at [Aiven.io](https://aiven.io) (Free tier available) or [PlanetScale.com](https://planetscale.com).
2. Create a new **MySQL 8.0** service:
   - Cloud Provider: AWS or GCP (choose a region close to your users, e.g., `ap-south-1` Mumbai or `us-east-1`).
   - Service Name: `safesignal-mysql-prod`
   - Database Name: `safesignal_prod`
3. Copy the connection details from the provider dashboard:
   - `Host` (`DB_HOST`)
   - `Port` (`DB_PORT`, default: `3306` or provider port)
   - `User` (`DB_USER`, e.g. `avnadmin`)
   - `Password` (`DB_PASSWORD`)
   - SSL is required: set `DB_SSL=true`.

---

### 10.3 Step 2: Apply Database Migrations & Create First Admin

Run database migrations from your local terminal against the newly created production MySQL instance (controlled release step; never run seed scripts in production):

```bash
# Run migrations to create production tables
DB_HOST=your-mysql-hostname.aivencloud.com \
DB_PORT=your-port \
DB_USER=your-user \
DB_PASSWORD="your-strong-db-password" \
DB_NAME=safesignal_prod \
DB_SSL=true \
npm run migrate
```

Next, create the first administrator account safely without hard-coding passwords:

```bash
DB_HOST=your-mysql-hostname.aivencloud.com \
DB_PORT=your-port \
DB_USER=your-user \
DB_PASSWORD="your-strong-db-password" \
DB_NAME=safesignal_prod \
DB_SSL=true \
npm run create-admin
```
Follow the interactive prompt to set the admin username, email, and a strong password (minimum 10 characters).

---

### 10.4 Step 3: Setup Private Object Storage (Cloudflare R2 or AWS S3)

To ensure evidence photos are never stored on an ephemeral server filesystem:
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** (or AWS S3).
2. Create a private bucket: `safesignal-private-evidence`.
3. In **R2 API Tokens**, create a token with **Object Read & Write** permissions.
4. Note your credentials:
   - `S3_BUCKET`: `safesignal-private-evidence`
   - `S3_ACCESS_KEY_ID`: `<your-r2-access-key>`
   - `S3_SECRET_ACCESS_KEY`: `<your-r2-secret-key>`
   - `S3_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com` (leave empty if using standard AWS S3)
   - `S3_REGION`: `auto` (or `us-east-1`)

---

### 10.5 Step 4: Deploy Backend API to Render

1. Log in to [Render](https://render.com).
2. Click **New +** → **Web Service** and connect your SafeSignal GitHub/GitLab repository.
3. Configure the service settings:
   - **Name**: `safesignal-api`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
4. Add the following **Environment Variables** in the Render dashboard:

| Variable Name | Example / Setting |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` (or leave default, assigned by Render) |
| `CLIENT_ORIGIN` | `https://your-safesignal.vercel.app` (your frontend domain) |
| `SESSION_SECRET` | Click **Generate** on Render (generates a random 256-bit string) |
| `COOKIE_SAME_SITE` | `none` |
| `COOKIE_SECURE` | `true` |
| `DB_HOST` | `your-mysql-hostname.aivencloud.com` |
| `DB_PORT` | `3306` (or provider port) |
| `DB_USER` | `your-db-user` |
| `DB_PASSWORD` | `your-db-password` |
| `DB_NAME` | `safesignal_prod` |
| `DB_SSL` | `true` |
| `STORAGE_DRIVER` | `s3` |
| `S3_BUCKET` | `safesignal-private-evidence` |
| `S3_ACCESS_KEY_ID` | `<your-key-id>` |
| `S3_SECRET_ACCESS_KEY` | `<your-secret-key>` |
| `S3_ENDPOINT` | `<your-r2-endpoint-url>` (optional for R2/MinIO) |
| `S3_REGION` | `us-east-1` (or `auto`) |

5. Click **Create Web Service**. Render will build and launch your API at `https://safesignal-api.onrender.com`.
6. Verify API healthcheck by visiting: `https://safesignal-api.onrender.com/api/health` (should return `{"status":"healthy"}`).

---

### 10.6 Step 5: Deploy Frontend React Client to Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** → **Project** and import your repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click Edit and select `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In **Environment Variables**, add:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://safesignal-api.onrender.com/api` (your deployed Render API URL + `/api`)
5. Click **Deploy**. Vercel will build the frontend and provide your production URL (e.g. `https://safesignal.vercel.app`).
6. **Important CORS Step**: Return to your Render dashboard for `safesignal-api`, set `CLIENT_ORIGIN` to your exact Vercel URL (`https://safesignal.vercel.app`), and save.

---

### 10.7 Step 6: Connect Custom Domain & Enable HTTPS (Optional)

1. **Frontend Domain (`safesignal.org`)**:
   - In Vercel Project Settings → **Domains**, add `safesignal.org` and `www.safesignal.org`.
   - In your DNS provider (Cloudflare, Namecheap, GoDaddy), create an `A` record pointing `@` to `76.76.21.21` and a `CNAME` pointing `www` to `cname.vercel-dns.com`.
   - Vercel automatically provisions and renews SSL certificates via Let's Encrypt.
2. **API Subdomain (`api.safesignal.org`)**:
   - In Render Web Service → **Custom Domains**, add `api.safesignal.org`.
   - In your DNS provider, create a `CNAME` record for `api` pointing to your Render service address (e.g. `safesignal-api.onrender.com`).
   - Render automatically issues a TLS certificate.
3. Update environment variables to match your custom domains:
   - In Render: `CLIENT_ORIGIN=https://safesignal.org,https://www.safesignal.org`
   - In Vercel: `VITE_API_BASE_URL=https://api.safesignal.org/api`

---

### 10.8 Step 7: Automated Deployment Verification

After deployment, run the automated verification script against your live production API:

```bash
API_URL=https://safesignal-api.onrender.com/api npm run verify-deployment
```

This verifies:
- Healthcheck endpoint is live and returns 200 OK without disclosing secrets.
- Public emergency disclaimers (112 / 1091) and privacy policies are active.
- Unauthenticated requests to `/api/admin/reports` return 401 Unauthorized.
- Brute-force protection and generic authentication error handling are active.

---

### 10.9 Operations, Backups, & Data Retention

1. **Inspecting Production Logs**:
   - On Render, view live streaming logs under the **Logs** tab.
   - SafeSignal sanitizes all logs: reporter contact information, plain text descriptions, and raw image URLs are never printed to stdout.
2. **Database Backups & Disaster Recovery**:
   - Aiven and PlanetScale automatically take daily automated snapshots with Point-in-Time Recovery (PITR).
   - To export a manual SQL backup:
     ```bash
     mysqldump -h your-host -u your-user -p --ssl safesignal_prod > backup_$(date +%Y%m%d).sql
     ```
3. **Data Retention & Anonymization Policy**:
   - SafeSignal enforces a configurable retention policy (`retention_days`, default 365 days).
   - Old records can be marked `closed` or deleted along with their associated private S3 object keys.

