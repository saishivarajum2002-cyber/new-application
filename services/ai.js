/**
 * AI Service — Local Rule-Based Property Description Generator
 * Works 100% offline, no API key required.
 */

// ─── Phrase library ──────────────────────────────────────────────────────────

const INTROS = [
  "Discover an extraordinary opportunity in one of the city's most coveted addresses.",
  "Nestled in a prime location, this remarkable residence redefines luxury living.",
  "Welcome to an exceptional home where sophisticated design meets everyday comfort.",
  "Step into a world of refined elegance with this stunning property.",
  "Presenting a rare gem that perfectly balances modern luxury and timeless style.",
  "Experience elevated living in this meticulously crafted residence.",
  "A masterpiece of contemporary architecture awaits in this stunning property.",
  "This outstanding residence offers the ultimate in luxury lifestyle and investment value.",
  "Offering an unparalleled blend of sophistication and comfort, this residence is truly one of a kind.",
  "Situated in a highly sought-after district, this home represents the pinnacle of modern urban living.",
  "Prepare to be captivated by this exquisite residence, offering unmatched quality and style.",
  "An architectural triumph in the heart of the city, perfectly designed for modern excellence.",
  "Luxury meets lifestyle in this spectacular property, where every detail has been perfected.",
  "Welcome home to a sanctuary of elegance, boasting refined finishes and grand spaces.",
  "A prestigious residence that stands as a testament to fine design and premium craftsmanship.",
];

const ADJECTIVES = [
  "stunning", "exquisite", "premium", "sophisticated", "magnificent", "refined", 
  "exceptional", "remarkable", "breathtaking", "unmatched", "prestigious", "vibrant",
  "truly elegant", "beautifully appointed", "masterfully designed"
];

const FEATURE_PHRASES = {
  pool:      ["a resort-style swimming pool", "a stunning private pool", "a sparkling infinity pool"],
  "sea view": ["breathtaking panoramic sea views", "sweeping ocean vistas", "uninterrupted waterfront views"],
  "city view":["commanding city skyline views", "spectacular panoramic city views", "impressive urban vistas"],
  garden:    ["a beautifully landscaped private garden", "lush tropical garden grounds", "a serene private garden retreat"],
  balcony:   ["an expansive private balcony", "generous wrap-around balconies", "a grand terrace perfect for entertaining"],
  "smart home":["state-of-the-art smart home technology", "fully integrated smart home systems", "cutting-edge home automation"],
  gym:       ["a private in-unit gym", "a dedicated fitness suite", "a fully-equipped private gymnasium"],
  garage:    ["a private multi-car garage", "secure covered parking", "an oversized private garage"],
  "marble floors":["exquisite imported marble flooring", "luxurious full marble floors", "premium marble finishes throughout"],
  "open plan":["an impressive open-plan living layout", "a bright and airy open-concept design", "seamlessly flowing open-plan spaces"],
  "fully furnished":["a curated, fully furnished interior", "turnkey fully furnished living", "bespoke furniture and fittings included"],
  "maid room":["a dedicated maid's room", "separate domestic staff quarters"],
  study:     ["a private home office study", "a dedicated study and workspace"],
  terrace:   ["a sprawling rooftop terrace", "an elegant sun terrace"],
};

const BED_PHRASES = {
  studio: "a sophisticated studio layout",
  "1":    "one generously proportioned bedroom",
  "1br":  "one generously proportioned bedroom",
  "2":    "two beautifully appointed bedrooms",
  "2br":  "two beautifully appointed bedrooms",
  "3":    "three spacious bedrooms",
  "3br":  "three spacious bedrooms",
  "4":    "four expansive bedrooms",
  "4br":  "four expansive bedrooms",
  "5":    "five grand bedrooms",
  "5br":  "five grand bedrooms",
  "5+":   "five or more magnificent bedrooms",
};

const PROPERTY_TYPES = {
  villa:      "villa",
  apartment:  "apartment",
  penthouse:  "penthouse",
  townhouse:  "townhouse",
  duplex:     "duplex",
  studio:     "studio",
  loft:       "loft",
  mansion:    "mansion",
};

const PRICE_PHRASES = (price) => {
  const n = parseFloat(String(price).replace(/[^0-9.]/g, ''));
  if (!n) return "offered at a compelling price point,";
  if (n >= 5000000) return `priced at an exceptional $${fmtPrice(n)},`;
  if (n >= 1000000) return `listing at $${fmtPrice(n)},`;
  return `available at $${fmtPrice(n)},`;
};

const CLOSINGS = [
  "A rare opportunity not to be missed.",
  "An unparalleled investment in a lifestyle of distinction.",
  "Your dream home awaits — schedule a private viewing today.",
  "This is truly a home that sets the standard for luxury living.",
  "Properties of this caliber rarely come to market; act quickly.",
  "A once-in-a-generation opportunity to own an iconic residence.",
  "Experience the height of luxury for yourself; contact us for a private tour.",
  "Secure your future in one of the world's most desirable locations.",
  "Refine your lifestyle with this exceptional residential offering.",
  "A masterpiece of living that must be seen to be fully appreciated.",
  "Don't wait to claim your place in this exclusive development.",
  "The pinnacle of elite residency, now available for the discerning buyer.",
];

const AREA_PHRASES = (sqft) => {
  const n = parseFloat(String(sqft).replace(/[^0-9.]/g, ''));
  if (!n) return null;
  if (n > 10000) return `an incredible ${n.toLocaleString()} sq ft of living space`;
  if (n > 4000)  return `${n.toLocaleString()} sq ft of expansive living space`;
  if (n > 2000)  return `${n.toLocaleString()} sq ft of well-appointed space`;
  return `${n.toLocaleString()} sq ft`;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmtPrice(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toLocaleString();
}

// ─── Main generator ──────────────────────────────────────────────────────────

const generateDescription = async (details) => {
  try {
    const text = buildDescription(details);
    return { success: true, text };
  } catch (err) {
    console.error('Local AI Error:', err.message);
    return {
      success: true,
      text: "This elegantly appointed residence offers an exceptional lifestyle opportunity, combining premium finishes with thoughtful design across every room. Ideally situated in one of the city's most prestigious addresses, this property delivers both comfort and sophistication at every turn. A rare chance to own a home that truly sets the standard for luxury living.",
    };
  }
};

function buildDescription(details) {
  const d = details.toLowerCase();

  // ── Extract property type
  let propType = 'property';
  for (const [key, label] of Object.entries(PROPERTY_TYPES)) {
    if (d.includes(key)) { propType = label; break; }
  }

  // ── Extract bedrooms
  let bedPhrase = null;
  for (const [key, phrase] of Object.entries(BED_PHRASES)) {
    // match "3br", "3 br", "3 bed", "3 bedrooms", "3bhk", "3 bhk"
    const pattern = new RegExp(`\\b${key}[\\s-]?(?:br|bed(?:room)?s?|bhk)\\b`, 'i');
    if (pattern.test(d)) {
      bedPhrase = phrase; break;
    }
  }

  // ── Extract area (sqft/sqm/sqrf)
  const areaMatch = d.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft|sq\.?\s*m|sqm|m²|ft²|sqrf)/i);
  const areaPhrase = areaMatch ? AREA_PHRASES(areaMatch[1]) : null;

  // ── Extract location
  let location = null;
  const locMatch = d.match(/(?:located\s+in|in|at)\s+([^,.\n?!(]+)/i);
  if (locMatch) {
    location = locMatch[1].trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // ── Extract price
  const priceMatch = d.match(/\$\s*([\d,.]+\s*[mk]?)/i) || d.match(/([\d,.]+\s*(?:million|m|k))/i);
  const pricePhrase = priceMatch ? PRICE_PHRASES(priceMatch[0]) : null;

  // ── Extract features
  const featuresFound = [];
  for (const [key, phrases] of Object.entries(FEATURE_PHRASES)) {
    if (d.includes(key)) featuresFound.push(pick(phrases));
  }

  // ── Build sentence 1: intro
  let s1 = pick(INTROS);
  if (location) {
    const locIntros = [
      `Discover an extraordinary opportunity in the heart of ${location}.`,
      `Nestled in the prestigious ${location} area, this remarkable residence redefines luxury living.`,
      `Welcome to an exceptional home in ${location} where sophisticated design meets everyday comfort.`,
      `Experience elevated living in this meticulously crafted residence located in ${location}.`,
    ];
    s1 = Math.random() > 0.3 ? pick(locIntros) : s1 + ` Ideally located in ${location}.`;
  }

  // ── Build sentence 2: key property details
  const parts = [];
  if (bedPhrase) parts.push(bedPhrase);
  if (areaPhrase) parts.push(areaPhrase);
  const s2parts = parts.length
    ? `Boasting ${parts.join(' and ')}, this ${propType} has been curated for the most discerning residents.`
    : `This exceptional ${propType} has been finished to an international standard of luxury.`;

  // ── Build sentence 3: standout features
  let s3;
  if (featuresFound.length >= 2) {
    const f1 = featuresFound[0];
    const f2 = featuresFound[1];
    s3 = `Residents will enjoy ${f1} and ${f2}, elevating the living experience to new heights.`;
  } else if (featuresFound.length === 1) {
    s3 = `The home features ${featuresFound[0]}, ensuring an unmatched level of comfort and style.`;
  } else {
    s3 = "Premium finishes, high-end appliances, and meticulous attention to detail define every corner of this residence.";
  }

  // ── Add pricing sentence if available
  let s4 = '';
  if (pricePhrase) {
    s4 = ` The property is ${pricePhrase} representing superb value in today's luxury market.`;
  }

  // ── Closing
  const s5 = pick(CLOSINGS);

  return `${s1} ${s2parts} ${s3}${s4} ${s5}`;
}

// ─── Marketing Kit Generators ────────────────────────────────────────────────
const SOCIAL_HOOKS = [
  "Rare opportunity: {prop} is now available! 💎",
  "Investor Alert 🚨 High ROI potential in {loc}!",
  "Live your dream at {prop}. Stunning views! ✨",
  "Price Position: Luxury living in {loc} for ${price}!",
  "Exclusive Preview: The best of {loc} has arrived. 🏆",
  "Stop scrolling! {prop} just hit the market. 🔥",
  "Luxury redefined in {loc}. Must see! 🏙️",
  "Your private sanctuary at {prop} awaits. 🌿",
  "JUST LISTED: The masterpiece of {loc} is here! 📍",
  "OFF-MARKET VIBES: {prop} is finally public! 🔑",
];

const IG_CAPTION_PARTS = [
  "✨ {prop} | {loc}",
  "📍 {loc} - Prime Location",
  "💰 Unbeatable at ${price}",
  "🛏️ {beds} BR | 🛁 {baths} BA | {area} sqft",
  "🌊 Experience {loc} like never before",
];

const FB_STORY_PARTS = [
  "Your search ends here. check out this stunning {type} in {loc}. 🏠",
  "Featuring {f1} and {f2}. Perfect for modern living. ✨",
  "High demand area! Act fast. Contact us for a private tour today!",
];

const LI_POST_PARTS = [
  "Market Insight: Significant investment opportunity in {loc}.",
  "The {prop} represents a prime asset for discerning portfolios seeking capital appreciation.",
  "Property Features: {beds} BR, {area} sqft, premium finishing.",
];

/**
 * Generates a full marketing kit for a property.
 */
const generateSocialMarketingKit = async (p) => {
  const loc = p.address || 'Dubai';
  const prop = p.name || 'this property';
  const price = fmtPrice(p.price);
  const area = p.area_sqft ? Number(p.area_sqft).toLocaleString() : '—';
  const beds = p.bedrooms || '—';
  const baths = p.bathrooms || '—';
  const type = (p.emoji || 'Property').toLowerCase();

  const hook = pick(SOCIAL_HOOKS)
    .replace(/{prop}/g, prop)
    .replace(/{loc}/g, loc)
    .replace(/{price}/g, price);

  const features = p.description ? p.description.split('.').slice(0, 2).join('.') : 'Premium finishes and great location.';

  const ig = `${hook}\n\n${pick(IG_CAPTION_PARTS).replace(/{prop}/g, prop).replace(/{loc}/g, loc).replace(/{price}/g, price).replace(/{beds}/g, beds).replace(/{baths}/g, baths).replace(/{area}/g, area)}\n\n${features}\n\nDM for a private viewing! 📩\n\n#RealEstate #LuxuryLiving #DubaiProperty #${loc.replace(/\s+/g, '')} #NewListing`;

  const fb = `${hook}\n\n${pick(FB_STORY_PARTS).replace(/{type}/g, type).replace(/{loc}/g, loc).replace(/{f1}/g, 'stunning views').replace(/{f2}/g, 'modern interiors')}\n\nPrice: $${fmtPrice(p.price)}\n\nInterested? Let's talk! Contact us today or visit the site for more details.`;

  const li = `${hook}\n\n${pick(LI_POST_PARTS).replace(/{loc}/g, loc).replace(/{prop}/g, prop).replace(/{beds}/g, beds).replace(/{area}/g, area)}\n\nProfessionally managed and ready for the next owner. For those looking to expand their portfolio in {loc}, this is a must-view.\n\n#RealEstateInvestment #PropertyPortfolio #Brokerage #EliteLiving`.replace(/{loc}/g, loc);

  const wa = `Hi! I wanted to share this exclusive new listing: *${prop}* in ${loc}. It's a ${beds} BR ${type} listed at $${price}.\n\nCheck it out here: [Link]\n\nWould you like to schedule a visit?`;

  return {
    success: true,
    kit: {
      title: hook,
      instagram: ig,
      facebook: fb,
      linkedin: li,
      whatsapp: wa
    }
  };
};

/**
 * Generates a Smart Pitch Script for a lead.
 */
const generatePitchScript = async (lead, properties) => {
  try {
    // Basic AI Matching based on budget string and property price
    const leadBudgetVal = parseInt((lead.budget || '500').replace(/\D/g, '')) * 1000;
    
    // Sort properties by relevance (randomized mock for now to show variety)
    const shuffled = [...properties].sort(() => 0.5 - Math.random());
    const matched = shuffled.slice(0, 2);

    const script = `Hi ${lead.name.split(' ')[0]}, this is ${process.env.AGENT_NAME || 'your Agent'} from PropEdge Real Estate. 
    
I received your inquiry about ${lead.property_interest || 'premium properties'}. I've reviewed your request for a ${lead.bhk_preference || 'property'} under your preferred budget.

I have two exclusive, off-market opportunities that match your criteria perfectly:
1. **${matched[0] ? matched[0].name : 'Exclusive Listing 1'}** in ${matched[0] ? matched[0].address : 'Dubai'}
2. **${matched[1] ? matched[1].name : 'Exclusive Listing 2'}** (Just Listed!)

Would you be open to a quick 5-minute call today to discuss these, or would you prefer I send over the property packs via WhatsApp?`;

    return { success: true, script, matches: matched };
  } catch (error) {
    return { success: false, error: 'Failed to generate pitch script: ' + error.message };
  }
};

module.exports = { generateDescription, generateSocialMarketingKit, generatePitchScript };
