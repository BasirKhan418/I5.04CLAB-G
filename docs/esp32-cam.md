# ESP32-CAM door lock + live feed

This is for the **AI-Thinker ESP32-CAM** with the **OV2640 already soldered on the board**. Do not wire a separate camera. The sketch uses that onboard sensor.

The board stays connected to this server over WSS for unlock commands **and** pushes JPEG frames when someone is watching.

The board’s LAN IP is never exposed. The browser never talks to `http://10.x.x.x:81/stream`.

```
OV2640 → ESP32-CAM --WSS /door--> npm run door
                                      │  JSON open/ping
                                      │  binary JPEG
                                      ▼
                              signed-in browser
                              wss://your-domain/cam
```

Run next to `npm run dev` and `npm run worker`:

```bash
npm run door
```

Health: `http://<server-ip>:8787/health` now includes `viewers` and `cam.live`.

## Why not MJPEG on the ESP32?

[Random Nerd Tutorials](https://randomnerdtutorials.com/esp32-cam-ai-thinker-pinout/) and the stock CameraWebServer example serve `http://ESP32-IP:81/stream` on the LAN. That works on the lab Wi-Fi. It does **not** work for a public Next.js site, and it puts the lock on the internet.

The pattern used here is the same as current ESP32-CAM → WebSocket → server relays ([e-lab](https://elabins.com/2022/05/05/esp32-cam-live-stream-using-websocket/), [Neumi/esp32_camera_webstream](https://github.com/Neumi/esp32_camera_webstream)): the camera **pushes** JPEG binaries outbound through NAT. nginx only needs `/door` and `/cam` to the door process.

## Pins (AI-Thinker)

Camera already uses GPIO **0, 5, 18, 19, 21, 22, 23, 25, 26, 27, 32, 34, 35, 36, 39**. Do **not** reuse 25 / 26 / 27 from the older ESP32-S sketch.

| Function | GPIO | Idle | On `open` (2.5s) |
|---|---|---|---|
| Buzzer | **12** | LOW | HIGH |
| Idle-high / lock A | **13** | HIGH | LOW |
| Idle-low / lock B | **14** | LOW | HIGH |

Same pulse as the previous ESP32-S sketch: buzzer HIGH for `holdMs`, pin 13/14 swap, then back. GPIO 25/27 cannot be used on this board (camera).

Do not use GPIO **16** (PSRAM). Leave the microSD unsoldered / unused.

## Messages

Same door JSON as before, plus camera:

Server → board on connect:

```json
{ "type": "hello", "holdMs": 2500, "heartbeatMs": 15000, "cam": false }
```

Server → board when a dashboard user opens the live view:

```json
{ "type": "cam-on" }
```

```json
{ "type": "cam-off" }
```

Board → server: binary JPEG frames (SOI `FF D8`) on the **same** `/door` socket, ~4 fps, QVGA. Only while `cam-on`.

Unlock is unchanged:

```json
{ "type": "open", "holdMs": 2500, "reason": "visitor-approve", "at": "..." }
```

## Arduino IDE

- Board: **AI Thinker ESP32-CAM**
- PSRAM: **Enabled**
- Partition: Huge APP
- Libraries: **WebSockets** by Markus Sattler (the one that already connected this lab over WSS)

Upload with an FTDI adapter: GPIO 0 to GND while flashing, then remove GPIO 0 and reset.

Replace `WIFI_SSID`, `WIFI_PASS`, and `DOOR_TOKEN`.

```cpp
#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* DOOR_HOST = "icccc.devsomeware.com";
const uint16_t DOOR_PORT = 443;
const char* DOOR_TOKEN = "PASTE_DOOR_DEVICE_TOKEN";

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

const int BUZZER_PIN = 12;       // was GPIO 25 on ESP32-S; camera owns 25 here
const int PIN_IDLE_HIGH = 13;    // was GPIO 27 on ESP32-S; camera owns 27 here
const int PIN_IDLE_LOW = 14;     // same as before

const int DEFAULT_HOLD_MS = 2500;
const unsigned long HEARTBEAT_MS = 15000;
const unsigned long FRAME_MS = 250;

WebSocketsClient webSocket;

unsigned long lastHeartbeat = 0;
unsigned long lastFrame = 0;
unsigned long pulseUntil = 0;
bool doorOpen = false;
bool socketReady = false;
bool camWanted = false;

const char* level(int pin) {
  return digitalRead(pin) ? "HIGH" : "LOW";
}

void logPins(const char* why) {
  Serial.print(why);
  Serial.print(" | GPIO");
  Serial.print(PIN_IDLE_HIGH);
  Serial.print("=");
  Serial.print(level(PIN_IDLE_HIGH));
  Serial.print(" GPIO");
  Serial.print(PIN_IDLE_LOW);
  Serial.print("=");
  Serial.print(level(PIN_IDLE_LOW));
  Serial.print(" buzzer GPIO");
  Serial.print(BUZZER_PIN);
  Serial.print("=");
  Serial.println(level(BUZZER_PIN));
}

void useBuzzerPin() {
  pinMode(BUZZER_PIN, OUTPUT);
}

void setClosed() {
  useBuzzerPin();
  pinMode(PIN_IDLE_HIGH, OUTPUT);
  pinMode(PIN_IDLE_LOW, OUTPUT);
  digitalWrite(PIN_IDLE_HIGH, HIGH);
  digitalWrite(PIN_IDLE_LOW, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  doorOpen = false;
  pulseUntil = 0;
}

void setOpen(int holdMs) {
  if (holdMs < 200) holdMs = DEFAULT_HOLD_MS;
  if (holdMs > 8000) holdMs = 8000;
  useBuzzerPin();
  digitalWrite(PIN_IDLE_HIGH, LOW);
  digitalWrite(PIN_IDLE_LOW, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  doorOpen = true;
  pulseUntil = millis() + (unsigned long)holdMs;
  Serial.println("BUZZER ON");
}

void serviceDoor() {
  if (doorOpen && (long)(millis() - pulseUntil) >= 0) {
    setClosed();
    Serial.println("BUZZER OFF");
    logPins("DOOR CLOSED");
  }
}

void handleText(const String& data) {
  Serial.print("WS IN: ");
  Serial.println(data);

  if (data.indexOf("\"cam-off\"") >= 0 || data.indexOf("\"cam\":false") >= 0) {
    camWanted = false;
    Serial.println("CAM OFF");
    if (data.indexOf("\"cam-off\"") >= 0) return;
  }
  if (data.indexOf("\"cam-on\"") >= 0 || data.indexOf("\"cam\":true") >= 0) {
    camWanted = true;
    Serial.println("CAM ON");
  }

  if (data.indexOf("\"ping\"") >= 0 && data.indexOf("\"open\"") < 0) {
    webSocket.sendTXT("{\"type\":\"pong\"}");
    return;
  }
  if (data.indexOf("\"open\"") < 0) return;

  int holdMs = DEFAULT_HOLD_MS;
  int key = data.indexOf("\"holdMs\"");
  if (key >= 0) {
    int colon = data.indexOf(':', key);
    if (colon >= 0) holdMs = data.substring(colon + 1).toInt();
  }
  Serial.print("DOOR OPEN holdMs=");
  Serial.println(holdMs);
  setOpen(holdMs);
  logPins("DOOR OPEN");
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      socketReady = true;
      lastHeartbeat = millis();
      Serial.println("WSS CONNECTION SUCCESSFUL");
      webSocket.sendTXT("{\"type\":\"hello\",\"device\":\"esp32-cam-door-1\"}");
      break;
    case WStype_TEXT: {
      String data;
      for (size_t i = 0; i < length; i++) data += (char)payload[i];
      handleText(data);
      break;
    }
    case WStype_DISCONNECTED:
      socketReady = false;
      camWanted = false;
      Serial.println("WSS CONNECTION CLOSED");
      break;
    default:
      break;
  }
}

bool startCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 15;
  config.fb_count = psramFound() ? 2 : 1;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed 0x%x\n", err);
    return false;
  }
  sensor_t* sensor = esp_camera_sensor_get();
  if (sensor) {
    sensor->set_framesize(sensor, FRAMESIZE_QVGA);
    sensor->set_quality(sensor, 15);
    sensor->set_vflip(sensor, 1);
    sensor->set_hmirror(sensor, 0);
  }
  Serial.println("Camera ready");
  return true;
}

void sendFrame() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) return;
  if (fb->format == PIXFORMAT_JPEG && fb->len > 0 && fb->len < 160000) {
    webSocket.sendBIN(fb->buf, fb->len);
  }
  esp_camera_fb_return(fb);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("ESP32-CAM door lock starting");

  setClosed();
  logPins("IDLE");
  Serial.println("BUZZER / PIN TEST 400ms");
  setOpen(400);
  logPins("TEST OPEN");
  delay(400);
  setClosed();
  Serial.println("BUZZER OFF");
  logPins("TEST CLOSED");

  if (!startCamera()) {
    Serial.println("Camera failed — lock WSS will still run");
  }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  Serial.println(WiFi.localIP());

  String path = String("/door?token=") + DOOR_TOKEN;
  webSocket.beginSSL(DOOR_HOST, DOOR_PORT, path.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  serviceDoor();

  if (WiFi.status() != WL_CONNECTED) {
    socketReady = false;
    camWanted = false;
    WiFi.reconnect();
    delay(500);
    return;
  }

  webSocket.loop();

  if (socketReady && millis() - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = millis();
    webSocket.sendTXT("{\"type\":\"ping\"}");
  }

  if (socketReady && camWanted && millis() - lastFrame >= FRAME_MS) {
    lastFrame = millis();
    sendFrame();
  }
}
```

If `CAMERA_FB_IN_PSRAM` or `grab_mode` fails to compile, delete those two lines and keep `fb_count = 2`.

## Website

Signed-in staff:

- Dashboard home — live preview
- **Camera** in the sidebar — full view
- Sidebar **Allow** — live view in the unlock dialog

The browser fetches a short ticket from `/api/cam/ticket`, then opens `wss://<your-domain>/cam?ticket=...`. nginx must proxy `/cam` the same way as `/door`.

## nginx

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

location /cam {
  proxy_pass http://127.0.0.1:8787/cam;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "Upgrade";
  proxy_set_header Host $host;
  proxy_set_header Cookie $http_cookie;
  proxy_read_timeout 86400s;
  proxy_send_timeout 86400s;
}
```

Restart `npm run door` after pulling this, then flash the sketch, then open `/dashboard/camera`. Serial should show `CAM ON` and the page should go **Live**.
