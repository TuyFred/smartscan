/*
 * SMARTSCAN ESP32 — Exit Verification
 * QR scanner (UART) + green/red LEDs + buzzer + servo gate
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASSWORD";
const char* API_BASE = "http://YOUR_PC_IP:5000";
const char* DEVICE_API_KEY = "smartscan-iot-device-key-2026";

#define LED_GREEN 25
#define LED_RED 26
#define BUZZER 27
#define SERVO_PIN 14

Servo gate;
HardwareSerial QRSerial(2); // RX=16 TX=17 for QR module

void successAction() {
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, LOW);
  tone(BUZZER, 1200, 120);
  gate.write(90);
  delay(3000);
  gate.write(0);
  digitalWrite(LED_GREEN, LOW);
}

void failAction() {
  digitalWrite(LED_RED, HIGH);
  digitalWrite(LED_GREEN, LOW);
  tone(BUZZER, 400, 400);
  delay(800);
  digitalWrite(LED_RED, LOW);
}

void setup() {
  Serial.begin(115200);
  QRSerial.begin(9600, SERIAL_8N1, 16, 17);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  gate.attach(SERVO_PIN);
  gate.write(0);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("Exit device online");
}

void verifyPayload(String payload) {
  payload.trim();
  if (!payload.startsWith("SMARTSCAN_RECEIPT:")) return;

  HTTPClient http;
  http.begin(String(API_BASE) + "/api/exit/verify");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_API_KEY);
  String body = "{\"qrPayload\":\"" + payload + "\"}";
  int code = http.POST(body);
  String res = http.getString();
  Serial.println(res);
  http.end();

  StaticJsonDocument<512> doc;
  deserializeJson(doc, res);
  if (doc["valid"] == true) successAction();
  else failAction();
}

void loop() {
  if (QRSerial.available()) {
    String payload = QRSerial.readStringUntil('\n');
    verifyPayload(payload);
  }
}
