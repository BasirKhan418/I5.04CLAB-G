# I5.04C Lab

I5.04C Lab access: a kiosk for visitors and members, a dashboard for staff, WhatsApp alerts, and an ESP32 door lock.

Visitors ask to come in (name, reason, optional face and voice). Members get a WhatsApp ping and can allow from the dashboard or a public link. Members punch IN/OUT with email + PIN. Hours are **09:00–17:30 IST**. The lock is a pulse only — it does not log people in.

ESP32 firmware and wiring: [docs/esp32-door.md](docs/esp32-door.md)

## What you need

- Node.js 20+
- MongoDB (Atlas or local)
- Redis / Valkey (Aiven or local)
- AWS S3 bucket (visitor face + voice)
- SMTP (Gmail app password is fine)
- Three terminals for local work
- Optional: OpenWA session (WhatsApp), ESP32 + relay

## 1. Install

```bash
git clone <this-repo>
cd icccc-qr
npm install
cp .env.example .env
```

Edit `.env`. Use **placeholders from `.env.example`**, not a teammate’s real file. Never commit `.env`.

## 2. Environment

| Variable | Required | What it is |
|---|---|---|
| `MONGO_URI` | Yes | Database |
| `REDIS_URL` | Yes | Queue, OTP, realtime, door pub/sub |
| `JWT_SECRET` | Yes | Session + public Allow-link HMAC |
| `AWS_REGION` | Yes | S3 region |
| `AWS_ACCESS_KEY_ID` | Yes | S3 |
| `AWS_SECRET_ACCESS_KEY` | Yes | S3 |
| `AWS_BUCKET_NAME` | Yes | Visitor media |
| `SMTP_HOST` | Yes | Mail |
| `SMTP_PORT` | No | Default `587` |
| `SMTP_SECURE` | No | `true` only for port 465 |
| `SMTP_USER` | Yes | SMTP login |
| `SMTP_PASS` | Yes | SMTP password / app password |
| `MAIL_FROM` | Yes | From header |
| `SUPERADMIN_EMAIL` | First boot | Creates superadmin if the DB is empty. PIN is emailed. |
| `PUBLIC_HOST` | For Allow links | e.g. `http://localhost:3000` or `https://your.domain` — no trailing slash |
| `DOOR_DEVICE_TOKEN` | For lock | Shared secret with the ESP32 |
| `DOOR_WS_PORT` | No | Default `8787` |
| `DOOR_OPEN_MS` | No | Relay HIGH time, default `2500` |
| `SESSION_ID_OPENWA` | No | Seed only — then use Infrastructure |
| `TEMPLATE_ID_OPENWA` | No | Seed only |
| `OPENWA_API_KEY` | No | Seed only |
| `OPENWA_API_URL` | No | Seed only |

WhatsApp is stored in Mongo after the first Infrastructure save. Changing the OpenWA session does **not** need a redeploy.

## 3. Start — three processes

Open three terminals in the repo root.

```bash
# Terminal 1 — app, kiosk, dashboard
npm run dev
```

```bash
# Terminal 2 — WhatsApp visitor notify (BullMQ)
npm run worker
```

```bash
# Terminal 3 — ESP32 door WebSocket
npm run door
```

| Command | Port | Role |
|---|---|---|
| `npm run dev` | `3000` | Next.js: kiosk `/`, dashboard `/dashboard` |
| `npm run worker` | — | Sends WhatsApp: template/text → photo → voice → Allow link |
| `npm run door` | `8787` | Persistent lock socket. Health: `http://127.0.0.1:8787/health` |

Without the worker, visitors still wait on the kiosk; members just do not get WhatsApp.  
Without the door process, the app still works; the lock does not click.

Production (after `npm run build`):

```bash
npm run start    # instead of npm run dev
npm run worker
npm run door
```

## 4. First login

1. Leave `SUPERADMIN_EMAIL` set. First `npm run dev` with an empty DB creates that user and emails a PIN.
2. Open [http://localhost:3000/login](http://localhost:3000/login).
3. Sign in with that email + PIN. Change the PIN on Profile.
4. Add members from Dashboard → Members (admin).

Kiosk `/` is public. Dashboard needs a signed-in member.

## 5. WhatsApp (Infrastructure)

Admin → **Infrastructure**.

- API URL, Session ID, Template ID, API key live in Mongo.
- API key stays hidden until you click the eye.
- Worker reads Mongo on **every** notify. New session ID → Save → next visitor uses it. No worker restart for a session swap.
- Restart the worker once after pulling code that added Infrastructure.

Profile → WhatsApp number sends an OTP to **that** WhatsApp. Confirm it so the member gets visitor alerts.

## 6. ESP32 door WebSocket

Firmware detail and Arduino sketch: [docs/esp32-door.md](docs/esp32-door.md).

### Server

```bash
npm run door
```

Needs `DOOR_DEVICE_TOKEN` in `.env`. Health:

```bash
curl http://127.0.0.1:8787/health
# {"ok":true,"clients":0,"uptime":12}
```

### Board connection

```
ws://<server-lan-ip>:8787/door?token=<DOOR_DEVICE_TOKEN>
```

Production (TLS at nginx/caddy):

```
wss://<your-domain>/door?token=<DOOR_DEVICE_TOKEN>
```

Same token as `.env`. Wrong token → close `4001`.

Keepalive: server sends `{ "type": "ping" }` every 15s. Board replies `{ "type": "pong" }`. Drop only after ~60s silence.

When the lock should open:

```json
{ "type": "open", "holdMs": 2500, "reason": "visitor-approve", "at": "2026-08-14T00:00:00.000Z" }
```

`reason` is `visitor-approve`, `member-in`, `member-out`, or `manual`. Firmware can ignore it.

### What pulses the lock

| Action | Door |
|---|---|
| Staff Approve visitor | Open |
| Staff Deny | No |
| Member Enter | Open |
| Member Close | Open (walk out) |
| Dashboard sidebar **Allow** (reason required) | Open |
| Public Allow link `/a/{token}` | Open |

### Laptop test (no board)

```bash
npm run door
npx wscat -c "ws://127.0.0.1:8787/door?token=YOUR_DOOR_DEVICE_TOKEN"
```

Approve a visitor or tap Enter on the kiosk. You should see an `open` JSON line.

### nginx (WSS)

```nginx
location /door {
  proxy_pass http://127.0.0.1:8787/door;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "Upgrade";
  proxy_set_header Host $host;
  proxy_read_timeout 86400s;
  proxy_send_timeout 86400s;
}
```

## 7. App map

| Path | Who | What |
|---|---|---|
| `/` | Anyone | Kiosk: visitor or member |
| `/login` | Members | Email + PIN or email OTP |
| `/dashboard` | Signed in | Who’s in, pending visitors (admin) |
| `/dashboard/logs` | Signed in | Events + hours. Utility door opens do not count hours |
| `/dashboard/members` | Admin | Roster |
| `/dashboard/infrastructure` | Admin | OpenWA in Mongo |
| `/dashboard/profile` | Signed in | Name, PIN, WhatsApp OTP |
| `/a/{token}` | Public | Allow a waiting visitor (from WhatsApp link) |

Dashboard **Allow** (sidebar): reason → log as `utility` → pulse door. No hours calculation.

## 8. Hours (do not change)

- Window **09:00–17:30 IST**
- First IN starts the clock; IN before 09:00 clips to 09:00
- Last OUT in the window ends it; no OUT → 17:30
- Punches after 17:30 are audit only
- Visitor and utility (manual door) events are not member hours

## 9. Checklist

- [ ] `.env` copied from `.env.example` (not a real shared `.env`)
- [ ] `npm run dev` — kiosk loads on `:3000`
- [ ] Superadmin can sign in
- [ ] `npm run worker` — log says it is listening
- [ ] Infrastructure **Ready** if you want WhatsApp
- [ ] `npm run door` — `/health` ok
- [ ] ESP32 or `wscat` connected; Approve / Enter shows `open`
- [ ] `PUBLIC_HOST` matches the URL people open (local or https)

## 10. Common misses

| Symptom | Fix |
|---|---|
| App crash on boot | Missing required `.env` key — see table above |
| No WhatsApp on visit | Worker not running, or Infrastructure not Ready |
| Allow link 404 / wrong host | Set `PUBLIC_HOST` to the public origin, restart app + worker once |
| Lock never clicks | `npm run door` not running, or ESP32 token / LAN IP wrong |
| Door process exits | `DOOR_DEVICE_TOKEN` empty |
| Hours look wrong | Do not edit `lib/hours.ts` window |
