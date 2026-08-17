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

const int BUZZER_PIN = 12;
const int PIN_IDLE_HIGH = 13;
const int PIN_IDLE_LOW = 14;

const int DEFAULT_HOLD_MS = 2500;
const unsigned long HEARTBEAT_MS = 15000;
const unsigned long FRAME_MS = 1000;
const unsigned long WIFI_RETRY_MS = 3000;
const unsigned long MAX_JPEG = 160000;

WebSocketsClient webSocket;

unsigned long lastHeartbeat = 0;
unsigned long lastFrame = 0;
unsigned long lastWifiTry = 0;
unsigned long pulseUntil = 0;
bool doorOpen = false;
bool socketReady = false;
bool camWanted = false;
bool cameraReady = false;

void setClosed() {
  pinMode(BUZZER_PIN, OUTPUT);
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
  }
}

int readHoldMs(const String& data) {
  int holdMs = DEFAULT_HOLD_MS;
  int key = data.indexOf("\"holdMs\"");
  if (key < 0) return holdMs;
  int colon = data.indexOf(':', key);
  if (colon < 0) return holdMs;
  holdMs = data.substring(colon + 1).toInt();
  if (holdMs < 200) holdMs = DEFAULT_HOLD_MS;
  if (holdMs > 8000) holdMs = 8000;
  return holdMs;
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
  config.jpeg_quality = 18;
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
    sensor->set_quality(sensor, 18);
    sensor->set_vflip(sensor, 1);
  }
  Serial.println("Camera ready");
  return true;
}

void ensureCamera() {
  if (cameraReady) return;
  cameraReady = startCamera();
}

void sendFrame() {
  if (!cameraReady) return;
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) return;
  if (fb->format == PIXFORMAT_JPEG && fb->len > 0 && fb->len < MAX_JPEG) {
    webSocket.sendBIN(fb->buf, fb->len);
  }
  esp_camera_fb_return(fb);
}

void handleText(const String& data) {
  if (data.indexOf("\"cam-off\"") >= 0) {
    camWanted = false;
    Serial.println("CAM OFF");
  } else if (data.indexOf("\"cam-on\"") >= 0) {
    camWanted = true;
    ensureCamera();
    Serial.println("CAM ON");
  }

  if (data.indexOf("\"ping\"") >= 0 && data.indexOf("\"open\"") < 0) {
    webSocket.sendTXT("{\"type\":\"pong\"}");
    return;
  }
  if (data.indexOf("\"open\"") < 0) return;

  int holdMs = readHoldMs(data);
  Serial.print("DOOR OPEN holdMs=");
  Serial.println(holdMs);
  setOpen(holdMs);
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      socketReady = true;
      camWanted = false;
      lastHeartbeat = millis();
      Serial.println("WSS CONNECTION SUCCESSFUL");
      webSocket.sendTXT("{\"type\":\"hello\",\"device\":\"esp32-cam-door-1\"}");
      break;
    case WStype_TEXT: {
      String data = length ? String((const char*)payload, length) : "";
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

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("ESP32-CAM door lock (on-demand cam)");
  setClosed();

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  Serial.println(WiFi.localIP());

  String path = String("/door?token=") + DOOR_TOKEN;
  webSocket.beginSSL(DOOR_HOST, DOOR_PORT, path.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);
  webSocket.enableHeartbeat(30000, 5000, 3);
}

void loop() {
  serviceDoor();
  webSocket.loop();

  if (WiFi.status() != WL_CONNECTED) {
    socketReady = false;
    camWanted = false;
    if (millis() - lastWifiTry >= WIFI_RETRY_MS) {
      lastWifiTry = millis();
      WiFi.reconnect();
      Serial.println("WiFi retry");
    }
    return;
  }

  if (!socketReady) return;

  if (millis() - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = millis();
    webSocket.sendTXT("{\"type\":\"ping\"}");
  }

  if (camWanted && !doorOpen && millis() - lastFrame >= FRAME_MS) {
    lastFrame = millis();
    sendFrame();
  }
}
