'use strict';

const http = require('http');

let partCount = 120;
const startedAt = Date.now();
setInterval(() => { partCount += 1; }, 30000).unref();

function xml() {
  const mins = Math.floor((Date.now() - startedAt) / 60000) + 1000;
  return `<?xml version="1.0"?><MTConnectStreams simulated="true"><DeviceStream>
    <Samples><Availability dataItemId="f_avail">AVAILABLE</Availability><Execution dataItemId="f_execution">ACTIVE</Execution>
    <Program dataItemId="f_program">O1001</Program><PartCount dataItemId="f_part_count">${partCount}</PartCount>
    <Load dataItemId="f_spindle_load">24.5</Load><Tool dataItemId="f_tool">1</Tool><Time dataItemId="f_time_poweron">${mins}</Time></Samples>
    <Samples><Availability dataItemId="f2_avail">AVAILABLE</Availability><Execution dataItemId="f2_execution">READY</Execution>
    <Program dataItemId="f2_program">O2002</Program><PartCount dataItemId="f2_part_count">48</PartCount>
    <Load dataItemId="f2_spindle_load">0</Load><Tool dataItemId="f2_tool">3</Tool><Time dataItemId="f2_time_poweron">${mins}</Time></Samples>
  </DeviceStream></MTConnectStreams>`;
}

const agent = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Fanuc-Simulation', 'true');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.end(xml());
});

const api = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Fanuc-Simulation', 'true');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const url = new URL(req.url, 'http://127.0.0.1');
  const responses = {
    '/programs': [{ number: 1001, length: 340, comment: 'SIMULATION ONLY' }],
    '/sysinfo': { model: 'FANUC MOCK', series: '0i-F Plus', simulated: true },
    '/actfeedrate': { feedrate: 500, simulated: true },
    '/alarmhistory': [],
    '/axisinfo': [],
    '/diagnostics': { simulated: true },
    '/programcode': { code: 'O1001\n(SIMULATION ONLY)\nG00 X0 Y0\nM30', simulated: true }
  };
  const body = responses[url.pathname] ?? { simulated: true, data: [] };
  res.end(JSON.stringify(body));
});

agent.listen(5000, '127.0.0.1', () => console.log('SIMULATION MTConnect: http://127.0.0.1:5000/current'));
api.listen(8090, '127.0.0.1', () => console.log('SIMULATION API: http://127.0.0.1:8090'));

function shutdown() { agent.close(); api.close(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
