'use strict';
const { escapeHtml, formatDriveTime } = require('../../utils/text');
const { CUSTOM_DEST_ICONS } = require('../../utils/constants');
const { renderDepthSelector } = require('../../templates/components/depthSelector');
const { computeDrivingProfile } = require('./logic');

function buildDestSection(label, result) {
  const labelHTML = `<div class="dest-label">${label}</div>`;
  if (!result) {
    const searchQuery = encodeURIComponent(`${label} near me`);
    return `<div class="dest-section">${labelHTML}<p class="dest-note">Data not available for this address. <a href="https://www.google.com/maps/search/${searchQuery}" target="_blank" rel="noopener">Search Google Maps</a> for nearby options.</p></div>`;
  }
  const noteHTML = result.note ? `<p class="dest-note">${escapeHtml(result.note)}</p>` : '';
  return `<div class="dest-section">
      ${labelHTML}
      <div class="dest-row">
        <div>
          <div class="dest-name">${escapeHtml(result.name)}</div>
          <div class="dest-address">${escapeHtml(result.address)}</div>
        </div>
        <div class="drive-time">${formatDriveTime(result.driveTimeMinutes)}</div>
      </div>
      ${noteHTML}
    </div>`;
}

function generateDailyConveniencesNarrative(grocery, pharmacy, gasStation) {
  const g = Array.isArray(grocery) ? grocery[0] : grocery;
  const stores = Array.isArray(grocery) ? grocery : (grocery ? [grocery] : []);
  const times = [g, pharmacy, gasStation].filter(Boolean).map((s) => s.driveTimeMinutes);
  if (!times.length) return null;
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

  let opening;
  if (avg < 8) opening = 'Daily errands are genuinely effortless here—everything you need is within a short drive.';
  else if (avg < 15) opening = "A quick drive covers the essentials. You're close enough that nothing feels like a production.";
  else if (avg < 25) opening = 'Services are accessible, just not around the corner. Most residents plan ahead and batch errands together.';
  else opening = "This is a location where you plan ahead. Services are farther out, so keeping a well-stocked home becomes part of the rhythm.";

  const paragraphs = [];

  if (g) {
    let gPara = `Your nearest grocery option is ${g.name}, ${g.driveTimeMinutes} minutes away.`;
    if (stores.length > 1 && stores[1]) {
      gPara += ` ${stores[1].name} is another option at ${stores[1].driveTimeMinutes} minutes—useful if you want variety or have store preferences.`;
    } else if (g.driveTimeMinutes <= 8) {
      gPara += " That's close enough to make mid-week top-offs practical, not just big Sunday hauls.";
    } else {
      gPara += ' Most residents find it easiest to do one bigger weekly shop rather than multiple trips.';
    }
    paragraphs.push(gPara);
  }

  const p2Parts = [];
  if (pharmacy) p2Parts.push(`Pharmacy runs take ${pharmacy.driveTimeMinutes} minutes to ${pharmacy.name}—convenient for prescriptions or last-minute needs.`);
  if (gasStation) p2Parts.push(`The nearest gas station is ${gasStation.driveTimeMinutes} minutes at ${gasStation.name}.`);
  if (p2Parts.length) paragraphs.push(p2Parts.join(' '));

  if (avg < 10) {
    paragraphs.push("Most people don't think twice about running out for a forgotten ingredient or picking up a prescription after work. That's the kind of low-friction living this location offers.");
  } else if (avg < 20) {
    paragraphs.push("The distance is easy to build into a routine—swing by on the way home, combine trips, and it rarely becomes a burden. The flip side: you're far enough out that this still feels like a neighborhood, not a strip mall parking lot.");
  } else {
    paragraphs.push("If quiet and space matter more to you than convenience, this trade-off tends to feel worth it over time. The adjustment is real, but most people who choose locations like this say they'd do it again.");
  }

  const items = [
    g ? { label: 'Grocery', name: g.name, time: g.driveTimeMinutes } : null,
    pharmacy ? { label: 'Pharmacy', name: pharmacy.name, time: pharmacy.driveTimeMinutes } : null,
    gasStation ? { label: 'Gas', name: gasStation.name, time: gasStation.driveTimeMinutes } : null,
  ].filter(Boolean);

  return { opening, paragraphs, items };
}

function generatePeaceOfMindNarrative(hospital, urgentCare) {
  if (!hospital) return null;

  let opening;
  if (hospital.driveTimeMinutes < 10) opening = 'Medical care is genuinely close. You could cover the distance quickly in any situation.';
  else if (hospital.driveTimeMinutes < 20) opening = `The nearest hospital is ${hospital.driveTimeMinutes} minutes away—reassuring distance without being in the thick of a medical district.`;
  else if (hospital.driveTimeMinutes < 30) opening = `Hospital access takes ${hospital.driveTimeMinutes} minutes. Worth knowing the route before you ever actually need it.`;
  else opening = 'The nearest hospital is more than 30 minutes away. If immediate medical access matters to you—young children, elderly parents, chronic conditions—this is something to weigh seriously.';

  const paragraphs = [];

  let hPara = `${hospital.name} is the closest full-service hospital at ${hospital.driveTimeMinutes} minutes.`;
  if (hospital.driveTimeMinutes > 20) {
    hPara += " Save the route in your phone now. In a real emergency, you don't want to be searching for it.";
  } else {
    hPara += ' The kind of distance that\'s manageable in nearly any situation.';
  }
  paragraphs.push(hPara);

  if (urgentCare) {
    const ucPara = urgentCare.driveTimeMinutes < hospital.driveTimeMinutes - 5
      ? `For non-emergencies—ear infections, minor injuries, high fevers—${urgentCare.name} is closer at ${urgentCare.driveTimeMinutes} minutes. Urgent care handles the vast majority of situations that don't require a full ER, often with shorter waits and lower bills.`
      : `${urgentCare.name} provides urgent care ${urgentCare.driveTimeMinutes} minutes away. For anything short of a true emergency, it's often the smarter first stop than an ER.`;
    paragraphs.push(ucPara);
  }

  paragraphs.push('Worth doing before you need it: find a primary care physician and pediatrician nearby, and save a list of after-hours clinics on your phone. Five minutes of prep pays real dividends.');

  const items = [
    { label: 'Hospital', name: hospital.name, time: hospital.driveTimeMinutes },
    urgentCare ? { label: 'Urgent Care', name: urgentCare.name, time: urgentCare.driveTimeMinutes } : null,
  ].filter(Boolean);

  return { opening, paragraphs, items };
}

function generateGettingAroundNarrative(highwayRamp) {
  if (!highwayRamp) return null;

  let opening;
  if (highwayRamp.driveTimeMinutes < 5) opening = "Highway access is essentially immediate—you're on the ramp in under five minutes.";
  else if (highwayRamp.driveTimeMinutes < 10) opening = `The highway is ${highwayRamp.driveTimeMinutes} minutes away. Close enough for easy commuting, far enough to avoid interchange noise.`;
  else if (highwayRamp.driveTimeMinutes < 20) opening = `You're ${highwayRamp.driveTimeMinutes} minutes from the highway—a buffer from road noise and commercial traffic without sacrificing connectivity.`;
  else opening = `Highway access is ${highwayRamp.driveTimeMinutes} minutes from here. If you commute daily, test the drive during your actual rush hour before committing.`;

  const paragraphs = [];
  paragraphs.push(`${highwayRamp.name} is your nearest on-ramp at ${highwayRamp.driveTimeMinutes} minutes. Once you're on, you can cover significant ground quickly—regional employment centers, airports, and weekend destinations all become more reachable.`);

  if (highwayRamp.driveTimeMinutes < 8) {
    paragraphs.push("The proximity is an underrated advantage. Grocery runs, airport pickups, and visiting family all get easier when you're this close to a major route. The noise and commercial clutter that comes with being right at an interchange stays far enough back not to register.");
  } else if (highwayRamp.driveTimeMinutes >= 15) {
    paragraphs.push("If you work remotely or have a reverse commute, this distance barely registers in daily life. Daily commuters heading into a busy corridor should do a test run at actual rush hour—trip times often vary more than you'd expect depending on direction and congestion patterns.");
  }

  return {
    opening,
    paragraphs,
    items: [{ label: 'Highway Access', name: highwayRamp.name, time: highwayRamp.driveTimeMinutes }],
  };
}

function generateCallouts(grocery, pharmacy, hospital) {
  const g = Array.isArray(grocery) ? grocery[0] : grocery;
  const callouts = [];

  if (hospital && hospital.driveTimeMinutes > 30) {
    callouts.push({
      icon: '⚠️',
      title: 'Worth Noting',
      message: `The nearest hospital is ${hospital.driveTimeMinutes} minutes away. If immediate medical access is important to you, this is something to consider.`,
    });
  }

  if (g && g.driveTimeMinutes > 30) {
    callouts.push({
      icon: '⚠️',
      title: 'Worth Noting',
      message: `Grocery shopping takes ${g.driveTimeMinutes} minutes each way. You'll want to plan larger shopping trips and keep a well-stocked pantry.`,
    });
  }

  const avgTimes = [g, pharmacy, hospital].filter(Boolean).map((s) => s.driveTimeMinutes);
  if (avgTimes.length === 3) {
    const avg = Math.round(avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length);
    if (avg > 40) {
      callouts.push({
        icon: 'ℹ️',
        title: 'Heads Up',
        message: "This is a remote location. You'll enjoy peace, space, and privacy—but services are farther out. Most errands will be 30–45+ minutes.",
      });
    }
  }

  return callouts;
}

function buildInsightItemsHTML(items) {
  return items.map((item) => `
        <div class="insight-item">
          <span class="item-label">${escapeHtml(item.label)}</span>
          <span class="item-place">${escapeHtml(item.name)}</span>
          <span class="item-time">${item.time} min</span>
        </div>`).join('');
}

function buildInsightSectionHTML(icon, title, subtitle, narrative) {
  if (!narrative) return '';
  const parasHTML = (narrative.paragraphs || [])
    .map((p) => `<p class="insight-para">${escapeHtml(p)}</p>`)
    .join('');
  return `
    <div class="insight-section">
      <div class="insight-header">
        <span class="insight-icon">${icon}</span>
        <div>
          <div class="insight-title">${escapeHtml(title)}</div>
          <div class="insight-subtitle">${escapeHtml(subtitle)}</div>
        </div>
      </div>
      <p class="insight-opening">${escapeHtml(narrative.opening)}</p>
      ${parasHTML}
      <div class="insight-breakdown">
        ${buildInsightItemsHTML(narrative.items)}
      </div>
    </div>`;
}

function buildDailyGlanceHTML(grocery, pharmacy, hospital) {
  const g = Array.isArray(grocery) ? grocery[0] : grocery;
  const times = [
    g?.driveTimeMinutes != null        ? `Grocery: ${g.driveTimeMinutes} min`        : null,
    pharmacy?.driveTimeMinutes != null ? `Pharmacy: ${pharmacy.driveTimeMinutes} min` : null,
    hospital?.driveTimeMinutes != null ? `ER: ${hospital.driveTimeMinutes} min`      : null,
  ].filter(Boolean);

  if (!times.length) return '';
  const items = times.map((t, i) =>
    i === 0
      ? `<span class="chapter-glance-item">${escapeHtml(t)}</span>`
      : `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${escapeHtml(t)}</span>`
  ).join('');
  return `<div class="chapter-glance">${items}</div>`;
}

function buildLifeCalculatorHTML(lifeCalc) {
  if (!lifeCalc || !lifeCalc.rates) return '';
  const { profile, rates, bounds } = lifeCalc;
  const p = computeDrivingProfile(profile, rates);
  const dollars = (n) => `$${Math.round(n).toLocaleString()}`;

  const sliderRow = (id, label, value, min, max, step, suffix) => `
    <div class="life-calc-control">
      <label class="life-calc-label" for="lc-${id}">${escapeHtml(label)}</label>
      <input class="life-calc-slider" type="range" id="lc-${id}" name="${id}"
             min="${min}" max="${max}" step="${step}" value="${value}">
      <output class="life-calc-value" id="lc-${id}-out">${value}${suffix ? ' ' + escapeHtml(suffix) : ''}</output>
    </div>`;

  const gasAsOf = rates.asOf?.gas ? ` (EIA, as of ${escapeHtml(rates.asOf.gas)})` : ' (estimated)';
  const config = JSON.stringify({ profile, rates, bounds });

  return `
  <div class="life-calc" data-depth="overview">
    <div class="life-calc-head">
      <div class="life-calc-title">What this address costs you to drive</div>
      <p class="life-calc-sub">Adjust to match your life. Estimates only — your actual mileage and prices vary.</p>
    </div>
    <div class="life-calc-controls">
      ${sliderRow('commuteDaysPerWeek', 'Commute days per week', profile.commuteDaysPerWeek, bounds.commuteDaysPerWeek[0], bounds.commuteDaysPerWeek[1], 1, '')}
      ${sliderRow('commuteOneWayMiles', 'Commute distance (one way)', profile.commuteOneWayMiles, bounds.commuteOneWayMiles[0], bounds.commuteOneWayMiles[1], 1, 'mi')}
      ${sliderRow('groceryTripsPerWeek', 'Grocery trips per week', profile.groceryTripsPerWeek, bounds.groceryTripsPerWeek[0], bounds.groceryTripsPerWeek[1], 1, '')}
      ${sliderRow('cityTripsPerMonth', 'Big-city trips per month', profile.cityTripsPerMonth, bounds.cityTripsPerMonth[0], bounds.cityTripsPerMonth[1], 1, '')}
      <div class="life-calc-control life-calc-control--toggle">
        <label class="life-calc-label" for="lc-hasKidsInSchool">Kids in school (adds school runs)</label>
        <input class="life-calc-toggle" type="checkbox" id="lc-hasKidsInSchool" name="hasKidsInSchool"${profile.hasKidsInSchool ? ' checked' : ''}>
      </div>
    </div>
    <div class="life-calc-outputs">
      <div class="life-calc-headline">
        <span class="life-calc-headline-label">Estimated yearly driving cost</span>
        <span class="life-calc-cost-marginal" id="lc-out-marginal">${dollars(p.costMarginal)}</span>
        <span class="life-calc-headline-note">running cost — fuel + maintenance${gasAsOf}</span>
      </div>
      <div class="life-calc-secondary">
        <div class="life-calc-figure"><span class="life-calc-annual-miles" id="lc-out-miles">${p.annualMiles.toLocaleString()}</span><span class="life-calc-figure-label">miles / year</span></div>
        <div class="life-calc-figure"><span id="lc-out-ev">${dollars(p.costEv)}</span><span class="life-calc-figure-label">on an EV</span></div>
        <div class="life-calc-figure"><span id="lc-out-irs">${dollars(p.costIrs)}</span><span class="life-calc-figure-label">at IRS full rate (${rates.irsRatePerMile.toFixed(2)}/mi)</span></div>
      </div>
    </div>
    <script type="application/json" id="life-calc-config">${config.replace(/</g, '\\u003c')}</script>
    <p class="life-calc-disclaimer">Marginal cost = fuel (gas ÷ ${rates.avgMpg} mpg) + maintenance. IRS rate reflects full ownership cost incl. depreciation. EV uses an average residential electricity rate. Charger locations are in the Utilities chapter.</p>
  </div>`;
}

function buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation, lifeCalc = null) {
  const daily = generateDailyConveniencesNarrative(grocery, pharmacy, gasStation);
  const peace = generatePeaceOfMindNarrative(hospital, urgentCare);
  const getting = generateGettingAroundNarrative(highwayRamp);
  const callouts = generateCallouts(grocery, pharmacy, hospital);

  const sectionsHTML = [
    buildInsightSectionHTML('🛒', 'Daily Conveniences', 'The errands and routines that shape your week', daily),
    buildInsightSectionHTML('🏥', 'Peace of Mind', 'Healthcare access when it matters most', peace),
    buildInsightSectionHTML('🛣️', 'Getting Around', 'Connectivity to work, family, and beyond', getting),
  ].join('');

  const calloutsHTML = callouts.map((c) => `
    <div class="insight-callout">
      <span class="callout-icon">${c.icon}</span>
      <div class="callout-body">
        <div class="callout-title">${escapeHtml(c.title)}</div>
        <p class="callout-message">${escapeHtml(c.message)}</p>
      </div>
    </div>`).join('');

  if (!sectionsHTML.trim() && !calloutsHTML.trim()) return '';

  const sunSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:120" aria-hidden="true"><circle cx="12" cy="12" r="5" style="--path-len:32"/><line x1="12" y1="1" x2="12" y2="3" style="--path-len:16"/><line x1="12" y1="21" x2="12" y2="23" style="--path-len:16"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" style="--path-len:12"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" style="--path-len:12"/><line x1="1" y1="12" x2="3" y2="12" style="--path-len:16"/><line x1="21" y1="12" x2="23" y2="12" style="--path-len:16"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" style="--path-len:12"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" style="--path-len:12"/></svg>`;

  return `
  <section class="chapter chapter--alt" data-ch="daily" data-depth="overview">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">02</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">
          <span class="chapter-icon">${sunSvg}</span>
          Daily Life
        </div>
        <h2 class="chapter-title">What living here actually feels like.</h2>
      </header>
      <p class="chapter-intro">The stuff you'd only learn after living here for two years — or by reading this.</p>
      <div class="depth-l1">${buildDailyGlanceHTML(grocery, pharmacy, hospital)}</div>
      <div class="chapter-body depth-l2">
        <div class="chapter-left">
          ${sectionsHTML}
        </div>
        <div class="chapter-right">
          ${calloutsHTML}
        </div>
      </div>
      ${buildLifeCalculatorHTML(lifeCalc)}
      ${renderDepthSelector('daily')}
    </div>
  </section>
  <div class="chapter-rule"></div>`;
}

function buildCustomDestinationsCardHTML(customDestinations) {
  if (!customDestinations || !customDestinations.length) return '';

  const itemsHTML = customDestinations.map((dest) => {
    const icon = CUSTOM_DEST_ICONS[dest.type] || '📍';
    const timeHTML = dest.driveTimeMinutes != null
      ? `<div class="custom-dest-time">${formatDriveTime(dest.driveTimeMinutes)}</div>`
      : `<div class="custom-dest-time-na">—</div>`;
    return `
    <div class="custom-dest-item">
      <div class="custom-dest-icon">${icon}</div>
      <div class="custom-dest-info">
        <div class="custom-dest-name">${escapeHtml(dest.name)}</div>
        <div class="custom-dest-addr">${escapeHtml(dest.address)}</div>
      </div>
      ${timeHTML}
    </div>`;
  }).join('');

  return `
  <section class="chapter chapter--alt" data-ch="custom">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">★</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">Your Places</div>
        <h2 class="chapter-title">Custom Destinations</h2>
      </header>
      <div class="chapter-body">
        <div class="chapter-left">
          ${itemsHTML}
        </div>
        <div class="chapter-right"></div>
      </div>
    </div>
  </section>
  <div class="chapter-rule"></div>`;
}

function buildAdditionalServicesCardHTML(elementarySchool, park, coffeeShop, library, recCenter, postOffice) {
  const civicItems = [
    library    ? { label: 'Public Library',    name: library.name,    driveTimeMinutes: library.driveTimeMinutes    } : null,
    recCenter  ? { label: 'Recreation Center', name: recCenter.name,  driveTimeMinutes: recCenter.driveTimeMinutes  } : null,
    postOffice ? { label: 'Post Office',        name: postOffice.name, driveTimeMinutes: postOffice.driveTimeMinutes } : null,
  ].filter(Boolean);

  if (!elementarySchool && !park && !coffeeShop && !civicItems.length) return '';

  const narrativeParts = [];
  if (coffeeShop) {
    narrativeParts.push(coffeeShop.driveTimeMinutes <= 5
      ? `${coffeeShop.name} is ${coffeeShop.driveTimeMinutes} minutes away—close enough to become a morning habit.`
      : `There's coffee nearby at ${coffeeShop.name}, ${coffeeShop.driveTimeMinutes} minutes out.`);
  }
  if (park) {
    narrativeParts.push(park.driveTimeMinutes <= 5
      ? `${park.name} is ${park.driveTimeMinutes} minutes away—the kind of proximity that actually changes how you use your weekends.`
      : `${park.name} is ${park.driveTimeMinutes} minutes away for outdoor time.`);
  }
  if (elementarySchool) {
    narrativeParts.push(elementarySchool.driveTimeMinutes <= 5
      ? `The nearest elementary school is ${elementarySchool.driveTimeMinutes} minutes away. For families, that's a meaningful part of the morning routine.`
      : `The nearest elementary school is ${elementarySchool.driveTimeMinutes} minutes away—verify your assigned school directly with the district.`);
  }
  const narrativeHTML = narrativeParts.length
    ? `<p class="services-intro">${escapeHtml(narrativeParts.join(' '))}</p>`
    : '';

  const civicHTML = civicItems.length ? `
    <div class="civic-section">
      <div class="civic-section-label">Civic Infrastructure</div>
      ${civicItems.map((c) => `
        <div class="civic-item">
          <span class="civic-item-label">${escapeHtml(c.label)}</span>
          <span class="civic-item-name">${escapeHtml(c.name)}</span>
          <span class="civic-item-time">${c.driveTimeMinutes} min</span>
        </div>`).join('')}
    </div>` : '';

  return `
  <div class="chapter-inner chapter-inner--addon">
    ${narrativeHTML}
    <div class="services-grid">
      ${elementarySchool ? `<div class="services-grid-item">${buildDestSection('Elementary School', elementarySchool)}</div>` : ''}
      ${park ? `<div class="services-grid-item">${buildDestSection('Park', park)}</div>` : ''}
      ${coffeeShop ? `<div class="services-grid-item">${buildDestSection('Coffee Shop', coffeeShop)}</div>` : ''}
    </div>
    ${civicHTML}
  </div>`;
}

module.exports = { buildInsightsCardHTML, buildCustomDestinationsCardHTML, buildAdditionalServicesCardHTML, buildLifeCalculatorHTML };
