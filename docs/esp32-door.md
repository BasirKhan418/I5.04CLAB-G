# ESP32 door lock — persistent WebSocket

The lab lock is an ESP32 (Arduino) that stays connected to this server. It does **not** log people in. It only pulses GPIO when the app says the door should open.

If you are using an **AI-Thinker ESP32-CAM**, use [esp32-cam.md](./esp32-cam.md) instead. GPIO 25/26/27 are camera pins on that board.

Run the door socket next to `npm run dev` and `npm run worker`:

```bash
npm run door
```

Health check: `http://<server-ip>:8787/health`

## When the pin goes HIGH

| App action | Door |
|---|---|
| Staff **Approve** visitor | Open |
| Staff **Deny** | No |
| Member **Enter** | Open |
| Member **Exit** | Open (so they can walk out) |
| Dashboard **Allow** (reason required) | Open |

Hold time is `holdMs` in the `open` message (default **2500 ms**). Change `DOOR_OPEN_MS` in `.env` if you want 3 seconds.

## Connection (keep forever)

```
ws://<server-lan-ip>:8787/door?token=<DOOR_DEVICE_TOKEN>
```

Production TLS (after nginx/caddy):

```
wss://<your-domain>/door?token=<DOOR_DEVICE_TOKEN>
```

Copy `DOOR_DEVICE_TOKEN` from the server `.env`. Do not put it in a public repo.

The socket stays up until the ESP32 disconnects or power is lost. Keepalive is a JSON `{ "type": "ping" }` every 15s. Reply with `{ "type": "pong" }`. The server does **not** drop a live board for missing WebSocket ping frames (ESP32 libraries often ignore those). It only drops a socket after ~60s of total silence, then the firmware reconnects.

Pulse the lock **without blocking** `client.poll()` — a long `delay()` can look like a dead connection.

### Auth

Query string (easiest on ESP32):

```
/door?token=YOUR_TOKEN
```

Or header `X-Door-Token: YOUR_TOKEN`.

Wrong token → close code `4001`.

### Messages (JSON text)

Server → ESP32 on connect:

```json
{ "type": "hello", "holdMs": 2500 }
```

Server → ESP32 when the lock should fire:

```json
{ "type": "open", "holdMs": 2500, "reason": "visitor-approve", "at": "2026-08-13T21:00:00.000Z" }
```

`reason` is `visitor-approve`, `member-in`, `member-out`, or `manual`. Firmware can ignore it and only look at `type === "open"`.

ESP32 may send:

```json
{ "type": "hello", "device": "esp32-door-1" }
```

```json
{ "type": "pong" }
```

Server keepalive (every 15s):

```json
{ "type": "ping" }
```

Always answer that with `{ "type": "pong" }`. You can also send `{ "type": "ping" }` from the board every 15s; the server replies `pong`.

## Wiring

| ESP32 | Lock / relay |
|---|---|
| GPIO 26 (change in sketch) | Relay IN |
| GND | Relay GND |
| 3V3 or 5V as your relay needs | Relay VCC |

Active HIGH for 2–3 seconds, then LOW. Use a **relay module**, not a direct solenoid on a GPIO.

## Arduino / ESP32 sketch

Library: **ArduinoWebsockets** by Gil Maimon  
Boards: ESP32 (`esp32` by Espressif).

Replace `WIFI_SSID`, `WIFI_PASS`, `DOOR_HOST`, and `DOOR_TOKEN`.

```cpp
#include <WiFi.h>
#include <ArduinoWebsockets.h>

using namespace websockets;

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

const char* DOOR_HOST = "192.168.1.50";
const uint16_t DOOR_PORT = 8787;
const char* DOOR_TOKEN = "PASTE_DOOR_DEVICE_TOKEN";

const int LOCK_PIN = 26;
const int DEFAULT_HOLD_MS = 2500;
const unsigned long HEARTBEAT_MS = 15000;
const unsigned long RECONNECT_MS = 2000;

WebsocketsClient client;
unsigned long lastReconnect = 0;
unsigned long lastHeartbeat = 0;
unsigned long lockUntil = 0;
bool lockHigh = false;
bool wantConnect = true;

void lockOff() {
  digitalWrite(LOCK_PIN, LOW);
  lockHigh = false;
  lockUntil = 0;
}

void pulseLock(int holdMs) {
  if (holdMs < 200) holdMs = DEFAULT_HOLD_MS;
  if (holdMs > 8000) holdMs = 8000;
  digitalWrite(LOCK_PIN, HIGH);
  lockHigh = true;
  lockUntil = millis() + (unsigned long)holdMs;
}

void serviceLock() {
  if (lockHigh && (long)(millis() - lockUntil) >= 0) {
    lockOff();
  }
}

void onMessage(WebsocketsMessage message) {
  String data = message.data();
  if (data.indexOf("\"ping\"") >= 0 && data.indexOf("\"open\"") < 0) {
    client.send("{\"type\":\"pong\"}");
    return;
  }
  if (data.indexOf("\"open\"") < 0) return;

  int holdMs = DEFAULT_HOLD_MS;
  int key = data.indexOf("\"holdMs\"");
  if (key >= 0) {
    int colon = data.indexOf(':', key);
    if (colon >= 0) holdMs = data.substring(colon + 1).toInt();
  }
  pulseLock(holdMs);
}

void onEvent(WebsocketsEvent event, String) {
  if (event == WebsocketsEvent::ConnectionOpened) {
    lastHeartbeat = millis();
    client.send("{\"type\":\"hello\",\"device\":\"esp32-door-1\"}");
  }
  if (event == WebsocketsEvent::ConnectionClosed) {
    wantConnect = true;
  }
}

bool connectDoor() {
  String path = String("/door?token=") + DOOR_TOKEN;
  bool ok = client.connect(DOOR_HOST, DOOR_PORT, path);
  if (ok) {
    wantConnect = false;
    lastHeartbeat = millis();
    client.send("{\"type\":\"hello\",\"device\":\"esp32-door-1\"}");
  }
  return ok;
}

void setup() {
  pinMode(LOCK_PIN, OUTPUT);
  lockOff();
  Serial.begin(115200);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(400);

  client.onMessage(onMessage);
  client.onEvent(onEvent);
  connectDoor();
}

void loop() {
  serviceLock();

  if (WiFi.status() != WL_CONNECTED) {
    wantConnect = true;
    WiFi.reconnect();
    delay(200);
    return;
  }

  if (client.available()) {
    client.poll();
    if (millis() - lastHeartbeat >= HEARTBEAT_MS) {
      lastHeartbeat = millis();
      client.send("{\"type\":\"ping\"}");
    }
    return;
  }

  wantConnect = true;
  if (millis() - lastReconnect < RECONNECT_MS) return;
  lastReconnect = millis();
  connectDoor();
}
```

For **WSS** (production), use `client.connect("wss://your-domain/door?token=...")` after TLS is terminated at nginx/caddy.

## nginx (WSS)

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

Keep `proxy_read_timeout` high so the persistent socket is not killed.

## Laptop test (no ESP32)

```bash
npm run door

# another terminal
npx wscat -c "ws://127.0.0.1:8787/door?token=YOUR_DOOR_DEVICE_TOKEN"
```

Approve a visitor or tap Enter on the kiosk. You should see an `open` JSON line. The ESP32 would pulse the pin on that same message.

## Processes

| Command | Role |
|---|---|
| `npm run dev` | App + kiosk + dashboard |
| `npm run worker` | WhatsApp notify |
| `npm run door` | Persistent lock socket |

If `npm run door` is not running, the app still works. The lock just will not click.
