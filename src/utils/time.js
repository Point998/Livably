'use strict';

function getNextTuesday8am() {
  const now = new Date();
  const nextTuesday = new Date(now);
  const currentDay = nextTuesday.getDay();
  let daysUntilTuesday = (2 - currentDay + 7) % 7;

  if (daysUntilTuesday === 0) {
    const todayAt8 = new Date(nextTuesday);
    todayAt8.setHours(8, 0, 0, 0);
    if (nextTuesday >= todayAt8) {
      daysUntilTuesday = 7;
    }
  }

  nextTuesday.setDate(nextTuesday.getDate() + daysUntilTuesday);
  nextTuesday.setHours(8, 0, 0, 0);
  nextTuesday.setMinutes(0);
  nextTuesday.setSeconds(0);
  nextTuesday.setMilliseconds(0);
  return Math.floor(nextTuesday.getTime() / 1000);
}

function getNextDayAt(targetDay, hour) {
  const now = new Date();
  const candidate = new Date(now);
  let days = (targetDay - now.getDay() + 7) % 7;
  if (days === 0) {
    const todayAtHour = new Date(now);
    todayAtHour.setHours(hour, 0, 0, 0);
    if (now >= todayAtHour) days = 7;
  }
  candidate.setDate(candidate.getDate() + days);
  candidate.setHours(hour, 0, 0, 0);
  return Math.floor(candidate.getTime() / 1000);
}

module.exports = { getNextTuesday8am, getNextDayAt };
