const axios = require('axios');
const fs = require('fs');

const actions = {
  CMI_VENT_SHELL_ON: { address: '0200214F00B100', value: 1 },
  CMI_VENT_SHELL_OFF: { address: '0200214F00B100', value: 0 },
  CMI_KUEHLEN: { address: '0200134414B100', value: 1 },
  CMI_HEIZEN: { address: '0200144414B100', value: 1 },
  CMI_HANDBETRIEB: { address: '02000A4414B100', value: 1 },
  CMI_PASSIVKUEHLEN: { address: '0200264414B100', value: 1 },
  CMI_KLIMAANLAGE: { address: '0200154414B100', value: 1 },
  CMI_LUFT0: { address: '02001E4414B100', value: 1 },
  CMI_LUFT50: { address: '02001F4414B100', value: 1 },
  CMI_LUFT80: { address: '0200204414B100', value: 1},
  CMI_LUFT100: { address: '0200214414B100', value: 1},
  CMI_VENTKWL: { address: '0200014414B100', value: 1},
  CMI_VENT1: { address: '0200024414B100', value: 1},
  CMI_VENT2: { address: '0200034414B100', value: 1},
  CMI_VENT3: { address: '0200044414B100', value: 1},
  CMI_VENTAUS: { address: '0200004414B100', value: 1},
  CMI_BEFEUCHTUNG: { address: '02001B4414B100', value: 1},
  CMI_AUTOCO2: { address: '02001A4414B100', value: 1},
  CMI_STOSSLUEFTUNG: { address: '0200214F00B100', value: 1},
  CMI_AUTOUMLUFT: { address: '0200294414B100', value: 1},
  CMI_RAUMSOLL: { address: '0200184414D101', topic: 'set_temperature' },
  CMI_RAUMREDUZIERT: { address: '02001D4414D101' },
  CMI_SOLLFEUCHTE: { address: '0200164414D108', topic: 'set_humidity' },
}

const reducer = (topic, message) => {
  const cmd = topic.split('/').pop();

  switch (cmd) {
    case 'fan':
      switch (message) {
        case 'off':
          return actions.CMI_VENTAUS;
        case 'auto':
          return actions.CMI_VENTKWL;
        case 'low':
          return actions.CMI_VENT1;
        case 'medium':
          return actions.CMI_VENT2;
        case 'high':
          return actions.CMI_VENT3;
      }
      break;
    case 'mode':
      switch (message) {
        case 'heat':
          return actions.CMI_HEIZEN;
        case 'cool':
          return actions.CMI_KUEHLEN;
      }
      break;
    case 'preset_mode':
      switch (message) {
        case 'eco':
          return { ...actions.CMI_RAUMSOLL, value: 22 };
        case 'comfort':
          return { ...actions.CMI_RAUMSOLL, value: 25 };
        case 'boost':
          return { ...actions.CMI_RAUMSOLL, value: 30 };
        case 'sleep':
          return { ...actions.CMI_RAUMSOLL, value: 19 };
        case 'away':
          return { ...actions.CMI_RAUMSOLL, value: 23 };
        case 'home':
          return { ...actions.CMI_RAUMSOLL, value: 23.5 };
      }
      break;
    case 'temperature':
      return { ...actions.CMI_RAUMSOLL, value: message };
    case 'humidity':
      return { ...actions.CMI_SOLLFEUCHTE, value: message };
    default:
      return null;
  }
}

const getConfig = () => {

  // Path to Home Assistant add-on configuration
  const configPath = '/data/options.json';

  // Read and parse the configuration file
  try {
    const rawData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(rawData);
    return config;
  } catch (error) {
    try {
      const rawData = fs.readFileSync('./options.json', 'utf8');
      const config = JSON.parse(rawData);
      return config;
    } catch (error) {
      console.log("Error reading configuration:", error);
    }
  }

  return null;
}

const config = getConfig();

const BASEURL = `http://${config.cmi_host}`;
const AUTHORIZATION = `Basic ${Buffer.from(`${config.cmi_user}:${config.cmi_password}`).toString('base64')}`;


const changetox2 = async (address, value) => {
  const client = axios.create();

  console.log(`${BASEURL}/INCLUDE/change.cgi?changeadrx2=${address}&changetox2=${value}`)
  return await client.get(`${BASEURL}/INCLUDE/change.cgi?changeadrx2=${address}&changetox2=${value}`, {
    headers: {
      'Authorization': AUTHORIZATION,
      'Referer': `${BASEURL}/schema.html`
    }
  }).then(response => {
    console.log('Response:', response.data);
    return response.data;
  }).catch(error => {

    console.error('Error in changetox2:', error);
    throw error;
  });
}


const command = (topic, message) => {
  const action = reducer(topic, message);
  console.log('Action:', action, topic, message);
  if (action) {
    return changetox2(action.address, action.value);
  }
  return null;
}


module.exports = { getConfig, command };
