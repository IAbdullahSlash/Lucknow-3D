'use strict';
/* Daily solar events in Lucknow civil time. Uses the NOAA/Meeus equations
   evaluated at local noon, with azimuth measured clockwise from north. */

const IST_OFFSET = 5.5;
const MILLIS_PER_HOUR = 3600000;
const MILLIS_PER_DAY = 24 * MILLIS_PER_HOUR;
const SOLAR_RAD = Math.PI / 180;

function lucknowClock(instant) {
  const local = instant + IST_OFFSET * MILLIS_PER_HOUR;
  const day = Math.floor(local / MILLIS_PER_DAY);
  return { day, hour: (local - day * MILLIS_PER_DAY) / MILLIS_PER_HOUR };
}

function solarDay(day, { lat, lon }) {
  const julianDay = 2440587.5 + day + (12 - IST_OFFSET) / 24;
  const century = (julianDay - 2451545) / 36525;
  const longitude = ((280.46646 + century * (36000.76983 + century * 0.0003032)) % 360) * SOLAR_RAD;
  const anomaly = (357.52911 + century * (35999.05029 - 0.0001537 * century)) * SOLAR_RAD;
  const eccentricity = 0.016708634 - century * (0.000042037 + 0.0000001267 * century);
  const centre = Math.sin(anomaly) * (1.914602 - century * (0.004817 + 0.000014 * century))
    + Math.sin(2 * anomaly) * (0.019993 - 0.000101 * century) + Math.sin(3 * anomaly) * 0.000289;
  const omega = (125.04 - 1934.136 * century) * SOLAR_RAD;
  const apparent = longitude + (centre - 0.00569 - 0.00478 * Math.sin(omega)) * SOLAR_RAD;
  const tilt = (23.439291111 - century * (0.013004167 + century * (0.000000164 - 0.000000504 * century))
    + 0.00256 * Math.cos(omega)) * SOLAR_RAD;
  const ratio = Math.tan(tilt / 2) ** 2;
  const equation = ratio * Math.sin(2 * longitude) - 2 * eccentricity * Math.sin(anomaly)
    + 4 * eccentricity * ratio * Math.sin(anomaly) * Math.cos(2 * longitude)
    - 0.5 * ratio ** 2 * Math.sin(4 * longitude) - 1.25 * eccentricity ** 2 * Math.sin(2 * anomaly);
  const noon = 12 + IST_OFFSET - lon / 15 - equation / (15 * SOLAR_RAD);
  const latitude = lat * SOLAR_RAD;
  const declination = Math.asin(Math.sin(tilt) * Math.sin(apparent));
  const sinLat = Math.sin(latitude), cosLat = Math.cos(latitude);
  const sinDec = Math.sin(declination), cosDec = Math.cos(declination);
  const hoursFromNoon = elevation => {
    const cosine = (Math.sin(elevation * SOLAR_RAD) - sinLat * sinDec) / (cosLat * cosDec);
    return Math.acos(Math.max(-1, Math.min(1, cosine))) / (15 * SOLAR_RAD);
  };
  const apparentDay = hoursFromNoon(-0.833);
  return {
    sinLat, cosLat, sinDec, cosDec, noon,
    sunrise: noon - apparentDay, sunset: noon + apparentDay,
    golden: noon + hoursFromNoon(6), dusk: noon + hoursFromNoon(-6),
  };
}

function sunPosition(day, hour) {
  const angle = (hour - day.noon) * 15 * SOLAR_RAD;
  const { sinLat, cosLat, sinDec, cosDec } = day;
  const el = Math.asin(Math.max(-1, Math.min(1, sinLat * sinDec + cosLat * cosDec * Math.cos(angle))));
  const az = Math.atan2(-Math.sin(angle) * cosDec, sinDec * cosLat - Math.cos(angle) * cosDec * sinLat);
  return { el, az };
}
