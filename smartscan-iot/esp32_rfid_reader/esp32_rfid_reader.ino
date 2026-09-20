/*
 * SMARTSCAN ESP32 RFID READER
 *
 * This device is ONLY used to read the UID and validate the card against the
 * SMARTSCAN API. It does NOT deduct money from the customer card.
 *
 * Correct flow for this project:
 * 1) Cashier/Admin must register or sell a card in the website dashboard.
 * 2) Customer scans branch QR and starts a shopping session.
 * 3) Customer taps card at the RFID reader.
 * 4) API checks card ownership, session and amount due.
 * 5) Customer enters PIN in the app/website.
 * 6) API checks PIN and deducts funds atomically.
 *
 * IMPORTANT:
 * - One customer must have only one card in the database.
 * - One card UID must belong to only one customer.
 * - Unknown cards are rejected.
 * - The reader never authorizes the payment by itself.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 5
#define RST_PIN 22

#define READY_LED 25
#define RFID_LED 26
#define BUZZER_PIN 27

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASSWORD";
const char* API_BASE = "http://YOUR_PC_IP:5000";
const char* DEVICE_API_KEY = "smartscan-iot-device-key-2026";

MFRC522 mfrc522(SS_PIN, RST_PIN);

String uidToString(MFRC522::Uid uid) {
  String s = "";
  for (byte i = 0; i < uid.size; i++) {
    if (uid.uidByte[i] < 0x10) s += "0";
    s += String(uid.uidByte[i], HEX);
  }
  s.toUpperCase();
  return s;
}

void beep(int onMs = 180, int offMs = 120) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(onMs);
  digitalWrite(BUZZER_PIN, LOW);
  delay(offMs);
}

void showOLED(String line1, String line2 = "", String line3 = "") {
  Serial.println("[OLED] " + line1 + " | " + line2 + " | " + line3);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected");
  } else {
    Serial.println();
    Serial.println("WiFi failed to connect");
  }
}

float extractJsonNumber(const String &json, const String &key) {
  int keyIndex = json.indexOf("\"" + key + "\"");
  if (keyIndex < 0) {
    return -1;
  }

  int colonIndex = json.indexOf(':', keyIndex);
  if (colonIndex < 0) {
    return -1;
  }

  String numberText = json.substring(colonIndex + 1);
  numberText.trim();

  int endIndex = numberText.indexOf(',');
  if (endIndex >= 0) numberText = numberText.substring(0, endIndex);

  endIndex = numberText.indexOf('}');
  if (endIndex >= 0) numberText = numberText.substring(0, endIndex);

  endIndex = numberText.indexOf(']');
  if (endIndex >= 0) numberText = numberText.substring(0, endIndex);

  numberText.trim();
  return numberText.toFloat();
}

bool jsonContains(const String &json, const String &needle) {
  return json.indexOf(needle) >= 0;
}

String postRfidRead(const String &uid) {
  HTTPClient http;
  String endpoint = String(API_BASE) + "/api/rfid/read";

  http.begin(endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_API_KEY);

  String payload = "{\"cardUid\":\"" + uid + "\"}";
  int code = http.POST(payload);
  String body = http.getString();
  http.end();

  Serial.println("HTTP status: " + String(code));
  Serial.println(body);

  return String(code) + "|" + body;
}

void handleCardTap() {
  String uid = uidToString(mfrc522.uid);
  Serial.println();
  Serial.println("==================================================");
  Serial.println("CARD DETECTED");
  Serial.println("UID: " + uid);
  Serial.println("==================================================");

  digitalWrite(RFID_LED, HIGH);
  beep(150, 80);
  showOLED("CARD DETECTED", uid, "Checking... ");

  if (WiFi.status() != WL_CONNECTED) {
    showOLED("WIFI OFFLINE", "Check network", "Device cannot verify");
    digitalWrite(RFID_LED, LOW);
    delay(1500);
    return;
  }

  String result = postRfidRead(uid);
  int splitIndex = result.indexOf('|');
  int code = result.substring(0, splitIndex).toInt();
  String body = result.substring(splitIndex + 1);

  if (code == 200) {
    bool isRegistered = !jsonContains(body, "Unknown RFID card") && !jsonContains(body, "Card status");
    bool hasActiveSession = jsonContains(body, "\"activeSession\"") && !jsonContains(body, "\"activeSession\":null");
    float amountDue = extractJsonNumber(body, "amountDue");

    if (isRegistered) {
      if (hasActiveSession && amountDue > 0) {
        showOLED("CARD OK", "Active session", "PIN required");
        Serial.println("Amount due: " + String(amountDue));
        Serial.println("The customer must enter PIN in the SMARTSCAN app to authorize payment.");
      } else {
        showOLED("CARD OK", "Registered", "Ready to shop");
        Serial.println("Card is registered but no active session or amount due.");
      }
    } else {
      showOLED("CARD NOT", "REGISTERED", "Not allowed");
      Serial.println("Card is not known in the system.");
    }

    digitalWrite(RFID_LED, LOW);
    delay(1800);
    showOLED("SMARTSCAN", "RFID READY", "Tap your card");
    return;
  }

  if (code == 404 || jsonContains(body, "Unknown RFID card")) {
    showOLED("CARD NOT", "REGISTERED", "Payment denied");
    Serial.println("Unknown or unregistered card.");
    digitalWrite(RFID_LED, LOW);
    beep(200, 100);
    beep(200, 100);
    delay(2000);
    showOLED("SMARTSCAN", "RFID READY", "Tap your card");
    return;
  }

  if (code == 400 || jsonContains(body, "Card status")) {
    showOLED("CARD BLOCKED", "Contact cashier", "Status not active");
    digitalWrite(RFID_LED, LOW);
    beep(250, 150);
    delay(2000);
    showOLED("SMARTSCAN", "RFID READY", "Tap your card");
    return;
  }

  showOLED("SERVER ERROR", "Try again", "Check API");
  digitalWrite(RFID_LED, LOW);
  beep(300, 120);
  delay(2000);
  showOLED("SMARTSCAN", "RFID READY", "Tap your card");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(READY_LED, OUTPUT);
  pinMode(RFID_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(READY_LED, LOW);
  digitalWrite(RFID_LED, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  SPI.begin();
  mfrc522.PCD_Init();

  connectWiFi();

  Serial.println();
  Serial.println("========================================");
  Serial.println("SMARTSCAN RFID READER STARTED");
  Serial.println("========================================");

  digitalWrite(READY_LED, HIGH);
  showOLED("SMARTSCAN", "RFID READY", "Tap your card");
}

void loop() {
  digitalWrite(READY_LED, HIGH);

  if (!mfrc522.PICC_IsNewCardPresent()) {
    delay(50);
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  handleCardTap();
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(300);
}
