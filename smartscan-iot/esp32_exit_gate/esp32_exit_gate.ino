#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <Servo.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================================================
// SMARTSCAN EXIT GATE
// ESP8266 NODEMCU + OLED + SERVO + LEDs + BUZZER
// Scan receipt QR (USB/serial scanner or MQTT) → backend verifies → gate opens
// =====================================================

const char* WIFI_SSID = "net";
const char* WIFI_PASSWORD = "1234567890";

const char* MQTT_SERVER = "broker.emqx.io";
const int MQTT_PORT = 1883;

// QR / receipt payloads go to the backend bridge
const char* MQTT_EXIT_SCAN_TOPIC = "smartscan/exit/scan";
// ALLOW / DENY commands come back from the backend
const char* MQTT_EXIT_COMMAND_TOPIC = "smartscan/exit/command";
const char* MQTT_STATUS_TOPIC = "smartscan/exit/status";

const char* DEVICE_NAME = "SMARTSCAN-EXIT-01";
const char* DEVICE_API_KEY = "5aef2560f2e82b80dc7fe02a533c85cf33950853";

#define OLED_SDA D2
#define OLED_SCL D1
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDRESS 0x3C

#define SERVO_PIN D5
#define GREEN_LED D6
#define RED_LED D7
#define BUZZER_PIN D3
#define READY_LED D4

#define GATE_CLOSED_ANGLE 0
#define GATE_OPEN_ANGLE 90
#define GATE_OPEN_MS 5000

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WiFiClient espClient;
PubSubClient mqttClient(espClient);
Servo gateServo;

String serialBuffer = "";
unsigned long gateCloseAt = 0;
bool gateOpen = false;

void mqttPump(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) {
    if (mqttClient.connected()) mqttClient.loop();
    delay(10);
    yield();
  }
}

void showOLED(String line1, String line2 = "", String line3 = "") {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(line1);
  display.setCursor(0, 20);
  display.println(line2);
  display.setCursor(0, 40);
  display.println(line3);
  display.display();
}

void beepShort() {
  digitalWrite(BUZZER_PIN, HIGH);
  mqttPump(120);
  digitalWrite(BUZZER_PIN, LOW);
}

void beepError() {
  digitalWrite(BUZZER_PIN, HIGH);
  mqttPump(500);
  digitalWrite(BUZZER_PIN, LOW);
}

void beepSuccess() {
  beepShort();
  mqttPump(80);
  beepShort();
}

void setLeds(bool green, bool red) {
  digitalWrite(GREEN_LED, green ? HIGH : LOW);
  digitalWrite(RED_LED, red ? HIGH : LOW);
}

void closeGate() {
  gateServo.write(GATE_CLOSED_ANGLE);
  gateOpen = false;
  gateCloseAt = 0;
  setLeds(false, false);
  showOLED("SMARTSCAN EXIT", "Gate CLOSED", "Scan receipt QR");
}

void openGate(String message) {
  gateServo.write(GATE_OPEN_ANGLE);
  gateOpen = true;
  gateCloseAt = millis() + GATE_OPEN_MS;
  setLeds(true, false);
  beepSuccess();
  showOLED("GATE OPEN", message.length() ? message : "Valid receipt", "Thank you");
}

void denyGate(String message) {
  setLeds(false, true);
  beepError();
  showOLED("ACCESS DENIED", message.length() ? message : "Invalid receipt", "See cashier");
  mqttPump(2500);
  setLeds(false, false);
  showOLED("SMARTSCAN EXIT", "Gate CLOSED", "Scan receipt QR");
}

void sendStatus(String status) {
  if (!mqttClient.connected()) return;
  String message = "{";
  message += "\"device\":\"";
  message += DEVICE_NAME;
  message += "\",\"status\":\"";
  message += status;
  message += "\"}";
  mqttClient.publish(MQTT_STATUS_TOPIC, message.c_str());
}

void publishExitScan(String qrPayload) {
  if (!mqttClient.connected()) {
    Serial.println("MQTT NOT CONNECTED");
    showOLED("MQTT ERROR", "Not connected", "Retrying...");
    return;
  }

  qrPayload.trim();
  if (qrPayload.length() < 8) {
    denyGate("Bad QR");
    return;
  }

  String message = "{";
  message += "\"device\":\"";
  message += DEVICE_NAME;
  message += "\",\"deviceKey\":\"";
  message += DEVICE_API_KEY;
  message += "\",\"qrPayload\":\"";
  // Escape quotes in payload
  for (unsigned int i = 0; i < qrPayload.length(); i++) {
    char c = qrPayload[i];
    if (c == '"' || c == '\\') message += '\\';
    message += c;
  }
  message += "\"}";

  Serial.println("EXIT SCAN → MQTT");
  Serial.println(qrPayload);

  bool ok = mqttClient.publish(MQTT_EXIT_SCAN_TOPIC, message.c_str());
  showOLED("CHECKING...", "Receipt QR sent", ok ? "Wait for verify" : "Publish failed");
  setLeds(false, false);
}

void handleExitCommand(String raw) {
  raw.trim();
  String upper = raw;
  upper.toUpperCase();

  String command = upper;
  String message = "";

  // Accept plain ALLOW/DENY or JSON {"command":"ALLOW","message":"..."}
  if (raw.startsWith("{")) {
    int cPos = upper.indexOf("\"COMMAND\"");
    if (cPos >= 0) {
      int colon = upper.indexOf(':', cPos);
      int q1 = upper.indexOf('"', colon + 1);
      int q2 = upper.indexOf('"', q1 + 1);
      if (q1 >= 0 && q2 > q1) command = upper.substring(q1 + 1, q2);
    }
    int mPos = raw.indexOf("\"message\"");
    if (mPos < 0) mPos = raw.indexOf("\"Message\"");
    if (mPos >= 0) {
      int colon = raw.indexOf(':', mPos);
      int q1 = raw.indexOf('"', colon + 1);
      int q2 = raw.indexOf('"', q1 + 1);
      if (q1 >= 0 && q2 > q1) message = raw.substring(q1 + 1, q2);
    }
  }

  Serial.print("EXIT COMMAND: ");
  Serial.println(command);

  if (command.indexOf("ALLOW") >= 0 || command.indexOf("OPEN") >= 0 || command == "SUCCESS") {
    openGate(message.length() ? message : "VALID");
  } else if (command.indexOf("DENY") >= 0 || command.indexOf("CLOSED") >= 0 || command.indexOf("FAIL") >= 0) {
    denyGate(message.length() ? message : "Invalid");
  } else if (command == "READY") {
    closeGate();
  } else {
    Serial.println("Unknown exit command");
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String command = "";
  for (unsigned int i = 0; i < length; i++) {
    command += (char)payload[i];
  }
  Serial.println("MQTT EXIT MSG");
  Serial.println(command);
  handleExitCommand(command);
}

void connectWiFi() {
  showOLED("SMARTSCAN EXIT", "Connecting WiFi", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(READY_LED, HIGH);
    showOLED("WIFI OK", WiFi.localIP().toString(), "MQTT...");
    mqttPump(800);
  } else {
    digitalWrite(READY_LED, LOW);
    showOLED("WIFI FAILED", "Check SSID/pass", "Retrying loop");
  }
}

void connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  while (!mqttClient.connected()) {
    Serial.println("Connecting MQTT...");
    String clientId = String(DEVICE_NAME) + "-" + String(ESP.getChipId(), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("MQTT CONNECTED");
      mqttClient.subscribe(MQTT_EXIT_COMMAND_TOPIC);
      sendStatus("ONLINE");
      closeGate();
    } else {
      Serial.print("MQTT fail state=");
      Serial.println(mqttClient.state());
      mqttPump(2500);
    }
  }
}

void readSerialQr() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBuffer.length() > 0) {
        publishExitScan(serialBuffer);
        serialBuffer = "";
      }
    } else if (isPrintable(c)) {
      serialBuffer += c;
      if (serialBuffer.length() > 240) serialBuffer = "";
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(READY_LED, OUTPUT);
  setLeds(false, false);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(READY_LED, LOW);

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("OLED NOT DETECTED");
  } else {
    showOLED("SMARTSCAN EXIT", "Starting...", "Please wait");
  }

  gateServo.attach(SERVO_PIN);
  gateServo.write(GATE_CLOSED_ANGLE);

  connectWiFi();

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);
  connectMQTT();

  Serial.println("SMARTSCAN EXIT GATE READY");
  Serial.println("Paste/scan receipt QR ending with Enter");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(READY_LED, LOW);
    connectWiFi();
  } else {
    digitalWrite(READY_LED, HIGH);
  }

  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();

  readSerialQr();

  if (gateOpen && gateCloseAt > 0 && millis() >= gateCloseAt) {
    closeGate();
  }

  delay(10);
}
