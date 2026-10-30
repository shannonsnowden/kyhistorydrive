/**
 * Empty-pack fallback photo for the homepage lead (Approvals 112 B1a).
 * Approvals 112 A5: withDefaultHero does not place this in front of a daily pack.
 * Photo: public/content/photos/heroes/hero-big-bone-lick.jpg (same Commons file as the Big Bone Lick layer).
 * Alt on disk, not the default slide: public/content/photos/heroes/hero-columbus-belmont-mississippi.jpg
 * (PHOTO-3: "Wide bend of the Mississippi River seen from the Columbus-Belmont bluffs, Hickman County, Kentucky").
 * It is not the homepage lead. /about/ uses a 1200×630 crop of it as og:image.
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
  alt: 'Grassy Ice Age salt-lick meadow and boardwalk at Big Bone Lick State Historic Site, Boone County, Kentucky',
  credit: 'Mattguyver · Wikimedia Commons · CC BY 3.0',
  source_url: 'https://commons.wikimedia.org/wiki/File:Bigbonelick.jpg',
}
