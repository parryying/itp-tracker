# ITP Tracker

A mobile-first health monitoring app for tracking **Immune Thrombocytopenia (ITP)** — built with React Native (Expo) to help parents document symptoms, medications, lab results, and generate AI-powered clinical insights for doctor visits.

---

## Features

### 📊 Dashboard
- At-a-glance status: platelet count, bruise count, medication adherence
- Color-coded severity indicators (critical / warning / stable)
- Platelet trend sparkline with historical data
- AI analysis summary card with doctor question count
- Quick-action buttons for daily check-in, labs, and reports

### 📸 Daily Check-in (4-step guided flow)
1. **Photos** — Capture 6 body regions (arms, legs, torso, mouth) with guided overlays. Photos are stored in **Azure Blob Storage** (not your phone's photo album). AI detects and counts bruises, petechiae, and blisters.
2. **Symptoms** — Toggle checklist: bruises, petechiae, mouth blisters, nosebleed, gum bleeding, fatigue. Emoji-based energy scale.
3. **Notes** — Free-text fields for activities/events and general observations.
4. **Review** — Summary of the day's check-in before saving.
- **Day-over-day comparison**: Side-by-side photo diff with new/healing/resolved bruise counts.

### 🧪 Lab Results (MyChart Integration)
- **Auto-sync with Epic MyChart** via FHIR R4 API (OAuth2, patient-access)
- Supports **all lab panels** — not just CBC: CMP, coagulation, immunology, inflammatory markers, and more
- Expandable panels with color-coded flags (critical / warning / normal)
- Interactive platelet trend chart with threshold lines (30k severe, 50k moderate, 150k normal) and medication change markers
- **AI clinical interpretation**: MD-level reasoning that correlates across lab types, medication changes, and symptom trends

### 💊 Medications
- Daily dose checklist with timestamps
- Dosage history timeline with tapering visualization
- Side effect daily log (mood, appetite, weight, sleep, headache, etc.)
- Per-medication detail cards: current dose, frequency, start date, known side effects
- Add/edit/discontinue medications

### 📋 Reports & Doctor Questions
- **AI-generated discussion questions** — 3-7 specific, data-grounded questions prioritized by urgency, each with supporting clinical context
- **Full AI clinical summary** — comprehensive daily note covering hematology, hepatology, immunology, and physical assessment
- **Report history** — archive of past summaries for trend review
- **Export to PDF** — shareable doctor-ready report with labs, meds, photos, and questions
- Medical disclaimer included on all AI outputs

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native (Expo SDK 52) |
| **Navigation** | Expo Router (file-based, tab layout) |
| **Language** | TypeScript |
| **Icons** | @expo/vector-icons (Ionicons) |
| **Photo Storage** | Azure Blob Storage |
| **Lab Integration** | Epic on FHIR (R4) — MyChart OAuth2 |
| **AI Engine** | Azure OpenAI (GPT-4o) — clinical reasoning + vision |
| **Database** | Supabase (PostgreSQL) — planned |
| **Auth** | Supabase Auth — planned |

---

## Project Structure

```
itp-tracker/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab navigator (5 tabs)
│   │   ├── index.tsx          # Dashboard
│   │   ├── checkin.tsx        # Daily check-in flow
│   │   ├── labs.tsx           # Lab results + MyChart sync
│   │   ├── meds.tsx           # Medication tracker
│   │   └── reports.tsx        # AI reports & doctor questions
│   ├── _layout.tsx            # Root layout (theme, fonts)
│   ├── modal.tsx              # Modal screen
│   └── +not-found.tsx         # 404 screen
├── components/                # Shared UI components
├── constants/
│   └── Colors.ts              # Medical-themed color palette
├── services/
│   └── azureBlobService.ts    # Azure Blob Storage upload/download
├── assets/                    # Fonts, images
├── app.json                   # Expo config
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (iOS / Android)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/parryying/itp-tracker.git
cd itp-tracker

# Install dependencies
npm install

# Start the dev server
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `w` for web preview.

### Environment Variables

Create a `.env` file in the project root:

```env
# Azure Blob Storage
AZURE_STORAGE_ACCOUNT_NAME=itptrackerstorage
AZURE_STORAGE_CONTAINER_NAME=patient-photos
AZURE_STORAGE_SAS_TOKEN=your-sas-token-here

# Azure OpenAI (planned)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Epic MyChart (planned)
EPIC_CLIENT_ID=your-client-id
EPIC_REDIRECT_URI=itptracker://auth/callback
```

---

## Azure Setup

### Blob Storage (for photos)

Photos are uploaded directly to Azure Blob Storage — they never touch your phone's photo album.

```bash
# Create resource group
az group create --name itp-tracker-rg --location eastus

# Create storage account
az storage account create \
  --name itptrackerstorage \
  --resource-group itp-tracker-rg \
  --location eastus \
  --sku Standard_LRS

# Create container for photos
az storage container create \
  --name patient-photos \
  --account-name itptrackerstorage

# Generate SAS token (valid 1 year)
az storage container generate-sas \
  --name patient-photos \
  --account-name itptrackerstorage \
  --permissions rwdl \
  --expiry 2027-03-10 \
  --output tsv
```

### Cost (with free Azure credits): $0/mo
- ~500MB photos/month = < $0.01 storage + < $0.01 operations

---

## Roadmap

- [x] Dashboard with status cards and sparkline
- [x] Daily check-in flow (photos, symptoms, notes)
- [x] Lab results screen with expandable panels
- [x] Medication tracker with tapering timeline
- [x] AI reports & doctor discussion questions
- [x] Azure Blob Storage for photo uploads
- [ ] MyChart FHIR OAuth2 integration (auto-sync labs)
- [ ] Azure OpenAI integration (live AI analysis)
- [ ] Supabase backend (auth, database, real-time sync)
- [ ] Push notifications for medication reminders
- [ ] PDF report export
- [ ] Bruise detection ML model (Azure Custom Vision)
- [ ] Day-over-day photo comparison with overlay

---

## Privacy & Security

This app handles sensitive medical data for a minor. Key safeguards:

- **Photos stored in Azure Blob Storage** with encryption at rest (AES-256)
- **No photos saved to device photo album**
- **SAS tokens** with scoped permissions and expiration
- **Private GitHub repo** recommended
- **HIPAA**: Azure services are HIPAA-eligible when configured with a BAA
- **No data shared with third parties** — all processing uses your own Azure subscription

---

## License

Private — for personal medical use.
