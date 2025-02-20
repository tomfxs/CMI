const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const mqtt = require('mqtt');

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const { command, getConfig } = require('./const.js');
const config = getConfig();

// CookieJar erstellen
const jar = new CookieJar();

// Axios-Instanz mit Cookie-Unterstützung erstellen
const client = wrapper(axios.create({ jar }));
console.log('Config loaded:', config);

// URL der fremden Webseite
const MQTT_URL = `mqtt:/${config.mqtt_host}:${config.mqtt_port}`;
const BASEURL=`http://${config.cmi_host}/schematic_files`;
console.log('MQTT_URL:', MQTT_URL);
const mqttClient = mqtt.connect(MQTT_URL, {
  username: config.mqtt_user,
  password: config.mqtt_password,
});

const pub = (topic, data) => {
  console.log(`Veröffentliche ${data} auf ${topic}`);
  mqttClient.publish(`homeassistant/cmi/${topic}`, data, {}, (err) => {
    if (err) {
      console.error('Fehler beim Veröffentlichen:', err.message);
    }
  });
}

const send = (data) => {
      // Nachricht veröffentlichen
  mqttClient.publish('homeassistant/cmi/data', JSON.stringify(data), {}, (err) => {
    if (err) {
      console.error('Fehler beim Veröffentlichen:', err.message);
    } else {
      console.log(`Nachricht veröffentlicht: ${JSON.stringify(data)}`);
    }
  });

  if (data.heatpump && data.heating) {
    pub('mode', 'heat');
  }
  if (data.heatpump && data.cooling) {
    pub('mode', 'cool');
  }
  if (!data.heatpump) {
    pub('mode', 'auto');
  }
  pub('target_temperature', data.target_temperature);
  pub('temperature', data.temperature_room);
  pub('humidity', data.humidity);
  pub('target_humidity', data.target_humidity);
  switch(data.fan) {
    case 'Lüfter aus':
      pub('fan', 'off');
      break;
    case 'Lüfterstufe KWL':
      pub('fan', 'auto');
      break;
    case 'Lüfterstufe 1':
      pub('fan', 'low');
      break;
    case 'Lüfterstufe 2':
      pub('fan', 'medium');
      break;
    case 'Lüfterstufe 3':
      pub('fan', 'high');
      break;
  }
}

const pull = async () => {
  try {
    const result = {};

    let response = await client.get(`${BASEURL}/1.cgi`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.cmi_user}:${config.cmi_password}`).toString('base64')}`
      },
    });

    let dom = new JSDOM(response.data);
    let document = dom.window.document;

    // Target Temperature
    const getValue = (id, attribute) => {
      if (attribute) {
        return document.getElementById(id).getAttribute(attribute).replace(/\\n/g, '').trim();
      }

      return document.getElementById(id).textContent
        .replace(/\\n/g, '')
        .replace(' °C', '')
        .replace(' %', '')
        .replace(' ppm', '')
        .trim();
    }

    result.target_temperature = getValue('pos8', 'pme_value');

    // Fan
    switch (getValue('pos10', 'class')) {
      case 'visible1':
        result.fan = 'Lüfter aus';
        break;
      case 'visible2':
        result.fan = 'Lüfterstufe KWL';
        break;
      case 'visible3':
        result.fan = 'Lüfterstufe 1';
        break;
      case 'visible4':
        result.fan = 'Lüfterstufe 2';
        break;
      default:
        result.class = getValue('pos10', 'class');
        result.fan = 'Lüfterstufe 3';
        break;
    }

    // Heatpump
    result.heatpump = getValue('pos16', 'class') === 'visible1';

    // Heating
    result.heating = getValue('pos3', 'class') === 'visible1';

    // Cooling
    result.cooling = getValue('pos4', 'class') === 'visible1';

    // Programm
    result.day = getValue('pos17', 'class') === 'visible1';
    result.night = getValue('pos17', 'class') === 'visible0';

    // Wartung
    response = await client.get(`${BASEURL}/12.cgi`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic YWRtaW46YWRtaW4='
      },
    });

    dom = new JSDOM(response.data);
    document = dom.window.document;

    // Outdoor Temperature
    result.temperature_outdoor = getValue('pos1');

    result.waermetauscher_rl = getValue('pos3');

    result.ext_akiv_sonnenth = getValue('pos5');
    result.abtauen = getValue('pos7');

    result.verteiler_vl = getValue('pos9');
    result.verteiler_rl = getValue('pos11');

    result.rueckluft = getValue('pos13');
    result.zuluft = getValue('pos15');

    result.stoerung_waermepumpe = getValue('pos16');

    result.hydr_weiche_erz = getValue('pos19');
    result.anf_vent_waermepumpen = getValue('pos21');

    result.temperature_room = getValue('pos23');

    result.humidity = getValue('pos25');

    result.co2 = getValue('pos27');


   // Befeuchtung
    response = await client.get(`${BASEURL}/7.cgi`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic YWRtaW46YWRtaW4='
      },
    });

    dom = new JSDOM(response.data);
    document = dom.window.document;

    // Outdoor Temperature
    result.target_humidity = getValue('pos8');

    return result;
  } catch (error) {
    console.error('Fehler beim Abrufen der Daten:', error.response?.data || error.message);
  }
}


mqttClient.on('connect', async () => {
  console.log('Verbunden mit dem MQTT-Broker');

  setInterval(async () => {
    const data = await pull();
    send(data);
  }, 10 * 1000);

  const data = await pull();
  send(data);

  mqttClient.subscribe("homeassistant/cmi/set/#", (err) => {
    if (!err) {
       console.log('Abonniert auf homeassistant/cmi/set');
    } else {
      console.error('Fehler beim Abonnieren:', err.message);
    }
  });
});

mqttClient.on('message', async (topic, message) => {
  console.log('Nachricht empfangen:', topic, message.toString());
  await command(topic, message.toString());
  const data = await pull();
  send(data);
});
