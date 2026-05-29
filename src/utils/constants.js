'use strict';

// Single source of truth for all hardcoded arrays, objects, thresholds, and
// magic numbers previously scattered across app.js, chapters.js, and
// development-discovery.js. This file imports from nothing.

// ── Search Radii (meters unless noted) ───────────────────────────────────────

const GROCERY_SEARCH_RADIUS_M              = 8000;
const HOSPITAL_SEARCH_RADIUS_M             = 50000;
const ELEMENTARY_SCHOOL_SEARCH_RADIUS_M    = 15000;
const AIRPORT_SEARCH_RADIUS_M              = 32000;
const AIRPORT_MAX_DISTANCE_MILES           = 20;
const WALKABILITY_SEARCH_RADIUS_M          = 800;
const DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M = 2400;
const OSM_ROAD_NOISE_RADIUS_M              = 4000;
const OSM_RAIL_RADIUS_M                    = 4800;
const OSM_LANDUSE_RADIUS_M                 = 800;
const WATER_QUALITY_SEARCH_RADIUS_MILES    = 10;

// iNaturalist — in km, not meters
const INAT_NATIVE_PLANTS_RADIUS_KM   = 16;
const INAT_INVASIVE_PLANTS_RADIUS_KM = 32;
const INAT_WILDLIFE_RADIUS_KM        = 16;
const INAT_BIRDS_RADIUS_KM           = 16;

// ── Result Candidate Counts ───────────────────────────────────────────────────

const GROCERY_CANDIDATE_COUNT          = 8;
const HOSPITAL_CANDIDATE_COUNT         = 5;
const COFFEE_SHOP_CANDIDATE_COUNT      = 5;
const INAT_NATIVE_PLANTS_PER_PAGE      = 50;
const INAT_INVASIVE_PLANTS_PER_PAGE    = 25;
const INAT_WILDLIFE_PER_PAGE           = 15;
const INAT_BIRDS_PER_PAGE              = 20;

// Garden deep dive — Level 3 taxon queries
const INAT_REPTILES_RADIUS_KM      = 16;
const INAT_REPTILES_PER_PAGE       = 15;
const INAT_INSECTS_RADIUS_KM       = 16;
const INAT_INSECTS_PER_PAGE        = 20;
const INAT_BUTTERFLIES_RADIUS_KM   = 16;
const INAT_BUTTERFLIES_PER_PAGE    = 20;

// ── Highway Thresholds ────────────────────────────────────────────────────────

const HIGHWAY_MAX_DRIVE_MINUTES        = 20;
const HIGHWAY_INTERCHANGE_MAX_MINUTES  = 50;

// ── Rural Mode Detection Thresholds (CONSTRAINT-007) ─────────────────────────

const RURAL_MODE_URBAN_POP_MIN              = 5001;
const RURAL_MODE_SUBURBAN_POP_MIN           = 1001;
const RURAL_MODE_REMOTE_POP_MAX             = 200;
const RURAL_MODE_SUBURBAN_MAX_DRIVE_MINUTES = 20;
const DRIVE_TIME_COHERENCE_THRESHOLD_MINUTES = 45;

// ── Report UI ─────────────────────────────────────────────────────────────────

const MAX_CONCURRENT_PDFS = 3;

const CUSTOM_DEST_ICONS = {
  work: '💼', family: '🏠', medical: '⚕️', recreation: '⛳', other: '📍',
};

const ERROR_ICONS = {
  ADDRESS_NOT_FOUND: '📍',
  RATE_LIMIT:        '⏱️',
  QUOTA_EXCEEDED:    '📊',
  SERVER_ERROR:      '⚠️',
};

// ── Interstate List (59 US interstates) ──────────────────────────────────────

const INTERSTATE_LIST = [
  'I-5',  'I-8',  'I-10', 'I-11', 'I-12', 'I-15', 'I-16', 'I-17', 'I-19',
  'I-20', 'I-22', 'I-24', 'I-25', 'I-26', 'I-27', 'I-29', 'I-30', 'I-35',
  'I-37', 'I-38', 'I-39', 'I-40', 'I-41', 'I-43', 'I-44', 'I-49', 'I-55',
  'I-57', 'I-59', 'I-64', 'I-65', 'I-69', 'I-70', 'I-71', 'I-72', 'I-73',
  'I-74', 'I-75', 'I-76', 'I-77', 'I-78', 'I-79', 'I-80', 'I-81', 'I-82',
  'I-83', 'I-84', 'I-85', 'I-86', 'I-87', 'I-88', 'I-89', 'I-90', 'I-93',
  'I-94', 'I-95', 'I-96', 'I-97', 'I-99',
];

// ── Traffic Variation Slots ───────────────────────────────────────────────────

const TRAFFIC_VARIATION_SLOTS = [
  { label: 'morningRush', display: '8am Mon',  targetDay: 1, hour: 8  },
  { label: 'midday',      display: '12pm Mon', targetDay: 1, hour: 12 },
  { label: 'eveningRush', display: '5pm Mon',  targetDay: 1, hour: 17 },
  { label: 'weekend',     display: '10am Sat', targetDay: 6, hour: 10 },
];

// ── Google Places Type Filters ────────────────────────────────────────────────

const GROCERY_EXCLUDED_TYPES = ['gas_station', 'convenience_store', 'lodging'];

const PARK_EXCLUDED_TYPES = [
  'local_government_office', 'lawyer', 'insurance_agency', 'political',
];

const PARK_LEISURE_TYPES = [
  'park', 'natural_feature', 'campground', 'amusement_park', 'zoo',
  'stadium', 'gym', 'recreation_area',
];

const SCHOOL_PLACE_TYPES = new Set([
  'school', 'primary_school', 'secondary_school', 'university',
]);

const SCHOOL_NAME_TERMS = /school|elementary|middle|high\s+school|academy|college|university|institute|charter|magnet|preparatory|prep\s+school|learning\s+center|educational/i;

const ELEMENTARY_SCHOOL_EXCLUSIONS = [
  'preschool', 'pre-school', 'daycare', 'day care', 'montessori', 'private',
];

const WALK_TYPES = [
  { type: 'grocery_or_supermarket', weight: 25, label: 'Grocery',  icon: '🛒' },
  { type: 'restaurant',             weight: 20, label: 'Dining',   icon: '🍽️' },
  { type: 'transit_station',        weight: 20, label: 'Transit',  icon: '🚌' },
  { type: 'park',                   weight: 15, label: 'Park',     icon: '🌳' },
  { type: 'pharmacy',               weight: 20, label: 'Pharmacy', icon: '💊' },
];

const COMMERCIAL_DEV_TYPES = [
  { type: 'shopping_mall',    label: 'Shopping Center', icon: '🏬' },
  { type: 'supermarket',      label: 'Grocery Store',   icon: '🛒' },
  { type: 'department_store', label: 'Major Retail',    icon: '🏪' },
  { type: 'gym',              label: 'Fitness Center',  icon: '💪' },
  { type: 'movie_theater',    label: 'Entertainment',   icon: '🎬' },
  { type: 'bank',             label: 'Financial',       icon: '🏦' },
];

// ── Airport Filters ───────────────────────────────────────────────────────────

const NON_AIRPORT_RE = /paragli|skydiv|balloon|ultralight|glider|soaring|ppg|hang.?glid|flying.?club|flight.?school|air.?sport|airfield.?club/i;
const AIRPORT_RE     = /airport|airfield|air\s*force\s*base|\bafb\b|international|regional|municipal|executive|aviation\s*center|jetport/i;

// ── Response Time Estimates ───────────────────────────────────────────────────

const RESPONSE_SPEED_MPH       = { police: 30, fire: 35 };
const RESPONSE_DISPATCH_MINUTES = { police: 2, fire: 1.5 };
const RESPONSE_TIME_THRESHOLDS = {
  police: { excellent: 5, good: 10, fair: 15 },
  fire:   { excellent: 5, good:  8, fair: 12 },
};

// ── Flood Zone Classifications (FEMA) ─────────────────────────────────────────

const FEMA_FLOOD_ZONES = {
  A:   { risk: 'High',      insuranceRequired: true,  description: '1% annual flood chance (100-year floodplain).' },
  AE:  { risk: 'High',      insuranceRequired: true,  description: '1% annual flood chance with base flood elevation.' },
  AH:  { risk: 'High',      insuranceRequired: true,  description: 'Shallow flooding area.' },
  AO:  { risk: 'High',      insuranceRequired: true,  description: 'Sheet flow flooding area.' },
  V:   { risk: 'Very High', insuranceRequired: true,  description: 'Coastal high-velocity wave action.' },
  VE:  { risk: 'Very High', insuranceRequired: true,  description: 'Coastal flood with wave action.' },
  X:   { risk: 'Minimal',   insuranceRequired: false, description: 'Outside high-risk flood areas.' },
  B:   { risk: 'Moderate',  insuranceRequired: false, description: '0.2% annual flood chance.' },
  C:   { risk: 'Minimal',   insuranceRequired: false, description: 'Minimal flood hazard.' },
};

// ── Tornado Risk Tiers (NOAA historical, tornadoes/year) ─────────────────────

const TORNADO_TIER = {
  high:     ['TX', 'KS', 'OK', 'NE', 'IA', 'SD', 'ND', 'MO', 'MS', 'AL', 'AR', 'TN', 'KY', 'IN', 'IL', 'OH'],
  moderate: ['FL', 'GA', 'SC', 'NC', 'VA', 'WV', 'CO', 'WY', 'MT', 'MN', 'WI', 'MI', 'LA'],
  low:      ['CA', 'OR', 'WA', 'ID', 'NV', 'AZ', 'NM', 'UT', 'AK', 'HI', 'ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC'],
};

// ── Radon Zone by State FIPS (EPA) ────────────────────────────────────────────
// Zone 1 = high risk, 2 = moderate, 3 = low. Unlisted states default to zone 2.

const RADON_ZONE_BY_STATE = {
  '08': 1, '17': 1, '18': 1, '19': 1, '20': 1, '21': 1, '26': 1,
  '27': 1, '29': 1, '30': 1, '31': 1, '38': 1, '39': 1, '42': 1,
  '46': 1, '55': 1, '56': 1,
  '12': 3, '15': 3, '22': 3,
};

// ── Frost Date Table (USDA Hardiness Zones) ───────────────────────────────────

const FROST_DATE_TABLE = {
  '1':   { lastSpring: 'June 15',     firstFall: 'August 1',    days: 47  },
  '2':   { lastSpring: 'June 1',      firstFall: 'August 15',   days: 75  },
  '2a':  { lastSpring: 'June 1',      firstFall: 'August 15',   days: 75  },
  '2b':  { lastSpring: 'June 1',      firstFall: 'August 15',   days: 75  },
  '3':   { lastSpring: 'May 20',      firstFall: 'September 10', days: 113 },
  '3a':  { lastSpring: 'May 25',      firstFall: 'September 1', days: 99  },
  '3b':  { lastSpring: 'May 15',      firstFall: 'September 15', days: 123 },
  '4':   { lastSpring: 'May 7',       firstFall: 'September 22', days: 138 },
  '4a':  { lastSpring: 'May 7',       firstFall: 'September 22', days: 138 },
  '4b':  { lastSpring: 'May 1',       firstFall: 'September 25', days: 147 },
  '5':   { lastSpring: 'April 25',    firstFall: 'October 5',   days: 163 },
  '5a':  { lastSpring: 'April 25',    firstFall: 'October 5',   days: 163 },
  '5b':  { lastSpring: 'April 15',    firstFall: 'October 15',  days: 183 },
  '6':   { lastSpring: 'April 10',    firstFall: 'October 20',  days: 193 },
  '6a':  { lastSpring: 'April 10',    firstFall: 'October 20',  days: 193 },
  '6b':  { lastSpring: 'April 15',    firstFall: 'October 15',  days: 183 },
  '7':   { lastSpring: 'March 25',    firstFall: 'November 5',  days: 225 },
  '7a':  { lastSpring: 'March 25',    firstFall: 'November 5',  days: 225 },
  '7b':  { lastSpring: 'March 15',    firstFall: 'November 15', days: 245 },
  '8':   { lastSpring: 'March 1',     firstFall: 'December 1',  days: 275 },
  '8a':  { lastSpring: 'March 1',     firstFall: 'December 1',  days: 275 },
  '8b':  { lastSpring: 'February 15', firstFall: 'December 15', days: 303 },
  '9':   { lastSpring: 'February 1',  firstFall: 'December 20', days: 322 },
  '9a':  { lastSpring: 'February 1',  firstFall: 'December 20', days: 322 },
  '9b':  { lastSpring: 'January 20',  firstFall: 'December 31', days: 345 },
  '10':  { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '10a': { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '10b': { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '11':  { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '11a': { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '11b': { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '12':  { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '13':  { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
};

// ── Wildlife Filter Lists ─────────────────────────────────────────────────────

const NATIVE_PLANT_EXCLUDE = new Set([
  'ambrosia', 'toxicodendron', 'conium', 'solanum carolinense',
  'urtica', 'arctium', 'phytolacca', 'robinia pseudoacacia',
  'cynanchum laeve', 'packera glabella', 'ageratina altissima',
]);

const NATIVE_PLANT_EXCLUDE_NAMES = [
  'ragweed', 'poison ivy', 'poison oak', 'poison sumac',
  'hemlock', 'horsenettle', 'pokeweed', 'stinging nettle', 'black locust',
];

const BENIGN_INTRODUCED = new Set([
  'trifolium repens', 'trifolium pratense', 'cichorium intybus', 'glechoma hederacea',
  'lamium purpureum', 'veronica persica', 'medicago lupulina',
  'stellaria media', 'taraxacum officinale', 'plantago major',
  'poa annua', 'capsella bursa-pastoris', 'cerastium fontanum',
  'tussilago farfara', 'sherardia arvensis', 'geranium molle',
  'lolium perenne', 'dactylis glomerata', 'phleum pratense',
  'trifolium incarnatum', 'trifolium hybridum', 'lamium amplexicaule',
  'vicia sativa', 'veronica arvensis', 'ornithogalum umbellatum',
  'potentilla indica', 'ajuga reptans', 'rumex acetosella',
  'hypericum perforatum', 'lotus corniculatus', 'achillea millefolium',
]);

const DOMESTIC_MAMMALS = new Set([
  'felis catus', 'canis lupus familiaris', 'sus scrofa domesticus',
  'myocastor coypus',
]);

// ── Garden: Plant growth form lookup (scientific name lowercase → form) ────────
const PLANT_GROWTH_FORMS = new Map([
  // Trees — canopy
  ['quercus alba', 'tree'], ['quercus rubra', 'tree'], ['quercus macrocarpa', 'tree'],
  ['quercus velutina', 'tree'], ['quercus stellata', 'tree'], ['quercus palustris', 'tree'],
  ['quercus bicolor', 'tree'], ['quercus coccinea', 'tree'], ['quercus imbricaria', 'tree'],
  ['acer saccharum', 'tree'], ['acer rubrum', 'tree'], ['acer saccharinum', 'tree'],
  ['acer negundo', 'tree'], ['acer pensylvanicum', 'tree'],
  ['liriodendron tulipifera', 'tree'], ['platanus occidentalis', 'tree'],
  ['juglans nigra', 'tree'], ['carya ovata', 'tree'], ['carya illinoinensis', 'tree'],
  ['carya cordiformis', 'tree'], ['carya laciniosa', 'tree'], ['carya tomentosa', 'tree'],
  ['fagus grandifolia', 'tree'], ['betula nigra', 'tree'], ['betula papyrifera', 'tree'],
  ['betula occidentalis', 'tree'], ['betula lenta', 'tree'],
  ['fraxinus americana', 'tree'], ['fraxinus pennsylvanica', 'tree'],
  ['ulmus americana', 'tree'], ['ulmus rubra', 'tree'],
  ['nyssa sylvatica', 'tree'], ['liquidambar styraciflua', 'tree'],
  ['prunus serotina', 'tree'], ['prunus americana', 'tree'],
  ['sassafras albidum', 'tree'], ['oxydendrum arboreum', 'tree'],
  ['magnolia virginiana', 'tree'], ['magnolia acuminata', 'tree'],
  ['tilia americana', 'tree'], ['celtis occidentalis', 'tree'],
  ['gleditsia triacanthos', 'tree'], ['gymnocladus dioicus', 'tree'],
  ['pinus strobus', 'tree'], ['pinus resinosa', 'tree'], ['pinus ponderosa', 'tree'],
  ['pinus contorta', 'tree'], ['pinus echinata', 'tree'], ['pinus virginiana', 'tree'],
  ['pseudotsuga menziesii', 'tree'], ['abies balsamea', 'tree'], ['abies lasiocarpa', 'tree'],
  ['picea glauca', 'tree'], ['picea engelmannii', 'tree'], ['picea rubens', 'tree'],
  ['tsuga canadensis', 'tree'], ['thuja occidentalis', 'tree'],
  ['populus tremuloides', 'tree'], ['populus deltoides', 'tree'], ['populus grandidentata', 'tree'],
  ['larix laricina', 'tree'], ['larix occidentalis', 'tree'],
  // Trees — understory
  ['cercis canadensis', 'tree'], ['cornus florida', 'tree'], ['cornus alternifolia', 'tree'],
  ['amelanchier arborea', 'tree'], ['amelanchier laevis', 'tree'], ['amelanchier alnifolia', 'tree'],
  ['hamamelis virginiana', 'tree'], ['chionanthus virginicus', 'tree'],
  ['halesia carolina', 'tree'], ['asimina triloba', 'tree'],
  ['carpinus caroliniana', 'tree'], ['ostrya virginiana', 'tree'],
  ['crataegus mollis', 'tree'], ['crataegus crus-galli', 'tree'],
  ['acer glabrum', 'tree'], ['acer circinatum', 'tree'],
  ['diospyros virginiana', 'tree'],
  // Shrubs
  ['lindera benzoin', 'shrub'], ['cephalanthus occidentalis', 'shrub'],
  ['sambucus canadensis', 'shrub'], ['sambucus racemosa', 'shrub'],
  ['physocarpus opulifolius', 'shrub'], ['callicarpa americana', 'shrub'],
  ['symphoricarpos orbiculatus', 'shrub'], ['symphoricarpos albus', 'shrub'],
  ['rhododendron maximum', 'shrub'], ['rhododendron catawbiense', 'shrub'],
  ['rhododendron periclymenoides', 'shrub'], ['rhododendron viscosum', 'shrub'],
  ['kalmia latifolia', 'shrub'], ['kalmia angustifolia', 'shrub'],
  ['ilex verticillata', 'shrub'], ['ilex glabra', 'shrub'], ['ilex opaca', 'shrub'],
  ['vaccinium corymbosum', 'shrub'], ['vaccinium angustifolium', 'shrub'],
  ['vaccinium membranaceum', 'shrub'],
  ['viburnum lentago', 'shrub'], ['viburnum prunifolium', 'shrub'],
  ['viburnum dentatum', 'shrub'], ['viburnum trilobum', 'shrub'], ['viburnum acerifolium', 'shrub'],
  ['prunus virginiana', 'shrub'], ['prunus pumila', 'shrub'],
  ['ribes americanum', 'shrub'], ['ribes cereum', 'shrub'], ['ribes odoratum', 'shrub'],
  ['rosa carolina', 'shrub'], ['rosa palustris', 'shrub'], ['rosa woodsii', 'shrub'],
  ['spiraea alba', 'shrub'], ['spiraea tomentosa', 'shrub'],
  ['alnus serrulata', 'shrub'], ['alnus incana', 'shrub'],
  ['salix exigua', 'shrub'], ['salix humilis', 'shrub'],
  ['corylus americana', 'shrub'], ['corylus cornuta', 'shrub'],
  ['myrica pensylvanica', 'shrub'], ['comptonia peregrina', 'shrub'],
  ['dirca palustris', 'shrub'], ['fothergilla gardenii', 'shrub'],
  ['artemisia tridentata', 'shrub'], ['purshia tridentata', 'shrub'],
  ['chrysothamnus nauseosus', 'shrub'],
  // Perennials / herbaceous
  ['echinacea purpurea', 'perennial'], ['echinacea pallida', 'perennial'],
  ['rudbeckia hirta', 'perennial'], ['rudbeckia laciniata', 'perennial'],
  ['monarda fistulosa', 'perennial'], ['monarda didyma', 'perennial'],
  ['solidago canadensis', 'perennial'], ['solidago rugosa', 'perennial'],
  ['solidago speciosa', 'perennial'], ['solidago odora', 'perennial'],
  ['symphyotrichum novae-angliae', 'perennial'], ['symphyotrichum oblongifolium', 'perennial'],
  ['symphyotrichum cordifolium', 'perennial'], ['symphyotrichum laeve', 'perennial'],
  ['phlox divaricata', 'perennial'], ['phlox stolonifera', 'perennial'], ['phlox paniculata', 'perennial'],
  ['aquilegia canadensis', 'perennial'], ['aquilegia flavescens', 'perennial'],
  ['geranium maculatum', 'perennial'], ['lobelia cardinalis', 'perennial'],
  ['lobelia siphilitica', 'perennial'], ['mertensia virginica', 'perennial'],
  ['sanguinaria canadensis', 'perennial'], ['podophyllum peltatum', 'perennial'],
  ['coreopsis lanceolata', 'perennial'], ['coreopsis tripteris', 'perennial'],
  ['heliopsis helianthoides', 'perennial'], ['helianthus mollis', 'perennial'],
  ['baptisia australis', 'perennial'], ['liatris spicata', 'perennial'],
  ['liatris pycnostachya', 'perennial'], ['penstemon digitalis', 'perennial'],
  ['penstemon hirsutus', 'perennial'], ['penstemon strictus', 'perennial'],
  ['allium cernuum', 'perennial'], ['allium canadense', 'perennial'],
  ['eryngium yuccifolium', 'perennial'], ['asclepias tuberosa', 'perennial'],
  ['asclepias syriaca', 'perennial'], ['asclepias incarnata', 'perennial'],
  ['amsonia tabernaemontana', 'perennial'], ['ruellia caroliniensis', 'perennial'],
  ['silphium perfoliatum', 'perennial'], ['silphium laciniatum', 'perennial'],
  ['ratibida pinnata', 'perennial'], ['agastache foeniculum', 'perennial'],
  ['verbena hastata', 'perennial'], ['vernonia noveboracensis', 'perennial'],
  ['eupatorium maculatum', 'perennial'], ['eutrochium purpureum', 'perennial'],
  ['trillium grandiflorum', 'perennial'], ['trillium erectum', 'perennial'],
  ['balsamorhiza sagittata', 'perennial'], ['castilleja miniata', 'perennial'],
  ['eriogonum umbellatum', 'perennial'], ['lupinus argenteus', 'perennial'],
  ['gaillardia aristata', 'perennial'], ['arnica cordifolia', 'perennial'],
  // Grasses / sedges
  ['schizachyrium scoparium', 'grass'], ['andropogon gerardii', 'grass'],
  ['sorghastrum nutans', 'grass'], ['panicum virgatum', 'grass'],
  ['bouteloua curtipendula', 'grass'], ['bouteloua gracilis', 'grass'],
  ['carex pensylvanica', 'grass'], ['carex stricta', 'grass'],
  ['festuca idahoensis', 'grass'], ['nassella viridula', 'grass'],
  // Vines
  ['parthenocissus quinquefolia', 'vine'], ['lonicera sempervirens', 'vine'],
  ['clematis virginiana', 'vine'], ['campsis radicans', 'vine'],
  ['wisteria frutescens', 'vine'],
]);

// ── Garden: Monarch migration corridor states ─────────────────────────────────
const MONARCH_CORRIDOR_STATES = new Set([
  'TX', 'OK', 'KS', 'NE', 'IA', 'MO', 'IL', 'IN', 'KY', 'TN', 'OH', 'MI',
  'MN', 'WI', 'AR', 'MS', 'AL', 'GA', 'FL', 'SC', 'NC', 'VA', 'WV', 'PA',
  'NY', 'NJ', 'MD', 'DE', 'CT', 'MA', 'RI', 'NH', 'VT', 'ME', 'LA', 'SD',
  'ND',
]);

// Native milkweed species by state — for monarch waystation recommendations
const MILKWEED_BY_STATE = {
  KY: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)', 'Purple Milkweed (Asclepias purpurascens)', 'Swamp Milkweed (Asclepias incarnata)'],
  IN: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)', 'Swamp Milkweed (Asclepias incarnata)', 'Poke Milkweed (Asclepias exaltata)'],
  OH: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)', 'Swamp Milkweed (Asclepias incarnata)'],
  IL: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)', 'Whorled Milkweed (Asclepias verticillata)'],
  MO: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)', 'Green-flowered Milkweed (Asclepias viridiflora)'],
  TX: ['Antelope Horn Milkweed (Asclepias asperula)', 'Green-flowered Milkweed (Asclepias viridiflora)', 'Zizotes Milkweed (Asclepias oenotheroides)'],
  FL: ['Sandhill Milkweed (Asclepias humistrata)', 'Butterfly Weed (Asclepias tuberosa)', 'White Milkweed (Asclepias variegata)'],
  GA: ['Butterfly Weed (Asclepias tuberosa)', 'Swamp Milkweed (Asclepias incarnata)', 'White Milkweed (Asclepias variegata)'],
  MN: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)', 'Whorled Milkweed (Asclepias verticillata)'],
  WI: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)', 'Swamp Milkweed (Asclepias incarnata)'],
  MI: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)', 'Swamp Milkweed (Asclepias incarnata)'],
  _default: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)', 'Swamp Milkweed (Asclepias incarnata)'],
};

// ── Garden: Firefly habitat — eastern US states where fireflies are common ────
const FIREFLY_STATES = new Set([
  'AL', 'AR', 'CT', 'DE', 'FL', 'GA', 'IL', 'IN', 'KY', 'LA', 'MA', 'MD',
  'ME', 'MI', 'MN', 'MO', 'MS', 'NC', 'NH', 'NJ', 'NY', 'OH', 'PA', 'RI',
  'SC', 'TN', 'TX', 'VA', 'VT', 'WI', 'WV',
]);

// ── State Financial Tables ────────────────────────────────────────────────────

const STATE_TAX_RATES = {
  AL:0.39,AK:1.04,AZ:0.60,AR:0.62,CA:0.73,CO:0.49,CT:1.73,DE:0.55,FL:0.80,GA:0.83,
  HI:0.28,ID:0.56,IL:2.07,IN:0.83,IA:1.46,KS:1.30,KY:0.83,LA:0.56,ME:1.09,MD:1.02,
  MA:1.12,MI:1.32,MN:1.02,MS:0.75,MO:0.93,MT:0.74,NE:1.54,NV:0.55,NH:1.89,NJ:2.13,
  NM:0.67,NY:1.40,NC:0.70,ND:0.88,OH:1.41,OK:0.88,OR:0.87,PA:1.36,RI:1.29,SC:0.52,
  SD:1.22,TN:0.66,TX:1.60,UT:0.52,VT:1.73,VA:0.75,WA:0.84,WV:0.55,WI:1.61,WY:0.55,
  DC:0.56,
};

const STATE_INSURANCE_ANNUAL = {
  AL:2380,AK:975, AZ:1690,AR:2650,CA:1380,CO:2310,CT:1540,DE:1010,FL:4231,GA:2310,
  HI:560, ID:1090,IL:2049,IN:1280,IA:1280,KS:3460,KY:1680,LA:3540,ME:1100,MD:1240,
  MA:1430,MI:1400,MN:1530,MS:2970,MO:2220,MT:1550,NE:2610,NV:1060,NH:1160,NJ:1440,
  NM:1810,NY:1274,NC:1580,ND:1520,OH:1390,OK:3900,OR:1250,PA:1340,RI:1280,SC:1990,
  SD:1960,TN:2020,TX:3429,UT:1010,VT:1090,VA:1330,WA:1450,WV:1200,WI:1200,WY:1370,
  DC:1200,
};

const STATE_UTILITIES_MONTHLY = {
  AL:215,AK:195,AZ:180,AR:205,CA:175,CO:145,CT:245,DE:185,FL:195,GA:195,
  HI:215,ID:155,IL:185,IN:195,IA:175,KS:185,KY:190,LA:200,ME:195,MD:185,
  MA:225,MI:195,MN:185,MS:200,MO:185,MT:165,NE:175,NV:160,NH:215,NJ:210,
  NM:175,NY:215,NC:175,ND:185,OH:185,OK:185,OR:155,PA:185,RI:215,SC:175,
  SD:175,TN:200,TX:195,UT:155,VT:195,VA:175,WA:155,WV:185,WI:175,WY:175,
  DC:155,
};

const STATE_HOMESTEAD = {
  KY: 'Kentucky offers a homestead exemption ($46,350 off assessed value) for homeowners 65+ or permanently disabled.',
  TX: 'Texas provides a $100,000 homestead exemption from school district taxes, plus additional caps on annual assessment increases.',
  FL: 'Florida\'s $50,000 homestead exemption plus the Save Our Homes cap (3%/yr assessment increase limit) can produce significant long-term savings.',
  CA: 'California\'s Prop 13 limits assessed value increases to 2%/yr for owner-occupied homes — a major long-term advantage in a high-appreciation state.',
  IL: 'Illinois offers a General Homestead Exemption ($10,000 off EAV) and a Long-time Occupant Exemption for incomes under $100,000.',
  GA: 'Georgia provides a standard homestead exemption plus additional senior exemptions. Amounts vary significantly by county.',
  OH: 'Ohio\'s Homestead Exemption provides $25,000 off assessed value for homeowners 65+ or permanently disabled.',
  PA: 'Pennsylvania\'s Homestead/Farmstead Exclusion reduces school property taxes; amounts vary by school district.',
  NC: 'North Carolina offers an Elderly/Disabled Exclusion and a Circuit Breaker deferral program for qualifying homeowners.',
  SC: 'South Carolina provides a 4% assessment ratio for primary residences (vs 6% for non-primary), a major ongoing savings.',
};

// ── State Cooperative Extension Offices ──────────────────────────────────────

const STATE_EXTENSION = {
  AL: { name: 'Alabama Cooperative Extension System',              url: 'www.aces.edu' },
  AK: { name: 'University of Alaska Cooperative Extension',        url: 'www.uaf.edu/ces' },
  AZ: { name: 'University of Arizona Cooperative Extension',       url: 'extension.arizona.edu' },
  AR: { name: 'University of Arkansas Cooperative Extension',      url: 'www.uaex.uada.edu' },
  CA: { name: 'UC Cooperative Extension',                          url: 'ucanr.edu' },
  CO: { name: 'Colorado State University Extension',               url: 'extension.colostate.edu' },
  CT: { name: 'UConn Extension',                                   url: 'extension.uconn.edu' },
  DE: { name: 'University of Delaware Cooperative Extension',      url: 'sites.udel.edu/extension' },
  FL: { name: 'UF/IFAS Extension',                                 url: 'extension.ifas.ufl.edu' },
  GA: { name: 'UGA Cooperative Extension',                         url: 'extension.uga.edu' },
  HI: { name: 'University of Hawaii Cooperative Extension',        url: 'www.ctahr.hawaii.edu/site/Ext.aspx' },
  ID: { name: 'University of Idaho Extension',                     url: 'www.uidaho.edu/extension' },
  IL: { name: 'University of Illinois Extension',                  url: 'extension.illinois.edu' },
  IN: { name: 'Purdue Extension',                                  url: 'extension.purdue.edu' },
  IA: { name: 'Iowa State University Extension',                   url: 'www.extension.iastate.edu' },
  KS: { name: 'K-State Research and Extension',                    url: 'www.ksre.k-state.edu' },
  KY: { name: 'UK Cooperative Extension Service',                  url: 'extension.ca.uky.edu' },
  LA: { name: 'LSU AgCenter',                                      url: 'www.lsuagcenter.com' },
  ME: { name: 'University of Maine Cooperative Extension',         url: 'extension.umaine.edu' },
  MD: { name: 'University of Maryland Extension',                  url: 'extension.umd.edu' },
  MA: { name: 'UMass Extension',                                   url: 'ag.umass.edu/extension' },
  MI: { name: 'MSU Extension',                                     url: 'www.canr.msu.edu/outreach' },
  MN: { name: 'University of Minnesota Extension',                 url: 'extension.umn.edu' },
  MS: { name: 'Mississippi State University Extension',            url: 'extension.msstate.edu' },
  MO: { name: 'University of Missouri Extension',                  url: 'extension.missouri.edu' },
  MT: { name: 'Montana State University Extension',                url: 'www.msuextension.org' },
  NE: { name: 'Nebraska Extension',                                url: 'extension.unl.edu' },
  NV: { name: 'University of Nevada Cooperative Extension',        url: 'www.unce.unr.edu' },
  NH: { name: 'UNH Cooperative Extension',                         url: 'extension.unh.edu' },
  NJ: { name: 'Rutgers Cooperative Extension',                     url: 'njaes.rutgers.edu' },
  NM: { name: 'NMSU Cooperative Extension Service',               url: 'extension.nmsu.edu' },
  NY: { name: 'Cornell Cooperative Extension',                     url: 'cce.cornell.edu' },
  NC: { name: 'NC State Extension',                                url: 'www.ces.ncsu.edu' },
  ND: { name: 'NDSU Extension',                                    url: 'www.ndsu.edu/extension' },
  OH: { name: 'Ohio State University Extension',                   url: 'extension.osu.edu' },
  OK: { name: 'Oklahoma Cooperative Extension Service',            url: 'extension.okstate.edu' },
  OR: { name: 'Oregon State University Extension Service',         url: 'extension.oregonstate.edu' },
  PA: { name: 'Penn State Extension',                              url: 'extension.psu.edu' },
  RI: { name: 'URI Cooperative Extension',                         url: 'web.uri.edu/coopext' },
  SC: { name: 'Clemson Cooperative Extension',                     url: 'www.clemson.edu/extension' },
  SD: { name: 'SDSU Extension',                                    url: 'extension.sdstate.edu' },
  TN: { name: 'UT Extension',                                      url: 'extension.tennessee.edu' },
  TX: { name: 'Texas A&M AgriLife Extension',                      url: 'agrilifeextension.tamu.edu' },
  UT: { name: 'USU Extension',                                     url: 'extension.usu.edu' },
  VT: { name: 'UVM Extension',                                     url: 'www.uvm.edu/extension' },
  VA: { name: 'Virginia Cooperative Extension',                    url: 'ext.vt.edu' },
  WA: { name: 'WSU Extension',                                     url: 'extension.wsu.edu' },
  WV: { name: 'WVU Extension Service',                             url: 'extension.wvu.edu' },
  WI: { name: 'UW-Extension',                                      url: 'fyi.extension.wisc.edu' },
  WY: { name: 'University of Wyoming Extension',                   url: 'www.uwyo.edu/uwext' },
  DC: { name: 'University of the District of Columbia Extension',  url: 'udc.edu/causes/cooperative-extension' },
};

// ── Broadband Technology Codes (FCC) ─────────────────────────────────────────

const BROADBAND_TECH_CODES = {
  10: 'DSL', 11: 'ADSL2+', 12: 'VDSL', 40: 'Cable', 41: 'DOCSIS 3.0',
  42: 'DOCSIS 3.1+', 50: 'Fiber', 60: 'Satellite', 70: 'Fixed Wireless',
  300: 'LTE Fixed Wireless', 400: 'Licensed Fixed Wireless', 500: 'Unlicensed Fixed Wireless',
};

// ── OpenStreetMap Overpass Endpoints ─────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

// ── Development Discovery Constants ──────────────────────────────────────────

const DEV_CACHE_TTL_MS     = 7 * 24 * 60 * 60 * 1000;
const DEV_REQUEST_DELAY_MS = 1200;
const DEV_MAX_ARTICLE_AGE  = 2 * 365 * 24 * 60 * 60 * 1000;

const DEV_TYPE_MAP = [
  {
    type: 'Grocery Store', icon: '🛒',
    keywords: ['publix', 'kroger', 'aldi', 'whole foods', 'trader joe', 'sprouts', 'meijer',
               'wegmans', 'food lion', 'harris teeter', 'grocery store', 'supermarket',
               'lidl', 'save a lot', 'piggly wiggly', 'fresh market'],
  },
  {
    type: 'Major Retail', icon: '🏪',
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

const DEV_STATUS_MAP = [
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

// ── Climate chapter — API endpoints and thresholds ────────────────────────────────
const NOAA_CDO_BASE_URL              = 'https://www.ncdc.noaa.gov/cdo-web/api/v2';
const NOAA_CDO_NORMALS_DATASET       = 'NORMAL_MLY';
const NOAA_CDO_NORMALS_ANN           = 'NORMAL_ANN';
const NOAA_STATION_SEARCH_RADII      = [0.36, 0.72, 1.45];
const FEMA_DECLARATIONS_URL          = 'https://www.fema.gov/api/open/v2/disasterDeclarations';
const USGS_ELEVATION_URL             = 'https://epqs.nationalmap.gov/v1/json';
const CLIMATE_STORM_LOOKBACK_YEARS   = 30;
const CLIMATE_FEMA_LOOKBACK_YEARS    = 20;
const CLIMATE_SIGNIFICANT_DAMAGE_USD = 100_000;

// ── Emergency alert systems — Tier 1 state-level unified systems ──────────────
// Two-tier approach: Tier 1 = statewide unified system (this map).
// Tier 2 = dynamic county URL + Google search (generated at runtime for missing states).
// URLs are best-effort starting points — verify accuracy before production use.
const STATE_ALERT_SYSTEMS = new Map([
  ['AL', { name: 'Alabama EMA Alerts',              url: 'https://ema.alabama.gov/alert' }],
  ['AK', { name: 'AK Alerts',                       url: 'https://ready.alaska.gov/Alerts' }],
  ['AZ', { name: 'AZ Ready',                        url: 'https://azready.gov' }],
  ['AR', { name: 'AR Alert',                        url: 'https://adem.arkansas.gov/alert' }],
  ['CA', { name: 'Alert California',                url: 'https://www.caloes.ca.gov/alerts' }],
  ['CO', { name: 'CO Alert',                        url: 'https://coem.colorado.gov/alert' }],
  ['CT', { name: 'CT Alert',                        url: 'https://portal.ct.gov/DESPP/CT-Alert' }],
  ['DE', { name: 'DE Alert',                        url: 'https://dema.delaware.gov/alert' }],
  ['FL', { name: 'FL Emergency Alerts',             url: 'https://www.floridadisaster.org/alerts' }],
  ['GA', { name: 'GA Emergency Management',         url: 'https://gema.georgia.gov/alerts' }],
  ['HI', { name: 'HI Emergency Management',         url: 'https://dod.hawaii.gov/hiema/alerts' }],
  ['ID', { name: 'ID Bureau of Homeland Security',  url: 'https://idalert.idaho.gov' }],
  ['IL', { name: 'IL Emergency Management',         url: 'https://iema.illinois.gov/alerting' }],
  ['IN', { name: 'IN-Alert',                        url: 'https://www.in.gov/dhs/emergency-preparedness/in-alert' }],
  ['IA', { name: 'Iowa Homeland Security',          url: 'https://homelandsecurity.iowa.gov/alerts' }],
  ['KS', { name: 'KS Emergency Management',         url: 'https://www.kdem.ks.gov/alerts' }],
  ['KY', { name: 'KYEM Alert',                      url: 'https://kyem.ky.gov/alert' }],
  ['LA', { name: 'LA GOHSEP Alerts',                url: 'https://gohsep.la.gov/alerts' }],
  ['ME', { name: 'Maine Emergency Management',      url: 'https://www.maine.gov/mema/alerts' }],
  ['MD', { name: 'MD Alert',                        url: 'https://mema.maryland.gov/alerts' }],
  ['MA', { name: 'MA Emergency Management',         url: 'https://www.mass.gov/mema/alerts' }],
  ['MI', { name: 'MI Alerts',                       url: 'https://www.michigan.gov/msp/divisions/emhsd/alerts' }],
  ['MN', { name: 'MN Homeland Security',            url: 'https://hsem.dps.mn.gov/alerts' }],
  ['MS', { name: 'MS Emergency Management',         url: 'https://www.msema.org/alerts' }],
  ['MO', { name: 'MO Alert',                        url: 'https://sema.dps.mo.gov/alert' }],
  ['MT', { name: 'MT Alert',                        url: 'https://mtalert.mt.gov' }],
  ['NE', { name: 'NE Emergency Management',         url: 'https://nema.nebraska.gov/alerts' }],
  ['NV', { name: 'Nevada Alert',                    url: 'https://dem.nv.gov/alerts' }],
  ['NH', { name: 'NH Alerts Ready',                 url: 'https://www.nh.gov/safety/divisions/bem/alerts' }],
  ['NJ', { name: 'NJ Emergency Notification',       url: 'https://www.ready.nj.gov/alert' }],
  ['NM', { name: 'NM Emergency Management',         url: 'https://www.nmdhsem.org/alerts' }],
  ['NY', { name: 'NY Alert',                        url: 'https://www.ny.gov/programs/ny-alert' }],
  ['NC', { name: 'NC Emergency Management',         url: 'https://www.ncdps.gov/emergency/alerts' }],
  ['ND', { name: 'ND Emergency Services',           url: 'https://des.nd.gov/alerts' }],
  ['OH', { name: 'Ohio Emergency Management',       url: 'https://ema.ohio.gov/alerts' }],
  ['OK', { name: 'OK Emergency Management',         url: 'https://www.ok.gov/oem/alerts' }],
  ['OR', { name: 'OR Emergency Management',         url: 'https://www.oregon.gov/oem/alerts' }],
  ['PA', { name: 'PA Emergency Management',         url: 'https://www.pema.pa.gov/alerts' }],
  ['RI', { name: 'RI Emergency Management',         url: 'https://www.riema.ri.gov/alerts' }],
  ['SC', { name: 'SC Emergency Management',         url: 'https://www.scemd.org/alerts' }],
  ['SD', { name: 'SD Emergency Management',         url: 'https://dps.sd.gov/emergency-services/alerts' }],
  ['TN', { name: 'TN Emergency Management',         url: 'https://tnema.org/alerts' }],
  ['TX', { name: 'TxAlert',                         url: 'https://tdem.texas.gov/txalert' }],
  ['UT', { name: 'UT Alert',                        url: 'https://dem.utah.gov/alerts' }],
  ['VT', { name: 'VT Emergency Management',         url: 'https://vem.vermont.gov/alerts' }],
  ['VA', { name: 'VA Emergency Management',         url: 'https://www.vaemergency.gov/alerts' }],
  ['WA', { name: 'WA Emergency Management',         url: 'https://mil.wa.gov/emergency-management-division/alerts' }],
  ['WV', { name: 'WV Emergency Management',         url: 'https://emd.wv.gov/alerts' }],
  ['WI', { name: 'Wisconsin Emergency Management',  url: 'https://wem.wi.gov/alerts' }],
  ['WY', { name: 'WY Homeland Security',            url: 'https://hls.wyo.gov/alerts' }],
]);

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  // Search radii
  GROCERY_SEARCH_RADIUS_M,
  HOSPITAL_SEARCH_RADIUS_M,
  ELEMENTARY_SCHOOL_SEARCH_RADIUS_M,
  AIRPORT_SEARCH_RADIUS_M,
  AIRPORT_MAX_DISTANCE_MILES,
  WALKABILITY_SEARCH_RADIUS_M,
  DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M,
  OSM_ROAD_NOISE_RADIUS_M,
  OSM_RAIL_RADIUS_M,
  OSM_LANDUSE_RADIUS_M,
  WATER_QUALITY_SEARCH_RADIUS_MILES,
  INAT_NATIVE_PLANTS_RADIUS_KM,
  INAT_INVASIVE_PLANTS_RADIUS_KM,
  INAT_WILDLIFE_RADIUS_KM,
  INAT_BIRDS_RADIUS_KM,
  // Candidate counts
  GROCERY_CANDIDATE_COUNT,
  HOSPITAL_CANDIDATE_COUNT,
  COFFEE_SHOP_CANDIDATE_COUNT,
  INAT_NATIVE_PLANTS_PER_PAGE,
  INAT_INVASIVE_PLANTS_PER_PAGE,
  INAT_WILDLIFE_PER_PAGE,
  INAT_BIRDS_PER_PAGE,
  INAT_REPTILES_RADIUS_KM,
  INAT_REPTILES_PER_PAGE,
  INAT_INSECTS_RADIUS_KM,
  INAT_INSECTS_PER_PAGE,
  INAT_BUTTERFLIES_RADIUS_KM,
  INAT_BUTTERFLIES_PER_PAGE,
  // Highway
  HIGHWAY_MAX_DRIVE_MINUTES,
  HIGHWAY_INTERCHANGE_MAX_MINUTES,
  // Report UI
  MAX_CONCURRENT_PDFS,
  CUSTOM_DEST_ICONS,
  ERROR_ICONS,
  // Interstate
  INTERSTATE_LIST,
  // Traffic
  TRAFFIC_VARIATION_SLOTS,
  // Google Places filters
  GROCERY_EXCLUDED_TYPES,
  PARK_EXCLUDED_TYPES,
  PARK_LEISURE_TYPES,
  SCHOOL_PLACE_TYPES,
  SCHOOL_NAME_TERMS,
  ELEMENTARY_SCHOOL_EXCLUSIONS,
  WALK_TYPES,
  COMMERCIAL_DEV_TYPES,
  // Airport
  NON_AIRPORT_RE,
  AIRPORT_RE,
  // Response times
  RESPONSE_SPEED_MPH,
  RESPONSE_DISPATCH_MINUTES,
  RESPONSE_TIME_THRESHOLDS,
  // Environmental
  FEMA_FLOOD_ZONES,
  TORNADO_TIER,
  RADON_ZONE_BY_STATE,
  // Garden
  FROST_DATE_TABLE,
  NATIVE_PLANT_EXCLUDE,
  NATIVE_PLANT_EXCLUDE_NAMES,
  BENIGN_INTRODUCED,
  DOMESTIC_MAMMALS,
  PLANT_GROWTH_FORMS,
  MONARCH_CORRIDOR_STATES,
  MILKWEED_BY_STATE,
  FIREFLY_STATES,
  // State data
  STATE_TAX_RATES,
  STATE_INSURANCE_ANNUAL,
  STATE_UTILITIES_MONTHLY,
  STATE_HOMESTEAD,
  STATE_EXTENSION,
  // Broadband
  BROADBAND_TECH_CODES,
  // OSM
  OVERPASS_ENDPOINTS,
  // Development discovery
  DEV_CACHE_TTL_MS,
  DEV_REQUEST_DELAY_MS,
  DEV_MAX_ARTICLE_AGE,
  DEV_TYPE_MAP,
  DEV_STATUS_MAP,
  // Rural mode detection (CONSTRAINT-007)
  RURAL_MODE_URBAN_POP_MIN,
  RURAL_MODE_SUBURBAN_POP_MIN,
  RURAL_MODE_REMOTE_POP_MAX,
  RURAL_MODE_SUBURBAN_MAX_DRIVE_MINUTES,
  DRIVE_TIME_COHERENCE_THRESHOLD_MINUTES,
  // Climate chapter
  NOAA_CDO_BASE_URL,
  NOAA_CDO_NORMALS_DATASET,
  NOAA_CDO_NORMALS_ANN,
  NOAA_STATION_SEARCH_RADII,
  FEMA_DECLARATIONS_URL,
  USGS_ELEVATION_URL,
  CLIMATE_STORM_LOOKBACK_YEARS,
  CLIMATE_FEMA_LOOKBACK_YEARS,
  CLIMATE_SIGNIFICANT_DAMAGE_USD,
  STATE_ALERT_SYSTEMS,
};
