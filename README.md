# SMARTSCAN — IoT Automated Mall Shopping & Billing System

Production-quality academic prototype for supermarket QR shopping, RFID payment, and IoT exit verification.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite + Tailwind CSS + Lucide + Recharts + html5-qrcode |
| Backend | Node.js + Express + JWT + bcrypt + Socket.IO + Nodemailer |
| Database | **Supabase** (PostgreSQL) |
| IoT | ESP32 + RC522 RFID + exit QR / servo / LEDs / buzzer |

## Project structure

```text
Smartscan-billing-system/
├── frontend/          # React Vite UI
├── backend/           # Express API + Socket.IO
├── database/          # schema.sql + seed.sql
├── smartscan-iot/     # ESP32 sketches
└── README.md
```

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `database/schema.sql`.
3. Copy **Project URL** and **service_role** key into `backend/.env`.

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

## 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env with Supabase + optional SMTP
npm install
npm run seed
npm run dev
```

API: `http://localhost:5000`

### Email OTP

- With SMTP (Brevo / Nodemailer) configured, OTPs are emailed.
- Without SMTP, OTPs are printed in the **backend console** (dev fallback).

### Seed accounts

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| Admin | `admin@smartscan.rw` | `Password123!` | Full platform |
| Manager | `manager@smartscan.rw` | `Password123!` | Owns ABC Supermarket |
| Cashier | `cashier@smartscan.rw` | `Password123!` | Deposits only |
| Customer | `customer@smartscan.rw` | `Password123!` | PIN `1234`, card `A4B2C199`, balance `20,000 RWF` |

Demo branch QR:

```text
SMARTSCAN_BRANCH:BRANCH-001
```

Demo product QRs:

```text
SMARTSCAN_PRODUCT:PROD-000101   # Milk 2,000
SMARTSCAN_PRODUCT:PROD-000102   # Rice 3,500
SMARTSCAN_PRODUCT:PROD-000103   # Sugar 1,500
```

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

- Home page with branded hero
- **Login as popup** (email + password + OTP)
- Role dashboards: Customer / Manager / Cashier / Admin
- Camera QR scanning via `html5-qrcode`

## 4. Complete shopping workflow

1. Customer registers → email OTP → admin approves
2. Customer logs in (password + OTP) → sets payment PIN
3. Cashier deposits funds onto RFID card
4. Customer **Start Shopping** → scans branch QR → session created
5. Customer scans product QRs → cart + totals saved in Supabase
6. Manager sees live active session
7. Customer taps RFID (ESP32 or cashier simulator) → payment popup
8. Customer enters PIN → server recalculates total → balance check → atomic deduct
9. Digital receipt + QR generated
10. Exit ESP32 scans receipt QR → green LED / open servo if valid

## 5. Security rules implemented

- No shopping without branch QR
- Prices/totals always recalculated on server
- RFID tap **identifies only** — PIN authorizes payment
- Cashiers/managers **cannot deduct** customer funds
- Passwords, OTPs, and PINs are hashed (bcrypt)
- JWT role middleware on protected routes
- Helmet, CORS, rate limiting on auth

## 6. Key APIs

```text
POST /api/auth/register
POST /api/auth/verify-otp
POST /api/auth/resend-otp
POST /api/auth/login
GET  /api/auth/me

POST /api/supermarkets          # creator becomes owner/manager
POST /api/sessions/start        # requires SMARTSCAN_BRANCH:...
POST /api/sessions/:id/scan-product
POST /api/rfid/read             # device key header
POST /api/payments/authorize    # PIN + atomic deduct
POST /api/cards/deposit         # cashier deposit only
POST /api/exit/verify           # receipt QR validation
```

## 7. ESP32

See:

- `smartscan-iot/esp32_rfid_reader/`
- `smartscan-iot/esp32_exit_gate/`

Set WiFi, PC LAN IP, and `x-device-key` to match `IOT_API_KEY`.

Simulate RFID without hardware:

- Cashier → **RFID Read** → enter `A4B2C199`
- Or `POST /api/rfid/read` with header `x-device-key`

## 8. Creating a supermarket

Any approved **Manager** (or registering as manager) can create a supermarket from **My Supermarket**. The creator is set as `owner_id` and linked as manager of that shop. Customers choose where to shop by scanning that branch’s entrance QR.

### Email OTP (Brevo — registration only)

Login uses **email + password only** (no OTP).

Registration OTP is sent with **Brevo**:

1. Create an API key: https://app.brevo.com/settings/keys/api  
2. Verify a sender email in Brevo  
3. Put in `backend/.env`:

```env
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=your-verified@email.com
BREVO_SENDER_NAME=SMARTSCAN
EMAIL_FROM=SMARTSCAN <your-verified@email.com>
```

Or use SMTP:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-login-email
SMTP_PASS=your-brevo-smtp-key
```

## Payment PIN (create / reset)

1. Customer opens **Profile** → creates or resets a 4–6 digit PIN (account password required).
2. OTP is emailed (or printed in backend console in dev).
3. Customer verifies OTP.
4. Admin opens **PIN Approvals** and approves or rejects.
5. Customer receives an email with the decision.
6. Only an **approved** PIN can authorize RFID payments.

Run `database/migration_pin_requests.sql` in Supabase if the DB was created before this feature.

## 8. Deploy (Render + Vercel)

See [DEPLOY.md](./DEPLOY.md) for step-by-step hosting:

- **Backend** → Render (`backend/`)
- **Frontend** → Vercel (`frontend/`)

Set `VITE_API_URL` and `VITE_SOCKET_URL` on Vercel to your Render API URL.

## License

MIT — academic prototype for SMARTSCAN.
