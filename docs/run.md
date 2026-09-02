# AfsanehSaz — Local Environment Run Guide

Welcome to **AfsanehSaz**! This guide walks you through setting up, configuring, and running the entire AfsanehSaz stack locally on your development machine.

---

## 🏗️ System Architecture Overview

AfsanehSaz consists of two main projects:

1. **`web/` — Web Backend, AI Director & Studio Suite**
   - **Framework:** Next.js 16 App Router (Node.js / TypeScript)
   - **Database & ORM:** PostgreSQL 16 + Prisma 7 ORM
   - **AI Engine:** Google Gemini (`@google/genai` with Gemini 3.7 / 3.5 models)
   - **Studio Web UI:** World Bible editor, RPG mechanics configurator, and 3D D20 dice calibration studio.
   - **API Endpoints:** `/api/play/*` (game session and turn progression API) and `/api/studio/*` (authoring).

2. **`app/` — Cross-Platform Reader Client**
   - **Framework:** Flutter 3.24+ / 3.47+ (Dart 3.8+)
   - **State Management:** Riverpod 2.6+
   - **Features:** Rich reader with dark themes, bilingual Persian/English typography, collapsible RPG character sheet, and embedded 3D D20 physics dice.

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:

| Tool | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` LTS (or `v18+`) | Next.js API server & Studio |
| **npm** / **pnpm** | `v10+` | Package manager for `web/` |
| **Docker & Compose** | Latest | Local PostgreSQL 16 database |
| **Flutter SDK** | `v3.24+` (Dart `3.8+`) | Cross-platform reader app |
| **Gemini API Key** | Google AI Studio key | AI narrative generation |

---

## 🚀 Quick Start (Step-by-Step)

### Step 1: Start the PostgreSQL Database

AfsanehSaz includes a `docker-compose.yml` configured for PostgreSQL 16.

From the project root directory:
```bash
docker compose up -d
```

To verify that the database container is running and healthy:
```bash
docker compose ps
```
> **Default PostgreSQL Connection:**
> `postgresql://postgres:postgrespassword@localhost:5432/storyforge?schema=public`

---

### Step 2: Configure & Run the Backend (`web/`)

1. **Navigate to the `web/` directory:**
   ```bash
   cd web
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create or verify `web/.env`:
   ```env
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/storyforge?schema=public"
   GEMINI_API_KEY="your_gemini_api_key_here"
   ```

4. **Initialize Database Schema with Prisma 7:**
   ```bash
   npx prisma migrate dev --name init
   ```

   > [!IMPORTANT]
   > **Prisma 7 Configuration Rule**: Connection URLs in Prisma 7 are managed via `prisma.config.ts` or environment variables at runtime. **Never** add `url = env(...)` inside `datasource db` in `schema.prisma`.

5. **Start the Next.js Development Server:**
   ```bash
   npm run dev
   ```

   The server will start on **`http://localhost:3000`**.

#### 🔗 Key Backend & Studio URLs:
- **Story Library & Reader Portal:** `http://localhost:3000`
- **AfsanehSaz Studio (World Bible & Authoring):** `http://localhost:3000/studio`
- **3D D20 Dice Calibration Studio:** `http://localhost:3000/studio/dice-calibrate`
- **Catalog API:** `http://localhost:3000/api/play/stories`

---

### Step 3: Run the Flutter Reader App (`app/`)

Open a new terminal window and navigate to the `app/` directory:

1. **Navigate to `app/`:**
   ```bash
   cd app
   ```

2. **Install Flutter packages:**
   ```bash
   flutter pub get
   ```

3. **Run on your target platform:**

#### Option A: Web Browser (Chrome)
```bash
flutter run -d chrome
```
*Connects automatically to `http://localhost:3000`.*

#### Option B: Android Emulator
1. **List and start your Android emulator:**
   ```bash
   # Check available emulators
   flutter emulators

   # Launch your configured emulator (e.g. Medium_Phone_API_36.0)
   flutter emulators --launch Medium_Phone_API_36.0
   ```
   *(Alternatively, launch it directly from Android Studio > Device Manager or the IDE status bar).*

2. **Run AfsanehSaz on the booted emulator:**
   ```bash
   flutter run -d android
   ```
*Connects automatically to `http://10.0.2.2:3000` (the host loopback interface).*

#### Option C: Windows Desktop
```bash
flutter run -d windows
```
*Connects automatically to `http://127.0.0.1:3000`.*

#### Option D: Physical Android / iOS Device over Wi-Fi
If testing on a physical phone connected to the same Wi-Fi network:
1. Find your machine's local LAN IP address (e.g. `192.168.1.150` via `ipconfig` or `ifconfig`).
2. In [`app/lib/services/game_api_service.dart`](file:///g:/Code/AfsanehSaz/app/lib/services/game_api_service.dart#L10), set `baseUrl` to `http://192.168.1.150:3000`.
3. Launch with `flutter run`.

---

## 🧪 Running Automated Tests

### Backend Unit Tests (Deterministic Game Engine & Action Validator)
Run the test suite in `web/` to verify deterministic state mutations, DC checks, and guardrails:
```bash
cd web
npm test
```

### Flutter Static Analysis
Verify reader app code quality and lint rules:
```bash
cd app
flutter analyze
```

---

## 🛠️ Troubleshooting & FAQ

### 1. `خطا در ارتباط با سرور` (Server Connection Error)
- **Cause:** The Next.js dev server is either not running, or there is a stale build cache in `.next/`.
- **Fix:**
  ```powershell
  # In web/ directory:
  Remove-Item -Recurse -Force .next
  npm run dev
  ```

### 2. Database Connection Refused (`P1001`)
- **Cause:** PostgreSQL container is stopped.
- **Fix:** Run `docker compose up -d` in the root directory and ensure port `5432` is not occupied by another local Postgres instance.

### 3. Android Emulator Network Cleartext
- The app is configured with `http` communication for local dev (`http://10.0.2.2:3000`). If experiencing cleartext traffic blocks on older Android SDKs, ensure `android:usesCleartextTraffic="true"` remains enabled in `AndroidManifest.xml`.

### 4. Git Push Timeout (`HTTP 408`)
- AfsanehSaz `.gitignore` excludes large binary artifacts (`*.jar`, `*.aar`, `.next/`).
- If pushing large assets, increase Git buffer:
  ```bash
  git config http.postBuffer 524288000
  ```

---

## 📂 Project Directory Structure

```text
AfsanehSaz/
├── docker-compose.yml          # Local PostgreSQL 16 service
├── MASTER_PLAN.md              # Technical specification & roadmap
├── docs/                       # Project documentation
│   └── run.md                  # This run guide
├── web/                        # Next.js 16 Web Backend & Studio
│   ├── src/
│   │   ├── app/                # Next.js App Router (Studio & /api/play/*)
│   │   ├── components/         # React Studio & 3D Dice components
│   │   ├── content/stories/    # Built-in Story World Bibles & Manifests
│   │   └── lib/
│   │       ├── engines/        # GameEngine, ActionValidator, PromptAssembler
│   │       ├── db/             # Prisma 7 client & repositories
│   │       └── providers/      # Gemini AI Adapter
│   ├── prisma/                 # Database schema & migrations
│   └── package.json
└── app/                        # Flutter Cross-Platform Reader Client
    ├── lib/
    │   ├── models/             # GameState, GameItem, Story schemas
    │   ├── providers/          # Riverpod game session state notifier
    │   ├── services/           # GameApiService (REST client)
    │   └── ui/                 # ReaderScreen, StoryCatalogScreen, RPG HUD
    └── pubspec.yaml
```
