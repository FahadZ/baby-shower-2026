// DIAPER DASH data. Round titles, spawn rates, fall speeds and the pixel
// sprites. Edit freely: rate is spawns per second per lane, speed multiplies
// baseSpeed (canvas heights per second), badShare / goldShare are odds per item.
export default {
  duration: 20000,
  baseSpeed: 0.27,        // fraction of the canvas height per second at speed 1
  maxLive: 12,            // cap of items on screen at once
  itemSize: 44,           // CSS px
  hitRadius: 34,          // CSS px from an item's centre
  points: { good: 1, gold: 3, bad: -1 },
  rounds: [
    { title: "ROUND 1: WARM-UP", subtitle: "TAP THE PACIFIERS. SKIP THE DIAPERS.", rate: 1.3, speed: 1.0, goldShare: 0, badShare: 0.28, twins: false },
    { title: "ROUND 2: RUSH HOUR", subtitle: "FASTER. GOLD BOTTLES ARE WORTH 3.", rate: 2.0, speed: 1.35, goldShare: 0.14, badShare: 0.3, twins: false },
    { title: "ROUND 3: TWINS", subtitle: "TWO LANES. TWO HANDS. GOOD LUCK.", rate: 1.5, speed: 1.6, goldShare: 0.14, badShare: 0.32, twins: true }
  ],
  // Text glyphs for places where a sprite cannot be drawn.
  glyphs: { good: "🍼", gold: "✨", bad: "💩" },
  names: { good: "PACIFIER", gold: "GOLD BOTTLE", bad: "DIRTY DIAPER" },
  // 11x11 pixel sprites, scaled x4 = 44 px. "." is transparent.
  palette: {
    K: "#1d1b18", R: "#e0283a", S: "#5aa7e8", D: "#3c7ec0", B: "#f2c9a0",
    T: "#f2c9a0", C: "#c99a12", G: "#ffd84a", L: "#fff2a8", M: "#c99a12",
    P: "#8a5a2b", Q: "#5a3410", W: "#ffffff", E: "#1d1b18"
  },
  sprites: {
    good: [
      "...KKKKK...",
      "..KRRRRRK..",
      "..KR...RK..",
      "..KRRRRRK..",
      ".KSSSSSSSK.",
      "KSSSSSSSSSK",
      "KSSSDSDSSSK",
      ".KSSSSSSSK.",
      "..KKBBBKK..",
      "...KBBBK...",
      "....KKK...."
    ],
    gold: [
      "....KKK....",
      "...KTTTK...",
      "...KTTTK...",
      "..KCCCCCK..",
      ".KGGGGGGGK.",
      ".KGLGGMGGK.",
      ".KGLGGGGGK.",
      ".KGLGGMGGK.",
      ".KGLGGGGGK.",
      ".KGGGGGGGK.",
      "..KKKKKKK.."
    ],
    bad: [
      ".....KK....",
      "....KPPK...",
      "...KPPPPK..",
      "..KPPPPPPK.",
      ".KPPPPPPPPK",
      ".KPWWPPWWPK",
      ".KPWEPPWEPK",
      "KPPPPPPPPPK",
      "KPPQKKKQPPK",
      "KPPPPPPPPPK",
      ".KKKKKKKKK."
    ]
  }
};
