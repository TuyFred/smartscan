const mqtt = require('mqtt');
const axios = require('axios');
const config = require('../config/env');
const { publishRfidCommand, publishExitCommand, MQTT_BROKER } = require('./mqttClient');

const CARD_TOPIC = process.env.MQTT_TOPIC || 'smartscan/rfid/card';
const EXIT_SCAN_TOPIC = process.env.MQTT_EXIT_SCAN_TOPIC || 'smartscan/exit/scan';
const DEVICE_KEY = process.env.IOT_API_KEY || config.iotApiKey || 'smartscan-iot-device-key-2026';

function localApiBase() {
  const port = process.env.PORT || config.port || 5000;
  // Bridge runs inside the same Node process — always prefer loopback first.
  // Set SMARTSCAN_API_URL only if the bridge is a separate service.
  if (process.env.SMARTSCAN_API_URL) return process.env.SMARTSCAN_API_URL;
  return `http://127.0.0.1:${port}`;
}

function normalizeCardUid(value) {
  return String(value ?? '')
    .trim()
    .replace(/[:\-\s]/g, '')
    .toUpperCase();
}

function commandFromRfidResponse(status, body) {
  if (status === 404) return 'NOT_REGISTERED';
  if (!body?.success) {
    const msg = String(body?.message || '').toLowerCase();
    if (msg.includes('not active') || msg.includes('status')) return 'PAYMENT_DENIED';
    return 'PAYMENT_DENIED';
  }

  const data = body.data || {};
  if (data.authorizationId) return 'PAYMENT_ALLOWED';
  if (!data.activeSession) return 'NO_SESSION';
  if (!(data.amountDue > 0)) return 'NO_SESSION';
  return 'READY';
}

async function forwardCardTap(payload) {
  const cardUid = normalizeCardUid(payload.cardUid || payload.uid || payload.card_uid);
  const deviceName = String(payload.device || payload.deviceName || '').trim();
  const deviceKey = String(payload.deviceKey || payload.apiKey || DEVICE_KEY).trim();

  if (!cardUid) {
    console.warn('[MQTT] Empty cardUid received');
    publishRfidCommand('PAYMENT_DENIED');
    return;
  }

  console.log(`[MQTT] Card tap UID=${cardUid} device=${deviceName || 'unknown'}`);

  const headers = { 'Content-Type': 'application/json' };
  if (deviceKey) headers['x-device-key'] = deviceKey;
  if (deviceName) headers['x-device-name'] = deviceName;

  const apiBase = localApiBase();
  try {
    const response = await axios.post(
      `${apiBase}/api/rfid/read`,
      { cardUid, ...(deviceName ? { device: deviceName } : {}) },
      { headers, timeout: 15000, validateStatus: () => true }
    );

    const command = commandFromRfidResponse(response.status, response.data);
    publishRfidCommand(command);
    console.log('[MQTT] RFID API:', response.status, response.data?.message || response.data);
  } catch (err) {
    console.error('[MQTT] Failed to forward card tap:', err.response?.data || err.message);
    publishRfidCommand('PAYMENT_DENIED');
  }
}

async function forwardExitScan(payload) {
  const qrPayload = String(payload.qrPayload || payload.qr || payload.payload || '').trim();
  const deviceName = String(payload.device || payload.deviceName || 'SMARTSCAN-EXIT-01').trim();
  const deviceKey = String(payload.deviceKey || payload.apiKey || DEVICE_KEY).trim();

  if (!qrPayload) {
    publishExitCommand('DENY', { message: 'Empty QR payload' });
    return;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (deviceKey) headers['x-device-key'] = deviceKey;
  if (deviceName) headers['x-device-name'] = deviceName;

  const apiBase = localApiBase();
  try {
    const response = await axios.post(
      `${apiBase}/api/exit/verify`,
      { qrPayload },
      { headers, timeout: 15000, validateStatus: () => true }
    );

    if (response.data?.valid || response.data?.action === 'ALLOW') {
      publishExitCommand('ALLOW', {
        message: response.data.message || 'VALID',
        receiptNumber: response.data?.data?.receiptNumber,
      });
    } else {
      publishExitCommand('DENY', {
        message: response.data?.message || 'Invalid receipt',
      });
    }
  } catch (err) {
    console.error('[MQTT] Exit verify failed:', err.response?.data || err.message);
    publishExitCommand('DENY', { message: 'Verify failed' });
  }
}

function startMqttBridge() {
  const client = mqtt.connect(MQTT_BROKER, {
    clientId: `smartscan-bridge-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    console.log(`[MQTT] Bridge connected to ${MQTT_BROKER}`);
    client.subscribe([CARD_TOPIC, EXIT_SCAN_TOPIC], (err) => {
      if (err) {
        console.error('[MQTT] Subscription error:', err);
        return;
      }
      console.log(`[MQTT] Subscribed to ${CARD_TOPIC}, ${EXIT_SCAN_TOPIC}`);
    });
  });

  client.on('error', (err) => {
    console.error('[MQTT] Bridge error:', err.message);
  });

  client.on('message', async (topic, message) => {
    try {
      const raw = message.toString();
      let payload = {};
      try {
        payload = JSON.parse(raw);
      } catch {
        if (topic === EXIT_SCAN_TOPIC) payload = { qrPayload: raw.trim() };
        else payload = { cardUid: raw.trim() };
      }

      if (topic === CARD_TOPIC) await forwardCardTap(payload);
      else if (topic === EXIT_SCAN_TOPIC) await forwardExitScan(payload);
    } catch (err) {
      console.error('[MQTT] Message handler error:', err.message);
    }
  });

  console.log('[MQTT] SmartScan bridge started');
  console.log(`[MQTT] Card topic: ${CARD_TOPIC}`);
  console.log(`[MQTT] Exit topic: ${EXIT_SCAN_TOPIC}`);
  console.log(`[MQTT] API target: ${localApiBase()}`);
}

startMqttBridge();

module.exports = { startMqttBridge, normalizeCardUid, forwardCardTap };
