const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(resolve(__dirname, '../src/solar.js'), 'utf8');
const { lucknowClock, solarDay, sunPosition } = vm.runInNewContext(source + '\n({ lucknowClock, solarDay, sunPosition })');
const site = { lat: 26.874, lon: 80.90801 };

test('the Lucknow date rolls over at 18:30 UTC independent of the browser timezone', () => {
  const before = lucknowClock(Date.parse('2026-11-18T18:29:00Z'));
  const after = lucknowClock(Date.parse('2026-11-18T18:31:00Z'));
  assert.equal(after.day, before.day + 1);
  assert.equal(Math.round(before.hour * 60), 1439);
  assert.equal(Math.round(after.hour * 60), 1);
});

// Astral 3.2, sun(Observer(26.874, 80.90801), date, tzinfo=ZoneInfo("Asia/Kolkata")).
const almanac = [
  ['2026-03-20', '06:10:52', '12:13:56', '18:17:16', '18:40:54'],
  ['2026-06-21', '05:13:21', '12:08:05', '19:02:55', '19:29:48'],
  ['2026-12-21', '06:51:02', '12:04:11', '17:17:37', '17:43:36'],
];

function decimalHour(value) {
  const [hour, minute, second] = value.split(':').map(Number);
  return hour + minute / 60 + second / 3600;
}

for (const [date, ...expected] of almanac) {
  test(`Lucknow solar events agree with Astral for ${date}`, () => {
    const { day } = lucknowClock(Date.parse(date + 'T06:30:00Z'));
    const events = solarDay(day, site);
    for (const [i, key] of ['sunrise', 'noon', 'sunset', 'dusk'].entries()) {
      assert.ok(Math.abs(events[key] - decimalHour(expected[i])) * 60 < 1, key);
    }
    for (const [key, elevation] of [['sunrise', -0.833], ['golden', 6], ['dusk', -6]]) {
      const position = sunPosition(events, events[key]);
      assert.ok(Math.abs(position.el * 180 / Math.PI - elevation) < 0.001, key);
    }
    assert.ok(sunPosition(events, events.sunrise).az > 0, 'the sun rises on the east side');
    assert.ok(sunPosition(events, events.sunset).az < 0, 'the sun sets on the west side');
    assert.ok(sunPosition(events, events.noon).el > sunPosition(events, events.golden).el);
  });
}
