const mqtt = require('mqtt');
const axios = require('axios');
const config = require('../config/env');

const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'smartscan/rfid/card';
const API_URL = process.env.SMARTSCAN_API_URL || 'http://localhost:5000';
const DEVICE_KEY = process.env.IOT_API_KEY || config.iotApiKey || 'smartscan-iot-device-key-2026';

const client = mqtt.connect(MQTT_BROKER, {
  clientId: 'smartscan-backend-bridge',
  clean: true,
  reconnectPeriod: 5000,
});

client.on('connect', () => {
  console.log(`[MQTT] Connected to ${MQTT_BROKER}`);
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error('[MQTT] Subscription error:', err);
      return;
    }
    console.log(`[MQTT] Subscribed to ${MQTT_TOPIC}`);
  });
});

client.on('error', (err) => {
  console.error('[MQTT] Connection error:', err.message);
});

client.on('message', async (topic, message) => {
  if (topic !== MQTT_TOPIC) return;

  try {
    const raw = message.toString();
    const payload = JSON.parse(raw);
    const cardUid = String(payload.cardUid || '').trim().toUpperCase();
    const deviceKey = String(payload.deviceKey || DEVICE_KEY).trim();

    if (!cardUid) {
      console.warn('[MQTT] Empty cardUid received');
      return;
    }

    console.log(`[MQTT] Received card UID: ${cardUid}`);

    const response = await axios.post(
      `${API_URL}/api/rfid/read`,
      { cardUid },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-device-key': deviceKey,
        },
        timeout: 10000,
      }
    );

    console.log('[MQTT] Backend response:', response.data);
  } catch (err) {
    console.error('[MQTT] Failed to forward UID to backend:', err.response?.data || err.message);
  }
});

process.on('SIGINT', () => {
  client.end();
  process.exit(0);
});

console.log('[MQTT] SmartScan bridge started');
console.log(`[MQTT] Topic: ${MQTT_TOPIC}`);
console.log(`[MQTT] API target: ${API_URL}/api/rfid/read`);
