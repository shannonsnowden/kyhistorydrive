/**
 * Approvals 112 B1a default homepage lead.
 * Photo: public/content/photos/heroes/hero-big-bone-lick.jpg (same Commons file as the Big Bone Lick layer).
 * Alt on disk, not the default: public/content/photos/heroes/hero-columbus-belmont-mississippi.jpg.
 * Today's brief stays on the rail; this lead is the picture until a later rotation.
 * No lat/lon here: this module is bundled into main.js, and a fine coordinate
 * next to a protected-site id fails check-protected-coords. The map link uses historyId.
 */
export const HERO_DEFAULT = {
  slug: 'big-bone-lick-older-cycle',
  title: 'Big Bone Lick',
  county: 'Boone',
  yearStart: null,
  historyId: 'big-bone-lick',
  heroDeck:
    "Big Bone Lick's salt springs held Ice Age bones. In 1807 William Clark dug there, counted as the first organized vertebrate fossil excavation in the U.S.",
  image: '/content/photos/heroes/hero-big-bone-lick.jpg',
  alt: 'Big Bone Lick State Park, Boone County',
  credit: 'Mattguyver · Wikimedia Commons · CC BY 3.0',
  source_url: 'https://commons.wikimedia.org/wiki/File:Bigbonelick.jpg',
}
