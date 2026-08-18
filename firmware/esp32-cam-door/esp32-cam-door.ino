#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* DOOR_HOST = "icccc.devsomeware.com";
const uint16_t DOOR_PORT = 443;
const char* DOOR_TOKEN = "PASTE_DOOR_DEVICE_TOKEN";

const int BUZZER_PIN = 12;
const int PIN_IDLE_HIGH = 13;
const int PIN_IDLE_LOW = 14;   // -> Arduino D3

const int DEFAULT_HOLD_MS = 2500;
const unsigned long HEARTBEAT_MS = 15000;
const unsigned long WIFI_RETRY_MS = 3000;

WebSocketsClient webSocket;

unsigned long lastHeartbeat = 0;
unsigned long lastWifiTry = 0;
unsigned long pulseUntil = 0;
bool doorOpen = false;
bool socketReady = false;

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

void handleText(const String& data) {
  Serial.print("WS IN: ");
  Serial.println(data);

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
      lastHeartbeat = millis();
      Serial.println("WSS CONNECTION SUCCESSFUL");
      webSocket.sendTXT("{\"type\":\"hello\",\"device\":\"esp32-door-1\"}");
      break;
    case WStype_TEXT: {
      String data = length ? String((const char*)payload, length) : "";
      handleText(data);
      break;
    }
    case WStype_DISCONNECTED:
      socketReady = false;
      Serial.println("WSS CONNECTION CLOSED");
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("ESP32 door lock");
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
}
