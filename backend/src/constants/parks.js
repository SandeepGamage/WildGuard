/**
 * Parks known to the analytics module. The UC3 data model only stores the
 * park name on each sector, so the outline used for the hotspot map lives
 * here until a Park collection exists (domain class diagram, Fig 6).
 */
const PARKS = Object.freeze([
  Object.freeze({
    id: 'yala',
    name: 'Yala National Park',
    block: 'Block I',
    /** Outline of the monitored area (Yala Block I and its boundary villages). */
    boundary: Object.freeze([
      { latitude: 6.385, longitude: 81.255 },
      { latitude: 6.39, longitude: 81.36 },
      { latitude: 6.37, longitude: 81.425 },
      { latitude: 6.22, longitude: 81.42 },
      { latitude: 6.215, longitude: 81.265 },
    ]),
  }),
]);

const findPark = (id) => PARKS.find((park) => park.id === id) ?? null;

module.exports = { PARKS, findPark };
