// PRICE IS RIGHT data. Every price is a real Canadian sticker price (CAD, before
// tax) read from a live retailer page on the date in `checked`. The full research
// with URLs and alternates is in game/research/prices-*.md.
//
// HOST CHECKLIST: re-check these the week of the party (prices move), and swap any
// item that is on your registry for one of the spares below (edit `rounds`).
export default {
  items: {
    // ---- cheap but surprising -------------------------------------------
    sophie: { name: "SOPHIE LA GIRAFE", detail: "THE FAMOUS RUBBER TEETHER", emoji: "🦒", price: 39.99, retailer: "SNUGGLE BUGZ", checked: "2026-10-06" },
    nosefrida: { name: "NOSEFRIDA SNOTSUCKER", detail: "YES, YOU SUCK THE SNOT OUT", emoji: "👃", price: 22.99, retailer: "SNUGGLE BUGZ", checked: "2026-10-06" },
    diapers: { name: "PAMPERS SWADDLERS SIZE 1", detail: "198-COUNT BOX", emoji: "📦", price: 49.46, perDiaper: 0.25, retailer: "AMAZON.CA", checked: "2026-10-06" },
    formula: { name: "ENFAMIL A+ FORMULA", detail: "992 G REFILL BOX", emoji: "🥛", price: 60.97, retailer: "AMAZON.CA", checked: "2026-10-06" },
    bottles: { name: "DR. BROWN'S NEWBORN SET", detail: "5 ANTI-COLIC BOTTLES", emoji: "🍼", price: 34.99, retailer: "BABY & ME", checked: "2026-10-06" },
    onesies: { name: "CARTER'S BODYSUITS", detail: "5-PACK, NEWBORN, WHITE", emoji: "👕", price: 38.78, retailer: "AMAZON.CA", checked: "2026-10-06" },
    // ---- mid ---------------------------------------------------------------
    pail: { name: "DIAPER GENIE PLATINUM", detail: "THE STINK VAULT (WITH BAGS)", emoji: "🗑️", price: 99.99, retailer: "GOLDTEX", checked: "2026-10-06" },
    owlet: { name: "OWLET DREAM SOCK", detail: "SMART BABY MONITOR SOCK", emoji: "🧦", price: 419.99, retailer: "OWLETCARE.CA", checked: "2026-10-06" },
    nanit: { name: "NANIT PRO CAMERA", detail: "WITH WALL MOUNT", emoji: "📷", price: 429.99, retailer: "SNUGGLE BUGZ", checked: "2026-10-06" },
    bouncer: { name: "BABYBJÖRN BOUNCER BLISS", detail: "THE FAMOUS BOUNCER", emoji: "🪑", price: 349.99, retailer: "SNUGGLE BUGZ", checked: "2026-10-06" },
    carrier: { name: "ERGOBABY OMNI BREEZE", detail: "BABY CARRIER", emoji: "🎒", price: 258.99, retailer: "SNUGGLE BUGZ", checked: "2026-10-06" },
    trippTrapp: { name: "STOKKE TRIPP TRAPP", detail: "THE CHAIR THAT GROWS", emoji: "🪜", price: 354.99, retailer: "WEST COAST KIDS", checked: "2026-10-06" },
    brezza: { name: "BABY BREZZA FORMULA PRO", detail: "THE FORMULA ROBOT", emoji: "☕", price: 248.99, retailer: "SNUGGLE BUGZ", checked: "2026-10-06" },
    activity: { name: "SKIP HOP ACTIVITY CENTER", detail: "3-STAGE EXPLORE & MORE", emoji: "🎡", price: 192.99, retailer: "WEST COAST KIDS", checked: "2026-10-06" },
    mamaroo: { name: "MAMAROO SMART SWING", detail: "BY UPPABABY", emoji: "🪆", price: 449.99, retailer: "SNUGGLE BUGZ", checked: "2026-10-06" },
    keekaroo: { name: "KEEKAROO PEANUT CHANGER", detail: "THE WIPEABLE CHANGE PAD", emoji: "🥜", price: 199.96, retailer: "WELL.CA", checked: "2026-10-06" },
    crib: { name: "IKEA SNIGLAR CRIB", detail: "BEECH, 70×132 CM", emoji: "🛏️", price: 159.0, retailer: "IKEA CANADA", checked: "2026-10-06" },
    // ---- big ticket ----------------------------------------------------------
    snoo: { name: "SNOO SMART SLEEPER", detail: "THE BASSINET THAT ROCKS ITSELF", emoji: "🤖", price: 1894.99, retailer: "WEST COAST KIDS", checked: "2026-10-06" },
    vista: { name: "UPPABABY VISTA V3", detail: "STROLLER ONLY", emoji: "🛒", price: 1299.99, retailer: "SNUGGLE BUGZ", checked: "2026-10-06" },
    fox: { name: "BUGABOO FOX 5", detail: "RENEW COMPLETE STROLLER", emoji: "🦊", price: 1599.0, retailer: "SNUGGLE BUGZ", checked: "2026-10-06" },
    pipa: { name: "NUNA PIPA CAR SEAT", detail: "INFANT SEAT WITH BASE", emoji: "🚗", price: 580.0, retailer: "LITTLE CANADIAN", checked: "2026-10-06" },
    graco: { name: "GRACO 4EVER 4-IN-1", detail: "CONVERTIBLE CAR SEAT", emoji: "🚙", price: 529.99, retailer: "KIDO BEBE", checked: "2026-10-06" }
  },

  // Three rounds: a cheap thing that costs more than people think, a bundle whose
  // total is hard to eyeball, and a big-ticket item with a wide range.
  rounds: [
    { title: "ROUND 1: THE GIRAFFE", subtitle: "HOW MUCH FOR THIS LITTLE GUY?", items: ["sophie"], min: 0, max: 100, step: 1 },
    { title: "ROUND 2: THE NIGHT-SHIFT KIT", subtitle: "GUESS THE TOTAL FOR ALL THREE", items: ["pail", "brezza", "owlet"], min: 100, max: 1500, step: 10 },
    { title: "ROUND 3: THE ROBOT CRIB", subtitle: "THE BASSINET THAT ROCKS ITSELF", items: ["snoo"], min: 0, max: 4000, step: 25, diaperNote: true }
  ],

  // Spares, ready to swap into `rounds`:
  //   { title: "THE SNOT SUCKER", items: ["nosefrida"], min: 0, max: 60, step: 1 }
  //   { title: "A BOX OF DIAPERS", items: ["diapers"], min: 0, max: 120, step: 1 }
  //   { title: "THE CHAIR THAT GROWS", items: ["trippTrapp"], min: 0, max: 800, step: 10 }
  //   { title: "THE FANCY STROLLER", items: ["vista"], min: 0, max: 3000, step: 25 }
  //   { title: "FIRST RIDE HOME", items: ["pipa", "graco"], min: 0, max: 2000, step: 10 }
  //   { title: "THE NURSERY STARTER", items: ["crib", "keekaroo", "nanit"], min: 0, max: 1500, step: 10 }
};
