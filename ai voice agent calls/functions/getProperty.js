// getProperty.js
// ─────────────────────────────────────────────────────────────────────────────
// Live property lookup function.
// Fetches real-time data from the PropEdge backend so that Aria always knows
// about the latest property uploads instantly.
// ─────────────────────────────────────────────────────────────────────────────
require('colors');
const fetch = require('node-fetch');

/**
 * Normalises a string for fuzzy matching (lowercase, trimmed).
 */
const normalise = (str = '') => str.toLowerCase().trim();

/**
 * Checks if a property matches the given filters.
 */
function matchesFilters(property, { location, budget, property_type }) {
  if (location) {
    const loc = normalise(location);
    if (!normalise(property.location).includes(loc) && !normalise(property.name).includes(loc)) {
      return false;
    }
  }

  if (property_type) {
    if (!normalise(property.property_type).includes(normalise(property_type))) {
      return false;
    }
  }

  if (budget) {
    const parsedBudget = parseFloat(String(budget).replace(/[^0-9.]/g, ''));
    const propPrice    = parseFloat(String(property.price).replace(/[^0-9.]/g, ''));
    
    if (!isNaN(parsedBudget) && !isNaN(propPrice)) {
      const lower = parsedBudget * 0.6;
      const upper = parsedBudget * 1.3;
      if (propPrice < lower || propPrice > upper) return false;
    }
  }

  return true;
}

/**
 * getProperty — fetches live data from PropEdge API and filters it.
 */
const getProperty = async function ({ location, budget, property_type } = {}) {
  console.log(`getProperty (LIVE) query → loc: ${location}, budget: ${budget}, type: ${property_type}`.cyan);

  const backendUrl = process.env.PROPEDGE_BACKEND_URL || 'https://real-estate-web-liard-rho.vercel.app';

  try {
    const response = await fetch(`${backendUrl}/api/ai/properties`);
    const data     = await response.json();

    if (!data.success || !data.properties || data.properties.length === 0) {
      return { found: false, message: 'I currently have no active listings matching that description.' };
    }

    const matches = data.properties.filter(p => p.available && matchesFilters(p, { location, budget, property_type }));

    if (matches.length === 0) {
      return {
        found: false,
        message: 'No exact matches found. Let me check with our team for off-market options. In the meantime, what budget range are we looking at?',
        all_properties_count: data.properties.length
      };
    }

    // Return top 2 results
    const results = matches.slice(0, 2).map(p => ({
      name:          p.name,
      location:      p.location,
      price:         p.price,
      property_type: p.property_type,
      features:      p.features || 'Standard amenities',
    }));

    return {
      found: true,
      count: results.length,
      properties: results,
    };

  } catch (err) {
    console.error('getProperty (LIVE) error:'.red, err.message);
    return { found: false, message: 'My database is updating right now. I will have the agent confirm those details with you.' };
  }
};

module.exports = getProperty;
