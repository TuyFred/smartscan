#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================================================
// SMARTSCAN RFID PAYMENT DEVICE
// ESP8266 NODEMCU + MFRC522 + OLED + BUZZER + LEDs
// =====================================================


// =====================================================
// WIFI SETTINGS
// =====================================================

const char* WIFI_SSID = "net";
const char* WIFI_PASSWORD = "1234567890";


// =====================================================
// MQTT SETTINGS
// =====================================================

const char* MQTT_SERVER = "broker.emqx.io";
const int MQTT_PORT = 1883;


// Card tap messages sent to backend
const char* MQTT_CARD_TOPIC =
  "smartscan/rfid/card";

// Commands received from backend
const char* MQTT_COMMAND_TOPIC =
  "smartscan/rfid/command";

// Device status
const char* MQTT_STATUS_TOPIC =
  "smartscan/rfid/status";


// =====================================================
// DEVICE NAME
// =====================================================

const char* DEVICE_NAME =
  "SMARTSCAN-RFID-01";

const char* DEVICE_API_KEY = "5aef2560f2e82b80dc7fe02a533c85cf33950853";  


// =====================================================
// RFID PINS
// =====================================================

#define RFID_SS_PIN D8
#define RFID_RST_PIN D0


// =====================================================
// OLED PINS
// =====================================================

#define OLED_SDA D2
#define OLED_SCL D1

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_ADDRESS 0x3C


// =====================================================
// LED PINS
// =====================================================

// Wi-Fi / system ready LED
#define READY_LED D4

// Card detected LED
// GPIO3 / RX
#define RFID_LED 3


// =====================================================
// BUZZER
// =====================================================

#define BUZZER_PIN D3


// =====================================================
// OBJECTS
// =====================================================

MFRC522 rfid(
  RFID_SS_PIN,
  RFID_RST_PIN
);

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  -1
);

WiFiClient espClient;

PubSubClient mqttClient(
  espClient
);


// =====================================================
// SYSTEM MODES
// =====================================================

enum SystemMode {

  MODE_PAYMENT,

  MODE_REGISTRATION
};

SystemMode currentMode =
  MODE_PAYMENT;


// =====================================================
// CARD PROTECTION
// =====================================================

String lastUID = "";

unsigned long lastCardTime = 0;

const unsigned long CARD_COOLDOWN =
  3000;


// =====================================================
// PAYMENT STATE
// =====================================================

bool waitingForPIN = false;

String currentPaymentUID = "";


// =====================================================
// OLED FUNCTION
// =====================================================

void showOLED(
  String line1,
  String line2 = "",
  String line3 = ""
) {

  display.clearDisplay();

  display.setTextColor(
    SSD1306_WHITE
  );

  display.setTextSize(1);

  display.setCursor(0, 0);

  display.println(line1);

  display.setCursor(0, 20);

  display.println(line2);

  display.setCursor(0, 40);

  display.println(line3);

  display.display();
}


// =====================================================
// READY SCREEN
// =====================================================

void showReadyScreen() {

  waitingForPIN = false;

  currentPaymentUID = "";

  if (
    currentMode ==
    MODE_REGISTRATION
  ) {

    showOLED(
      "SMARTSCAN",
      "REGISTER CARD",
      "Tap Card"
    );

  } else {

    showOLED(
      "SMARTSCAN",
      "PAYMENT READY",
      "Tap Card"
    );
  }
}


// =====================================================
// NORMAL BEEP
// =====================================================

void beep() {

  digitalWrite(
    BUZZER_PIN,
    HIGH
  );

  delay(250);

  digitalWrite(
    BUZZER_PIN,
    LOW
  );
}


// =====================================================
// SUCCESS BEEP
// =====================================================

void successBeep() {

  digitalWrite(
    BUZZER_PIN,
    HIGH
  );

  delay(120);

  digitalWrite(
    BUZZER_PIN,
    LOW
  );

  delay(100);

  digitalWrite(
    BUZZER_PIN,
    HIGH
  );

  delay(120);

  digitalWrite(
    BUZZER_PIN,
    LOW
  );
}


// =====================================================
// ERROR BEEP
// =====================================================

void errorBeep() {

  digitalWrite(
    BUZZER_PIN,
    HIGH
  );

  delay(600);

  digitalWrite(
    BUZZER_PIN,
    LOW
  );
}


// =====================================================
// GET RFID UID
// =====================================================

String getUID() {

  String uid = "";

  for (
    byte i = 0;
    i < rfid.uid.size;
    i++
  ) {

    if (
      rfid.uid.uidByte[i] < 0x10
    ) {

      uid += "0";
    }

    uid += String(
      rfid.uid.uidByte[i],
      HEX
    );

    if (
      i < rfid.uid.size - 1
    ) {

      uid += ":";
    }
  }

  // IMPORTANT:
  // toUpperCase() modifies the String.
  // It does NOT return a String.

  uid.toUpperCase();

  return uid;
}


// =====================================================
// SEND CARD TAP TO BACKEND
// =====================================================

void sendCardEvent(
  String uid
) {

  if (
    !mqttClient.connected()
  ) {

    Serial.println(
      "MQTT NOT CONNECTED"
    );

    return;
  }


  String mode;


  if (
    currentMode ==
    MODE_REGISTRATION
  ) {

    mode = "REGISTRATION";

  } else {

    mode = "PAYMENT";
  }


  String message = "{";


  message +=
    "\"device\":\"";

  message +=
    DEVICE_NAME;

  message +=
    "\",";


  message +=
    "\"deviceKey\":\"";

  message +=
    DEVICE_API_KEY;

  message +=
    "\",";


  message +=
    "\"cardUid\":\"";

  message +=
    uid;

  message +=
    "\",";


  message +=
    "\"mode\":\"";

  message +=
    mode;

  message +=
    "\",";


  message +=
    "\"event\":\"CARD_TAPPED\"";


  message += "}";


  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.println(
    "CARD EVENT"
  );

  Serial.println(
    "================================"
  );

  Serial.print(
    "UID: "
  );

  Serial.println(uid);


  Serial.print(
    "MODE: "
  );

  Serial.println(mode);


  Serial.println(
    "Sending MQTT..."
  );


  bool result =
    mqttClient.publish(
      MQTT_CARD_TOPIC,
      message.c_str()
    );


  if (result) {

    Serial.println(
      "CARD EVENT SENT"
    );

  } else {

    Serial.println(
      "CARD EVENT FAILED"
    );
  }


  Serial.println(
    "================================"
  );
}


// =====================================================
// SEND STATUS
// =====================================================

void sendStatus(
  String status
) {

  if (
    !mqttClient.connected()
  ) {

    return;
  }


  String message = "{";


  message +=
    "\"device\":\"";

  message +=
    DEVICE_NAME;

  message +=
    "\",";


  message +=
    "\"status\":\"";

  message +=
    status;

  message +=
    "\"";


  message += "}";


  mqttClient.publish(
    MQTT_STATUS_TOPIC,
    message.c_str()
  );
}


// =====================================================
// MQTT CALLBACK
// =====================================================

void mqttCallback(
  char* topic,
  byte* payload,
  unsigned int length
) {

  String command = "";


  for (
    unsigned int i = 0;
    i < length;
    i++
  ) {

    command +=
      (char)payload[i];
  }


  command.trim();

  command.toUpperCase();


  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.println(
    "MQTT COMMAND"
  );

  Serial.println(
    "================================"
  );

  Serial.print(
    "Command: "
  );

  Serial.println(command);


  // ===================================================
  // REGISTRATION MODE
  // ===================================================

  if (
    command == "REGISTER"
  ) {

    currentMode =
      MODE_REGISTRATION;


    waitingForPIN =
      false;


    showOLED(
      "SMARTSCAN",
      "REGISTER MODE",
      "Tap Card"
    );


    Serial.println(
      "REGISTRATION MODE"
    );


    sendStatus(
      "REGISTRATION_MODE"
    );
  }


  // ===================================================
  // PAYMENT MODE
  // ===================================================

  else if (
    command == "PAYMENT"
  ) {

    currentMode =
      MODE_PAYMENT;


    waitingForPIN =
      false;


    showOLED(
      "SMARTSCAN",
      "PAYMENT MODE",
      "Tap Card"
    );


    Serial.println(
      "PAYMENT MODE"
    );


    sendStatus(
      "PAYMENT_MODE"
    );
  }


  // ===================================================
  // READY
  // ===================================================

  else if (
    command == "READY"
  ) {

    showReadyScreen();

    sendStatus(
      "READY"
    );
  }


  // ===================================================
  // CARD REGISTERED
  // ===================================================

  else if (
    command == "REGISTERED"
  ) {

    successBeep();


    digitalWrite(
      RFID_LED,
      HIGH
    );


    showOLED(
      "CARD REGISTERED",
      "Successfully",
      "Card Ready"
    );


    Serial.println(
      "CARD REGISTERED"
    );


    delay(2500);


    digitalWrite(
      RFID_LED,
      LOW
    );


    showReadyScreen();
  }


  // ===================================================
  // ALREADY REGISTERED
  // ===================================================

  else if (
    command ==
    "ALREADY_REGISTERED"
  ) {

    errorBeep();


    showOLED(
      "CARD ERROR",
      "Already Registered",
      "Try Another"
    );


    Serial.println(
      "CARD ALREADY REGISTERED"
    );


    delay(2500);


    showReadyScreen();
  }


  // ===================================================
  // CARD NOT REGISTERED
  // ===================================================

  else if (
    command ==
    "NOT_REGISTERED"
  ) {

    errorBeep();


    showOLED(
      "CARD NOT FOUND",
      "Not Registered",
      "Check UID"
    );


    Serial.println(
      "CARD NOT REGISTERED"
    );


    delay(3000);


    showReadyScreen();
  }


  // ===================================================
  // NO SHOPPING SESSION
  // ===================================================

  else if (
    command ==
    "NO_SESSION"
  ) {

    errorBeep();


    showOLED(
      "NO SESSION",
      "Start Shopping",
      "Scan Store QR"
    );


    Serial.println(
      "NO ACTIVE SHOPPING SESSION"
    );


    delay(3000);


    showReadyScreen();
  }


  // ===================================================
  // WRONG CUSTOMER
  // ===================================================

  else if (
    command ==
    "WRONG_CUSTOMER"
  ) {

    errorBeep();


    showOLED(
      "CARD ERROR",
      "Wrong Customer",
      "Use Your Card"
    );


    Serial.println(
      "WRONG CUSTOMER"
    );


    delay(3000);


    showReadyScreen();
  }


  // ===================================================
  // PAYMENT ALLOWED
  // ===================================================

  else if (
    command ==
    "PAYMENT_ALLOWED"
  ) {

    successBeep();


    waitingForPIN =
      true;


    showOLED(
      "CARD VERIFIED",
      "Payment Allowed",
      "ENTER PIN"
    );


    Serial.println();
    Serial.println(
      "================================"
    );

    Serial.println(
      "CARD VERIFIED"
    );

    Serial.println(
      "PAYMENT ALLOWED"
    );

    Serial.println(
      "CUSTOMER MUST ENTER PIN"
    );

    Serial.println(
      "ON WEB DASHBOARD"
    );

    Serial.println(
      "================================"
    );
  }


  // ===================================================
  // ASK PIN
  // ===================================================

  else if (
    command ==
    "ENTER_PIN"
  ) {

    waitingForPIN =
      true;


    showOLED(
      "CARD VERIFIED",
      "Enter PIN",
      "On Dashboard"
    );


    Serial.println(
      "PIN REQUIRED"
    );
  }


  // ===================================================
  // WRONG PIN
  // ===================================================

  else if (
    command ==
    "WRONG_PIN"
  ) {

    waitingForPIN =
      false;


    errorBeep();


    showOLED(
      "PAYMENT FAILED",
      "Wrong PIN",
      "Try Again"
    );


    Serial.println(
      "WRONG PIN"
    );


    delay(3000);


    showReadyScreen();
  }


  // ===================================================
  // INSUFFICIENT BALANCE
  // ===================================================

  else if (
    command ==
    "INSUFFICIENT_BALANCE"
  ) {

    waitingForPIN =
      false;


    errorBeep();


    showOLED(
      "PAYMENT FAILED",
      "Insufficient",
      "Balance"
    );


    Serial.println(
      "INSUFFICIENT BALANCE"
    );


    delay(3000);


    showReadyScreen();
  }


  // ===================================================
  // PAYMENT DENIED
  // ===================================================

  else if (
    command ==
    "PAYMENT_DENIED"
  ) {

    waitingForPIN =
      false;


    errorBeep();


    showOLED(
      "PAYMENT DENIED",
      "Access Denied",
      "Try Again"
    );


    Serial.println(
      "PAYMENT DENIED"
    );


    delay(3000);


    showReadyScreen();
  }


  // ===================================================
  // PAYMENT SUCCESS
  // ===================================================

  else if (
    command ==
    "PAYMENT_SUCCESS"
  ) {

    waitingForPIN =
      false;


    successBeep();


    digitalWrite(
      RFID_LED,
      HIGH
    );


    showOLED(
      "PAYMENT SUCCESS",
      "Money Deducted",
      "Receipt Ready"
    );


    Serial.println();
    Serial.println(
      "================================"
    );

    Serial.println(
      "PAYMENT SUCCESS"
    );

    Serial.println(
      "MONEY DEDUCTED"
    );

    Serial.println(
      "RECEIPT READY"
    );

    Serial.println(
      "================================"
    );


    delay(3500);


    digitalWrite(
      RFID_LED,
      LOW
    );


    showReadyScreen();
  }


  // ===================================================
  // PAYMENT CANCELLED
  // ===================================================

  else if (
    command ==
    "PAYMENT_CANCELLED"
  ) {

    waitingForPIN =
      false;


    errorBeep();


    showOLED(
      "PAYMENT",
      "Cancelled",
      "Thank You"
    );


    delay(2500);


    showReadyScreen();
  }


  // ===================================================
  // UNKNOWN COMMAND
  // ===================================================

  else {

    Serial.println(
      "UNKNOWN COMMAND"
    );
  }


  Serial.println(
    "================================"
  );
}


// =====================================================
// WIFI CONNECTION
// =====================================================

void connectWiFi() {

  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.println(
    "CONNECTING WIFI"
  );

  Serial.println(
    "================================"
  );


  digitalWrite(
    READY_LED,
    LOW
  );


  showOLED(
    "SMARTSCAN",
    "Connecting WiFi",
    "Please wait..."
  );


  WiFi.mode(
    WIFI_STA
  );


  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );


  unsigned long startTime =
    millis();


  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startTime < 20000
  ) {

    delay(500);

    Serial.print(".");
  }


  Serial.println();


  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {

    digitalWrite(
      READY_LED,
      HIGH
    );


    Serial.println(
      "WIFI CONNECTED"
    );


    Serial.print(
      "IP: "
    );


    Serial.println(
      WiFi.localIP()
    );


    showOLED(
      "WIFI CONNECTED",
      WiFi.localIP().toString(),
      "MQTT Starting"
    );


    delay(1500);
  }


  else {

    digitalWrite(
      READY_LED,
      LOW
    );


    Serial.println(
      "WIFI FAILED"
    );


    showOLED(
      "WIFI ERROR",
      "Connection Failed",
      "Check WiFi"
    );


    delay(2000);
  }
}


// =====================================================
// MQTT CONNECTION
// =====================================================

void connectMQTT() {

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    return;
  }


  while (
    !mqttClient.connected()
  ) {

    Serial.println(
      "Connecting MQTT..."
    );


    String clientId =
      DEVICE_NAME;


    clientId += "-";


    clientId += String(
      ESP.getChipId(),
      HEX
    );


    if (
      mqttClient.connect(
        clientId.c_str()
      )
    ) {

      Serial.println(
        "MQTT CONNECTED"
      );


      mqttClient.subscribe(
        MQTT_COMMAND_TOPIC
      );


      Serial.println(
        "MQTT SUBSCRIBED"
      );


      sendStatus(
        "ONLINE"
      );


      showReadyScreen();
    }


    else {

      Serial.print(
        "MQTT FAILED STATE: "
      );


      Serial.println(
        mqttClient.state()
      );


      delay(3000);
    }
  }
}


// =====================================================
// READ RFID
// =====================================================

void readRFID() {

  if (
    !rfid.PICC_IsNewCardPresent()
  ) {

    return;
  }


  if (
    !rfid.PICC_ReadCardSerial()
  ) {

    return;
  }


  // ===================================================
  // GET UID
  // ===================================================

  String uid =
    getUID();


  // ===================================================
  // DUPLICATE PROTECTION
  // ===================================================

  if (
    uid == lastUID &&
    millis() - lastCardTime <
    CARD_COOLDOWN
  ) {

    Serial.println(
      "Duplicate card ignored"
    );


    rfid.PICC_HaltA();

    rfid.PCD_StopCrypto1();

    return;
  }


  lastUID =
    uid;


  lastCardTime =
    millis();


  // ===================================================
  // SAVE CURRENT PAYMENT CARD
  // ===================================================

  if (
    currentMode ==
    MODE_PAYMENT
  ) {

    currentPaymentUID =
      uid;
  }


  // ===================================================
  // CARD LED
  // ===================================================

  digitalWrite(
    RFID_LED,
    HIGH
  );


  // ===================================================
  // BUZZER
  // ===================================================

  beep();


  // ===================================================
  // SERIAL
  // ===================================================

  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.println(
    "RFID CARD DETECTED"
  );

  Serial.println(
    "================================"
  );


  Serial.print(
    "UID: "
  );

  Serial.println(uid);


  if (
    currentMode ==
    MODE_REGISTRATION
  ) {

    Serial.println(
      "MODE: REGISTRATION"
    );

  } else {

    Serial.println(
      "MODE: PAYMENT"
    );
  }


  Serial.println(
    "================================"
  );


  // ===================================================
  // OLED SHOW UID
  // ===================================================

  showOLED(
    "CARD DETECTED!",
    "UID:",
    uid
  );


  // ===================================================
  // SEND TO BACKEND
  // ===================================================

  sendCardEvent(
    uid
  );


  // ===================================================
  // KEEP UID ON SCREEN
  // ===================================================

  delay(1500);


  // ===================================================
  // TURN CARD LED OFF
  // ===================================================

  digitalWrite(
    RFID_LED,
    LOW
  );


  // ===================================================
  // STOP RFID CARD
  // ===================================================

  rfid.PICC_HaltA();

  rfid.PCD_StopCrypto1();


  // ===================================================
  // RETURN READY SCREEN
  // ===================================================

  if (
    !waitingForPIN
  ) {

    showReadyScreen();
  }
}


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(
    115200
  );


  delay(500);


  Serial.println();
  Serial.println();

  Serial.println(
    "================================"
  );

  Serial.println(
    "SMARTSCAN RFID PAYMENT SYSTEM"
  );

  Serial.println(
    "NODEMCU ESP8266"
  );

  Serial.println(
    "================================"
  );


  // ===================================================
  // PIN SETUP
  // ===================================================

  pinMode(
    READY_LED,
    OUTPUT
  );


  pinMode(
    RFID_LED,
    OUTPUT
  );


  pinMode(
    BUZZER_PIN,
    OUTPUT
  );


  digitalWrite(
    READY_LED,
    LOW
  );


  digitalWrite(
    RFID_LED,
    LOW
  );


  digitalWrite(
    BUZZER_PIN,
    LOW
  );


  // ===================================================
  // OLED
  // ===================================================

  Wire.begin(
    OLED_SDA,
    OLED_SCL
  );


  if (
    !display.begin(
      SSD1306_SWITCHCAPVCC,
      OLED_ADDRESS
    )
  ) {

    Serial.println(
      "OLED NOT DETECTED!"
    );


    while (true) {

      digitalWrite(
        BUZZER_PIN,
        HIGH
      );


      delay(100);


      digitalWrite(
        BUZZER_PIN,
        LOW
      );


      delay(900);
    }
  }


  Serial.println(
    "OLED OK"
  );


  showOLED(
    "SMARTSCAN",
    "Starting...",
    "Please wait"
  );


  delay(1500);


  // ===================================================
  // RFID
  // ===================================================

  SPI.begin();


  rfid.PCD_Init();


  delay(100);


  Serial.println(
    "RFID INITIALIZED"
  );


  byte version =
    rfid.PCD_ReadRegister(
      MFRC522::VersionReg
    );


  Serial.print(
    "MFRC522 Version: 0x"
  );


  Serial.println(
    version,
    HEX
  );


  // ===================================================
  // WIFI
  // ===================================================

  connectWiFi();


  // ===================================================
  // MQTT
  // ===================================================

  mqttClient.setServer(
    MQTT_SERVER,
    MQTT_PORT
  );


  mqttClient.setCallback(
    mqttCallback
  );


  connectMQTT();


  // ===================================================
  // READY
  // ===================================================

  digitalWrite(
    RFID_LED,
    LOW
  );


  showReadyScreen();


  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.println(
    "SMARTSCAN READY"
  );

  Serial.println(
    "Tap RFID Card"
  );

  Serial.println(
    "================================"
  );
}


// =====================================================
// LOOP
// =====================================================

void loop() {

  // ===================================================
  // WIFI
  // ===================================================

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    digitalWrite(
      READY_LED,
      LOW
    );


    connectWiFi();

  } else {

    digitalWrite(
      READY_LED,
      HIGH
    );
  }


  // ===================================================
  // MQTT
  // ===================================================

  if (
    !mqttClient.connected()
  ) {

    connectMQTT();
  }


  mqttClient.loop();


  // ===================================================
  // RFID
  // ===================================================

  readRFID();


  delay(10);
}
