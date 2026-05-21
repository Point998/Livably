'use strict';

// Automated development intelligence discovery
// Tier 1: manual database (src/development-intel.js) — always authoritative
// Tier 2: Google News RSS scrape — cached 7 days per city
// Tier 3: empty array — caller falls back to Census/Places trends

const fs   = require('fs');
const path = require('path');
const { getLocalDevelopmentIntel } = require('./development-intel');

// ── Config ────────────────────────────────────────────────────────────────────

const CACHE_DIR        = path.join(__dirname, '..', '.cache', 'development-intel');
const CACHE_TTL_MS     = 7 * 24 * 60 * 60 * 1000;   // 7 days
const REQUEST_DELAY_MS = 1200;                          // 1.2 s between RSS fetches
const MAX_ARTICLE_AGE  = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years

// ── Classification tables ─────────────────────────────────────────────────────

// Note: keywords are matched as substrings in lowercased text.
// Avoid single common words (e.g. 'target', 'ross') that appear in general prose.
// Use brand names with context qualifiers where needed.
const TYPE_MAP = [
  {
    type: 'Grocery Store', icon: '🛒',
    keywords: ['publix', 'kroger', 'aldi', 'whole foods', 'trader joe', 'sprouts', 'meijer',
               'wegmans', 'food lion', 'harris teeter', 'grocery store', 'supermarket',
               'lidl', 'save a lot', 'piggly wiggly', 'fresh market'],
  },
  {
    type: 'Major Retail', icon: '🏪',
    // 'target' alone matches verbs/nouns in general prose — require it as a proper noun phrase
    keywords: ['target store', 'new target', 'target opening', 'target to open', 'target approved',
               'walmart', 'costco', 'home depot', "lowe's", 'lowes', 'best buy',
               'ross dress', 'tj maxx', 't.j. maxx', 'marshalls', 'burlington coat',
               'dollar tree', 'dollar general', 'big lots', 'five below', 'hobby lobby',
               'michaels craft', 'ulta beauty', 'bath & body works', 'academy sports',
               'ikea', 'nordstrom', 'macy', 'kohl', 'tj maxx', 'old navy', 'gap ', 'jcpenney'],
  },
  {
    type: 'Restaurant', icon: '🍽️',
    keywords: ['chick-fil-a', "mcdonald's", 'starbucks', "chili's", "applebee's",
               'cracker barrel', 'olive garden', 'restaurant', 'brewery', 'distillery',
               'pizza hut', 'taco bell', "wendy's", 'panera', 'chipotle', 'culver'],
  },
  {
    type: 'Medical Facility', icon: '🏥',
    keywords: ['hospital', 'urgent care', 'medical center', 'health system',
               'er campus', 'emergency room', 'medical clinic', 'healthcare campus'],
  },
  {
    type: 'Hotel', icon: '🏨',
    keywords: ['hotel', 'marriott', 'hilton', 'hampton inn', 'holiday inn',
               'courtyard by marriott', 'hyatt', 'fairfield inn', 'comfort inn'],
  },
  {
    type: 'Mixed-Use / Residential', icon: '🏢',
    keywords: ['mixed-use', 'mixed use', 'apartment complex', 'condominiums',
               'townhomes', 'townhouses', 'housing development', 'luxury apartments',
               'senior living', 'affordable housing', 'multifamily'],
  },
  {
    type: 'Industrial / Logistics', icon: '🏭',
    keywords: ['warehouse', 'distribution center', 'amazon fulfillment', 'industrial park',
               'logistics center', 'manufacturing plant', 'data center', 'fulfillment center'],
  },
  {
    type: 'Shopping Center', icon: '🏬',
    keywords: ['shopping center', 'strip mall', 'retail center', 'town center',
               'marketplace', 'retail plaza', 'lifestyle center'],
  },
];

const STATUS_MAP = [
  {
    status: 'Under Construction',
    keywords: ['under construction', 'breaking ground', 'construction started',
               'construction has begun', 'groundbreaking', 'site work underway',
               'construction begins', 'crews are working'],
  },
  {
    status: 'Opening Soon',
    keywords: ['opening soon', 'opening this', 'set to open', 'scheduled to open',
               'grand opening', 'opens this', 'opening in', 'open by', 'soft open'],
  },
  {
    status: 'Approved',
    keywords: ['approved by', 'planning commission approved', 'zoning approved',
               'city council approved', 'gets approval', 'receives approval',
               'approved for', 'granted approval', 'green-lit', 'approved project'],
  },
  {
    status: 'Planned',
    keywords: ['planned', 'proposed', 'announced', 'plans for', 'coming to',
               'will open', 'in the works', 'expected to open', 'seeking approval',
               'filing for', 'applied for'],
  },
];

const DEFAULT_IMPACT = {
  'Grocery Store':           'Adds a new full-service grocery option — expands shopping choices and may reduce drive times for routine errands.',
  'Major Retail':            'A major retail chain is coming to the area — adds convenience for shopping, apparel, and household needs.',
  'Restaurant':              'A new dining option is opening nearby.',
  'Medical Facility':        'Expands local healthcare access — reduces drive time to medical services.',
  'Hotel':                   'New hotel investment indicates area commercial growth.',
  'Mixed-Use / Residential': 'A new residential/commercial development that will add housing and potentially new amenities to the neighborhood.',
  'Industrial / Logistics':  'An industrial or logistics facility — may affect local traffic patterns and employment.',
  'Shopping Center':         'A new retail center that will expand shopping and dining options nearby.',
  'Development':             'A new development project confirmed for the area.',
};

// ── Cache ─────────────────────────────────────────────────────────────────────

function cacheFile(city, state) {
  const slug = `${city.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}`;
  return path.join(CACHE_DIR, `${slug}.json`);
}

function readCache(city, state) {
  try {
    const file = cacheFile(city, state);
    if (!fs.existsSync(file)) return null;
    const { ts, data } = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (Date.now() - ts < CACHE_TTL_MS) ? data : null;
  } catch { return null; }
}

function writeCache(city, state, data) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFile(city, state), JSON.stringify({ ts: Date.now(), data }, null, 2));
  } catch (err) {
    console.warn('[DevIntel cache write]', err.message);
  }
}

// ── RSS parsing ───────────────────────────────────────────────────────────────

function xmlTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const m  = block.match(re);
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim() : '';
}

function parseRSSItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    items.push({
      title:       xmlTag(b, 'title'),
      description: xmlTag(b, 'description'),
      pubDate:     xmlTag(b, 'pubDate'),
      link:        xmlTag(b, 'link'),
    });
  }
  return items;
}

// ── Classification helpers ────────────────────────────────────────────────────

function classifyType(text) {
  const t = text.toLowerCase();
  for (const { type, icon, keywords } of TYPE_MAP) {
    if (keywords.some((k) => t.includes(k))) return { type, icon };
  }
  return { type: 'Development', icon: '🏗️' };
}

function classifyStatus(text) {
  const t = text.toLowerCase();
  for (const { status, keywords } of STATUS_MAP) {
    if (keywords.some((k) => t.includes(k))) return status;
  }
  return 'Planned';
}

const TIMELINE_RES = [
  /\b(Q[1-4]\s*20[2-3]\d)\b/i,
  /\b((?:spring|summer|fall|winter|early|mid|late)\s+20[2-3]\d)\b/i,
  /\b(20[2-3]\d)\b/,
  /\b(later this year|this year|next year)\b/i,
];

function extractTimeline(text) {
  for (const re of TIMELINE_RES) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

// Patterns: "Publix coming to Georgetown", "New Target approved for Georgetown"
// "Georgetown approves apartment complex", "Construction begins on X", "Target to open in Georgetown"
const NAME_PATTERNS = [
  // "X announces grand opening" / "X holds ribbon cutting"
  /^(?:new\s+)?(.+?)\s+(?:announces?|holds?)\s+(?:grand\s+opening|ribbon\s+(?:cutting|cut))/i,
  // "Another X is coming/opening"
  /^another\s+(.+?)\s+(?:is\s+)?(?:coming|opening|arriving)\b/i,
  // "X coming to City", "X approved for City", "X set to open in City"
  /^(?:new\s+)?(.+?)\s+(?:coming\s+to|approved\s+(?:for|in)|to\s+open\s+in|opening\s+in|opens?\s+in|planned\s+for|set\s+to\s+open\s+in)\b/i,
  // "X breaks ground", "X under construction", "X gets approval"
  /^(?:new\s+)?(.+?)\s+(?:breaks?\s+ground|under\s+construction|gets?\s+approval|receives?\s+approval)\b/i,
  // "Construction begins on X" / "Groundbreaking for X" / "When will construction begin on X"
  /^(?:when\s+will\s+)?(?:construction|groundbreaking|work)\s+(?:begins?|starts?|underway)\s+(?:on|for|at)\s+(.+?)(?:[.,?]|$)/i,
  // "City approves X" / "City OKs X" / "City council greenlights X"
  /^[A-Z][a-z]+(?: [A-Z][a-z]+){0,2}\s+(?:approves?|OKs?|green-?lights?|clears?|votes?\s+to\s+approve)\s+(?:new\s+)?(.+?)(?:[.,]|$)/i,
  // "X to open / opening"
  /^(.+?)\s+(?:to\s+open|opening|set\s+to\s+open)\b/i,
];

const GENERIC_WORDS = new Set([
  'store', 'restaurant', 'development', 'project', 'building', 'complex',
  'center', 'mall', 'facility', 'location', 'construction', 'groundbreaking',
]);

// Trailer phrases that indicate a truncated headline — strip them
const TITLE_TRAILER_RE = /\.\s+(?:here['']s what|when will|what to know|what you should|find out|details inside|more on).*$/i;

function extractProjectName(title, city) {
  // Strip trailing source attribution "Title - Source Name"
  let t = title.replace(/\s+-\s+[\w][\w .]{2,40}$/, '').trim();
  // Strip noise prefixes
  t = t.replace(/^(?:breaking|update|exclusive|video|photos?|report):\s*/i, '').trim();
  // Strip truncation trailers
  t = t.replace(TITLE_TRAILER_RE, '').trim();

  for (const re of NAME_PATTERNS) {
    const m = t.match(re);
    if (m) {
      // Some patterns have the project in group 1, others group 2 — take the last populated group
      const raw = (m[2] || m[1] || '').replace(/^(?:a|an|the|new)\s+/i, '').trim();
      if (raw.length >= 3 && raw.length <= 70 && !GENERIC_WORDS.has(raw.toLowerCase())) {
        return raw;
      }
    }
  }

  // Fallback: cleaned title minus city name, capped at 70 chars
  const fallback = t
    .replace(new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 70);
  return fallback.length >= 5 ? fallback : null;
}

// Require at least one development-specific signal to filter out general news
const DEV_SIGNAL_RE = /\b(?:approv|construct|opening|open|groundbreak|development|development|built|coming\s+to|announced|planned|proposed|ground\s+broke?|under\s+way|zoning|permit|grand\s+opening)\b/i;

// Articles about closures, disasters, crimes, or policy (not specific projects)
const SKIP_RE = /clos(ed|ing)\b|bankrupt|shut\s*down|torn\s*down|demolis[hed]|out\s+of\s+business|fire\s+damage|flood\s+damage|shooting|stabbing|arrest/i;

const POLICY_SKIP_RE = /\b(?:lawmakers?|legislation|law\s+(?:passed|signed)|state\s+funding|federal\s+funding|advocacy\s+group|survey\s+(?:finds|shows)|study\s+(?:finds|shows)|five\s+things|three\s+things|what\s+to\s+know|why\s+(?:is|are)\b|opinion:|editorial:|column:|let['']s\s+be\s+clear|here['']s\s+what|here\s+is\s+what|vote\s+on|tax\s+incentive|incentive\s+package|store\s+hours|holiday\s+hours|easter\s+sunday|open\s+on\s+(?:christmas|thanksgiving|new\s+year)|awards?\s+\$|in\s+grants?\s+for|nuclear\s+energy|solar\s+project|grant\s+program|nuclear\s+permitting)\b/i;

// Question-form titles about existing stores are not development news
// Exception: "When will construction begin" is caught by name patterns first
const QUESTION_TITLE_RE = /^(?:will\s+(?:new\s+)?(?:a\s+)?(?:the\s+)?\w|is\s+(?:new\s+)?(?:a\s+)?(?:the\s+)?\w|are\s+\w|does\s+\w|can\s+you\s+get)\b/i;

function isRelevant(text, city, state) {
  const t = text.toLowerCase();
  // Must mention city name
  if (!t.includes(city.toLowerCase())) return false;
  // Should also mention state abbreviation or contain recognizable context
  const stateFullNames = {
    al:'alabama',ak:'alaska',az:'arizona',ar:'arkansas',ca:'california',co:'colorado',
    ct:'connecticut',de:'delaware',fl:'florida',ga:'georgia',hi:'hawaii',id:'idaho',
    il:'illinois',in:'indiana',ia:'iowa',ks:'kansas',ky:'kentucky',la:'louisiana',
    me:'maine',md:'maryland',ma:'massachusetts',mi:'michigan',mn:'minnesota',
    ms:'mississippi',mo:'missouri',mt:'montana',ne:'nebraska',nv:'nevada',
    nh:'new hampshire',nj:'new jersey',nm:'new mexico',ny:'new york',nc:'north carolina',
    nd:'north dakota',oh:'ohio',ok:'oklahoma',or:'oregon',pa:'pennsylvania',
    ri:'rhode island',sc:'south carolina',sd:'south dakota',tn:'tennessee',tx:'texas',
    ut:'utah',vt:'vermont',va:'virginia',wa:'washington',wv:'west virginia',
    wi:'wisconsin',wy:'wyoming',
  };
  const abbr     = state.toLowerCase();
  const fullName = stateFullNames[abbr] || '';
  return t.includes(abbr) || (fullName && t.includes(fullName));
}

// ── Google News RSS fetch ─────────────────────────────────────────────────────

const SEARCH_TEMPLATES = [
  (c, s) => `"${c}" "${s}" new development construction approved`,
  (c, s) => `"${c}" "${s}" new store opening retail coming`,
  (c, s) => `"${c}" "${s}" development project planned announced`,
];

async function fetchRSS(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Livably/1.0 (residential address intelligence; not for commercial redistribution)' },
    signal:  AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrapeGoogleNews(city, state) {
  const projects = [];
  const seen     = new Set();

  for (let i = 0; i < SEARCH_TEMPLATES.length; i++) {
    if (i > 0) await sleep(REQUEST_DELAY_MS);

    const query = SEARCH_TEMPLATES[i](city, state);
    let items;
    try {
      const xml = await fetchRSS(query);
      items = parseRSSItems(xml);
    } catch (err) {
      console.warn(`[DevIntel] RSS query ${i + 1} failed:`, err.message);
      continue;
    }

    for (const item of items) {
      // Age filter
      try {
        if (Date.now() - new Date(item.pubDate).getTime() > MAX_ARTICLE_AGE) continue;
      } catch { /* unparseable date — keep */ }

      const text = `${item.title} ${item.description}`;

      if (SKIP_RE.test(text)) continue;
      if (POLICY_SKIP_RE.test(text)) continue;
      if (QUESTION_TITLE_RE.test(item.title)) continue;
      if (!isRelevant(text, city, state)) continue;
      if (!DEV_SIGNAL_RE.test(text)) continue;

      const name = extractProjectName(item.title, city);
      if (!name) continue;
      // Skip names ending mid-word or on incomplete verb (truncated RSS titles)
      if (/\b[a-z]{1,3}$/.test(name)) continue;
      if (/\s+(?:sets|gets|eyes|mulls|seeks|weighs|eyes|faces|taps|snags|nabs|inks|lands|nets)$/i.test(name)) continue;
      // Skip names starting with audience/crowd words (not a business name)
      if (/^(?:crowd|people|shoppers?|residents?|customers?|drivers?|\d+\s+new\s+\w+)\b/i.test(name)) continue;

      // Deduplicate
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(key)) continue;
      seen.add(key);

      const { type, icon } = classifyType(text);
      const status         = classifyStatus(text);
      const timeline       = extractTimeline(text);

      let sourceDate = '';
      try { sourceDate = new Date(item.pubDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); } catch {}

      projects.push({
        name,
        type,
        icon,
        status,
        location:        null,
        expectedOpening: timeline,
        source:          sourceDate ? `News report, ${sourceDate}` : 'Google News search',
        sourceUrl:       item.link || null,
        confidence:      'medium',
        scrapedDate:     new Date().toISOString().split('T')[0],
        impact:          DEFAULT_IMPACT[type] || DEFAULT_IMPACT['Development'],
        automated:       true,
      });
    }
  }

  // Sort: Under Construction → Opening Soon → Approved → Planned
  const ORDER = { 'Under Construction': 0, 'Opening Soon': 1, 'Approved': 2, 'Planned': 3 };
  projects.sort((a, b) => (ORDER[a.status] ?? 4) - (ORDER[b.status] ?? 4));

  return projects.slice(0, 8);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns confirmed development projects near a city.
 * Priority: manual database → 7-day cache → live Google News scrape → []
 */
async function discoverDevelopments(city, state, { forceRefresh = false } = {}) {
  if (!city || !state) return [];

  // Tier 1: manual database — always authoritative
  const manual = getLocalDevelopmentIntel(city, state);
  if (manual.length > 0) return manual;

  // Tier 2: cache
  if (!forceRefresh) {
    const cached = readCache(city, state);
    if (cached !== null) return cached;
  }

  // Tier 3: live scrape
  let discovered = [];
  try {
    discovered = await scrapeGoogleNews(city, state);
    console.log(`[DevIntel] Scraped ${discovered.length} projects for ${city}, ${state}`);
  } catch (err) {
    console.warn('[DevIntel] Scrape failed:', err.message);
  }

  writeCache(city, state, discovered);
  return discovered;
}

module.exports = { discoverDevelopments };
