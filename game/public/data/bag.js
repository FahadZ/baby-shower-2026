// FIT THE DIAPER BAG data. Everything about the look of the game that the hosts
// may want to change lives here: the items (shape, glyph, colour, value), the
// bag silhouettes (masks) and the three rounds. The hosts' own design notes go
// in docs/diaper-bag-design/; swap emoji for pixel icons here when they land.
//
// Shapes are arrays of strings read top to bottom: "#" is a cell, "." is empty.
// Masks are the bag INTERIOR (the packable cells); the outline is drawn around them.
// Round item lists hold instance ids: "pacifier" and "pacifier#2" are two pacifiers.
export default {
  // Instances of these base items must be in the bag or the packer is penalised.
  essentials: ["pacifier", "bottle", "wipes", "diapers"],
  essentialPenalty: 15,

  items: {
    pacifier: { name: "BINKY", emoji: "🍭", color: "#f6a5c0", value: 2, essential: true, shape: ["#"] },
    bottle: { name: "BOTTLE", emoji: "🍼", color: "#9fd3f5", value: 4, essential: true, shape: ["#", "#", "#"] },
    wipes: { name: "WIPES", emoji: "🧻", color: "#b7e3a1", value: 4, essential: true, shape: ["##", "##"] },
    diapers: { name: "DIAPERS", emoji: "🧷", color: "#ffe08a", value: 9, essential: true, shape: ["###", "###", "###"] },
    onesie: { name: "ONESIE", emoji: "👕", color: "#c9b6f0", value: 5, essential: false, shape: ["#.", "#.", "##"] },
    blanket: { name: "BLANKET", emoji: "🧣", color: "#f5c6a0", value: 8, essential: false, shape: ["####", "####"] },
    teddy: { name: "TEDDY", emoji: "🧸", color: "#d9a877", value: 5, essential: false, shape: ["###", ".#."] },
    snack: { name: "SNACK", emoji: "🧃", color: "#ffb37a", value: 3, essential: false, shape: ["#", "#"] },
    sunscreen: { name: "SUNSCREEN", emoji: "🧴", color: "#fff2a8", value: 3, essential: false, shape: ["#", "#"] },
    bib: { name: "BIB", emoji: "🥣", color: "#a8e6e0", value: 2, essential: false, shape: ["##"] },
    toycar: { name: "TOY CAR", emoji: "🚗", color: "#ff9a9a", value: 3, essential: false, shape: ["##"] },
    book: { name: "BOOK", emoji: "📖", color: "#c6d8ff", value: 4, essential: false, shape: ["##", "##"] },
    changepad: { name: "CHANGE PAD", emoji: "🛏️", color: "#b5e8c8", value: 5, essential: false, shape: ["####"] },
    hat: { name: "SUN HAT", emoji: "🧢", color: "#e6c1f2", value: 3, essential: false, shape: ["##", "##"] },
    socks: { name: "SOCKS", emoji: "🧦", color: "#eeeeee", value: 1, essential: false, shape: ["#"] },
    outfit: { name: "OUTFIT", emoji: "👚", color: "#ffd1e8", value: 6, essential: false, shape: ["###", "###"] }
  },

  // The everyday bag: 8 x 10 with the two top corners cut (78 cells).
  masks: {
    everyday: [
      ".######.",
      "########",
      "########",
      "########",
      "########",
      "########",
      "########",
      "########",
      "########",
      "########"
    ],
    // Day trip: a 10 x 12 silhouette with a tapered top, a tapered bottom and a
    // narrow side pocket on the right (84 cells, fewer than the items offered).
    daytrip: [
      "..###.....",
      ".#####....",
      "#######...",
      "#######...",
      "#######...",
      "#######...",
      "#######...",
      "#######.##",
      "#######.##",
      "#######.##",
      "#######.##",
      "..###..##."
    ]
  },

  // Two rounds, both offering more stuff than fits: packing tight is the puzzle.
  rounds: [
    {
      title: "ROUND 1: THE EVERYDAY BAG",
      subtitle: "MORE STUFF THAN FITS. PACK TIGHT, LEAVE THE REST.",
      seconds: 60,
      mask: "everyday",
      // 86 cells of stuff for a 78-cell bag.
      items: ["diapers", "wipes", "bottle", "pacifier", "blanket", "blanket#2", "outfit", "outfit#2", "onesie", "onesie#2", "teddy", "changepad", "changepad#2", "book", "book#2", "snack", "sunscreen", "hat", "bib", "toycar", "socks"]
    },
    {
      title: "ROUND 2: DAY TRIP",
      subtitle: "A BIGGER, WEIRDER BAG. EVEN MORE STUFF. CHOOSE!",
      seconds: 75,
      mask: "daytrip",
      // 109 cells of stuff for an 84-cell bag with a side pocket.
      items: ["diapers", "diapers#2", "wipes", "wipes#2", "bottle", "bottle#2", "pacifier", "pacifier#2", "blanket", "blanket#2", "outfit", "outfit#2", "changepad", "changepad#2", "book", "book#2", "teddy", "teddy#2", "onesie", "onesie#2", "hat", "sunscreen", "sunscreen#2", "snack", "bib", "toycar", "socks"]
    }
  ]
};
