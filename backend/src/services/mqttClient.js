const mqtt = require('mqtt');

const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io';
const COMMAND_TOPIC = process.env.MQTT_COMMAND_TOPIC || 'smartscan/rfid/command';
const EXIT_COMMAND_TOPIC = process.env.MQTT_EXIT_COMMAND_TOPIC || 'smartscan/exit/command';

let client = null;

function getClient() {
  if (client) return client;

  client = mqtt.connect(MQTT_BROKER, {
    clientId: `smartscan-api-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    console.log(`[MQTT] Publisher connected to ${MQTT_BROKER}`);
  });

  client.on('error', (err) => {
    console.error('[MQTT] Publisher error:', err.message);
  });

  return client;
}

function publish(topic, message) {
  try {
    const c = getClient();
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    if (!c.connected) {
      c.once('connect', () => c.publish(topic, payload));
      return;
    }
    c.publish(topic, payload);
  } catch (err) {
    console.error('[MQTT] Publish failed:', err.message);
  }
}

function publishRfidCommand(command) {
  const cmd = String(command || '').trim().toUpperCase();
  if (!cmd) return;
  publish(COMMAND_TOPIC, cmd);
  console.log(`[MQTT] Command → ${COMMAND_TOPIC}: ${cmd}`);
}

function publishExitCommand(command, extra = {}) {
  const cmd = String(command || '').trim().toUpperCase();
  if (!cmd) return;
  publish(EXIT_COMMAND_TOPIC, JSON.stringify({ command: cmd, ...extra }));
  console.log(`[MQTT] Exit command → ${EXIT_COMMAND_TOPIC}: ${cmd}`);
}

module.exports = {
  getClient,
  publish,
  publishRfidCommand,
  publishExitCommand,
  COMMAND_TOPIC,
  EXIT_COMMAND_TOPIC,
  MQTT_BROKER,
};
