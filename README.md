# StubbleSense — Agricultural Residue Burning Intelligence & Enforcement System

StubbleSense is an integrated spatial intelligence and enforcement platform designed to detect active crop residue fires, predict high-risk village clusters, allocate critical farm machinery (e.g., Happy Seeders, Super Seeders, Mulchers), and verify on-ground intervention workflows.

---

## System Architecture

- **Backend:** FastAPI (Python 3.10), SQLAlchemy 2.0 ORM, SQLite database (`backend/stubble_sense.db`).
- **Frontend:** React 18, TypeScript, Vite, CSS Modules / CSS Variables.
- **Security:** Bcrypt (12 rounds) password hashing, JWT-backed sessions via secure `HttpOnly` cookies, Double-Submit CSRF protection, and strict Role-Based Access Control (RBAC) with cross-record IDOR/BOLA isolation.

---

## Role-Based Access Control (RBAC) & Permission Matrix

StubbleSense enforces four operational roles maintaining the principle of least privilege:

| Feature / Action | Developer Super Admin (`super_admin`) | District Admin (`admin`) | Field Officer (`field_officer`) | Equipment Coordinator (`equipment_coordinator`) |
| :--- | :---: | :---: | :---: | :---: |
| **View Fire Map & Village Risk** | Allowed | Allowed | Allowed | Allowed |
| **View Equipment Fleet** | Allowed | Allowed | Allowed | Allowed |
| **Request Allocation Recommendations** | Allowed | Allowed | Forbidden (403) | Allowed |
| **View Interventions Roster** | Allowed (All) | Allowed (All) | Allowed (Assigned Only) | Allowed (All) |
| **View Intervention Detail (`GET /{id}`)** | Allowed (All) | Allowed (All) | Allowed (Assigned Only; 403 otherwise) | Allowed (All) |
| **Create New Intervention (`POST`)** | Allowed | Allowed | Forbidden (403) | Forbidden (403) |
| **Advance Status to In Progress** | Allowed | Allowed | Allowed (Assigned Only) | Allowed (Approved -> In Progress only) |
| **Mark Status Completed / Cancelled** | Allowed | Allowed | Allowed (In Progress -> Completed; Assigned Only) | Forbidden (403) |
| **Conduct Field Verification (`/verify`)** | Allowed | Allowed | Allowed (Assigned Only; 403 otherwise) | Forbidden (403) |
| **Provision Staff Accounts (`field_officer`, `equipment_coordinator`)** | Allowed | Allowed | Forbidden (403) | Forbidden (403) |
| **Provision Administrator Accounts (`admin`)** | Allowed | Forbidden (403) | Forbidden (403) | Forbidden (403) |
| **Provision Super Admin Accounts (`super_admin`)** | Forbidden via API (CLI Bootstrap only) | Forbidden (403) | Forbidden (403) | Forbidden (403) |

---

## Security Architecture & Protections

### 1. Zero Browser Storage & HttpOnly Cookies
- Sessions are maintained via an `access_token` cookie configured with `HttpOnly=True`, `SameSite="Lax"`, `Secure=settings.COOKIE_SECURE`, and `path="/"`.
- JWT tokens are **never stored in `localStorage` or `sessionStorage`**, eliminating token theft risks from Cross-Site Scripting (XSS).

### 2. Double-Submit CSRF Defense
- On successful login, the server sets a non-HttpOnly `csrf_token` cookie and returns `csrf_token` in the response payload.
- All state-changing requests (`POST`, `PATCH`, `PUT`, `DELETE`) submitted with browser session cookies must include the matching `X-CSRF-Token` HTTP header.
- Requests with missing or mismatched CSRF tokens are rejected with `HTTP 403 Forbidden`. Non-browser API clients using `Authorization: Bearer <token>` are unaffected.

### 3. Object-Level Access Control (IDOR / BOLA Prevention)
- Every intervention record possesses an `assigned_officer_id` field.
- **Field Officer Isolation:** When a user with role `field_officer` queries `GET /api/interventions/{id}`, updates status via `PATCH`, or conducts on-site verification via `POST .../verify`, the backend strictly enforces that `item.assigned_officer_id == current_user.id`. Attempts to access another officer's record return `HTTP 403 Forbidden`.
- **Unassigned Records:** Interventions without an assigned officer (`assigned_officer_id is None`) are treated as unassigned regional records. They are accessible only to administrators and equipment coordinators; field officers cannot view, modify, or verify them until explicitly assigned by an administrator.

### 4. Privilege Escalation Prevention
- Regular administrators cannot create or promote users to `admin` or `super_admin`.
- Super admin accounts cannot be created via the public API under any circumstances; they must be initialized via the secure CLI bootstrap utility or startup environment variables.

---

## Account Provisioning & Setup Instructions

### 1. Creating the Initial Super Admin (CLI)
To bootstrap the initial developer `super_admin` account with a hidden password prompt:

```powershell
# From the project root, activate your virtual environment:
.venv\Scripts\Activate.ps1
cd backend

# Secure hidden password prompt:
python -m app.cli.create_user --username dev_super --full-name "Lead System Developer" --role super_admin
```

Alternatively, specify credentials via environment variables in `backend/.env`:
```env
INITIAL_SUPER_ADMIN_USERNAME=superadmin
INITIAL_SUPER_ADMIN_PASSWORD=YourStrongDeveloperPassword2026!
INITIAL_SUPER_ADMIN_FULL_NAME=Lead System Developer
```

### 2. Provisioning Staff Accounts via Admin API
Authorized administrators or super admins can provision staff accounts:
```http
POST /api/auth/users
Content-Type: application/json
X-CSRF-Token: <csrf_token_from_login>

{
  "username": "officer_sandhu",
  "password": "TemporaryPassword123!",
  "full_name": "S. Sandhu",
  "role": "field_officer"
}
```

### 3. Evaluation Demo Accounts (Local Evaluation Only)
Synthetic evaluation accounts are **disabled by default** (`ENABLE_DEV_DEMO_ACCOUNTS=false`) for production safety.
To enable demo accounts in your local environment, set `ENABLE_DEV_DEMO_ACCOUNTS=true` and supply your chosen demo password via `EVAL_DEMO_PASSWORD` in your local `backend/.env` (which is excluded from Git).

#### Evaluation Accounts & Roles:
- **Developer Super Admin (`superadmin_demo`):** Role `super_admin`. Full system authority, user and role management roster, and cross-district operational overview.
- **District Admin (`admin_demo`):** Role `admin`. District-level governance, intervention creation, status transitions, risk scoring, and staff administration (provisioning field officers and equipment coordinators).
- **Field Officer (`field_officer_demo`):** Role `field_officer`. Ground verification and inspection. Lands directly on the dedicated **Field Operations** dashboard showing only assigned interventions (assigned synthetic intervention `INT-2026-PB-001` in Khurana village). Restricted by strict backend IDOR/BOLA isolation from cross-record access.
- **Equipment Coordinator (`equipment_coord_demo`):** Role `equipment_coordinator`. Custom Hiring Center machinery dispatcher. Lands directly on the dedicated **Equipment Operations** dashboard. Can view inventory, review recommendations, and mobilize machinery (`Approved` -> `In Progress`), but forbidden from creating interventions or marking them completed.

#### Evaluation Credentials Setup (Local `.env` Only):
Demo passwords are never committed to version control. When evaluating locally, configure passwords in your local `backend/.env`:
```env
ENABLE_DEV_DEMO_ACCOUNTS=true
EVAL_DEMO_PASSWORD=YourLocalEvaluationPassword2026!
# Or configure unique per-role passwords:
# EVAL_DEMO_SUPERADMIN_PASSWORD=YourSuperPassword2026!
# EVAL_DEMO_ADMIN_PASSWORD=YourAdminPassword2026!
# EVAL_DEMO_FIELD_OFFICER_PASSWORD=YourFieldPassword2026!
# EVAL_DEMO_EQUIP_COORD_PASSWORD=YourEquipPassword2026!
```

#### Public Self-Registration Policy:
- **`ENABLE_PUBLIC_REGISTRATION=false` (Default):** Public self-registration is disabled by default.
- If explicitly enabled (`ENABLE_PUBLIC_REGISTRATION=true`), prospective operational personnel (`field_officer`, `equipment_coordinator`) can submit self-registration requests from the login page.
- Self-registered accounts are created in a **PENDING (inactive)** state (`is_active=False`) and cannot log in or access protected features until reviewed and activated by an administrator via the User Management panel.
- Self-registering `super_admin` or `admin` accounts is strictly forbidden (rejected with `HTTP 403 Forbidden`).

---

## Configuration Reference (`backend/.env`)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./stubble_sense.db` | Primary SQLite database path |
| `JWT_SECRET` | *(Required in production; >=32 chars)* | HS256 HMAC cryptographic signing secret |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Session lifetime (8 hours) |
| `COOKIE_SECURE` | `false` (dev) / `true` (prod) | HTTPS-only secure cookie enforcement |
| `COOKIE_SAMESITE` | `lax` | SameSite cookie policy |
| `ENABLE_DEV_DEMO_ACCOUNTS` | `false` | Evaluation demo accounts (strictly forbidden in production) |
| `ENABLE_PUBLIC_REGISTRATION` | `false` | Public self-registration portal (disabled by default; requires admin activation when enabled) |
| `AUTO_APPROVE_PUBLIC_REGISTRATION` | `false` | Auto-approval for self-registration (strictly forbidden in production) |
| `EVAL_DEMO_PASSWORD` | `""` | Shared evaluation account password (required if demo accounts enabled) |
| `EVAL_DEMO_SUPERADMIN_PASSWORD` | `""` | Optional custom password for `superadmin_demo` |
| `EVAL_DEMO_ADMIN_PASSWORD` | `""` | Optional custom password for `admin_demo` |
| `EVAL_DEMO_FIELD_OFFICER_PASSWORD` | `""` | Optional custom password for `field_officer_demo` |
| `EVAL_DEMO_EQUIP_COORD_PASSWORD` | `""` | Optional custom password for `equipment_coord_demo` |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Whitelisted frontend origins |

---

## Running the Application for Local Evaluation

### 1. Start the Backend API
```powershell
# From project root:
.\.venv\Scripts\Activate.ps1
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
- API Documentation available at: `http://localhost:8000/docs`
- Health check available at: `http://localhost:8000/api/health`
- On startup, the backend automatically and idempotently seeds the four evaluation demo accounts and ensures the field officer has an assigned synthetic intervention.

### 2. Start the Frontend Development Server
```powershell
# In a second terminal from project root:
cd frontend
npm run dev
```
- Open `http://localhost:5173` in your browser.

### 3. Evaluating Role-Specific Access
On the login screen:
1. The **Evaluation Demo Accounts** panel shows **"Evaluation Mode Active"** with four quick-fill buttons:
   - **Super Admin**: Pre-fills `superadmin_demo`. Click **Sign In to Dashboard**. Lands on **Overview** with full features and the **User Management** panel to view the user roster and activate pending accounts.
   - **District Admin**: Pre-fills `admin_demo`. Click **Sign In to Dashboard**. Lands on **Overview** with district intervention management and **Staff Provisioning** (restricted to creating field and equipment staff).
   - **Field Officer**: Pre-fills `field_officer_demo`. Click **Sign In to Dashboard**. Lands on the dedicated **Field Operations** dashboard showing only assigned interventions (`INT-2026-PB-001`), with field verification tools.
   - **Equipment Coordinator**: Pre-fills `equipment_coord_demo`. Click **Sign In to Dashboard**. Lands on the dedicated **Equipment Operations** dashboard with equipment mobilization and tracking.
2. Clicking a demo button populates the credentials and executes the standard authenticated login flow:
   - Password verified via bcrypt.
   - Server issues an `HttpOnly` JWT cookie (`access_token`) and CSRF cookie (`csrf_token`).
   - Browser restores session on refresh and enforces role boundaries on every request.

---

## Automated Verification & Test Suites

- **Backend Pytest Suite (64 tests):**
  ```powershell
  .\.venv\Scripts\python.exe -m pytest backend/tests -v
  ```
- **Frontend Code Quality & Production Build:**
  ```powershell
  npm --prefix frontend run lint
  npm --prefix frontend run build
  ```
