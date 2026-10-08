// WHERE'S THE BINKY? data. Edit freely: the five targets (what the phones hunt
// for), the distractor emoji that fill the scene, and each round's density.
// Keep every emoji as a plain string: both the server and the phones import this.
export default {
  // The hidden baby items. `ch` is drawn on the canvas, `name` shows on the chips.
  // The safety pin stands in for the binky; the bell stands in for the rattle.
  targets: [
    { key: "bottle", ch: "🍼", name: "BOTTLE" },
    { key: "binky", ch: "🧷", name: "BINKY" },
    { key: "sock", ch: "🧦", name: "SOCK" },
    { key: "duck", ch: "🦆", name: "DUCK" },
    { key: "rattle", ch: "🔔", name: "RATTLE" }
  ],
  // Everything else in the scene. None of these may equal a target glyph, and none
  // should look like one (no other bottles, pins, socks, yellow birds or bells).
  // Only emoji from 2018 or earlier so older phones never show empty boxes.
  distractors: [
    "🧸", "🎈", "🎁", "🧩", "🎲", "🍎", "🍌", "🍇", "🥕", "🧁", "🍪", "🦋", "🐞", "🐟",
    "🌼", "🌸", "🍄", "⭐", "🌙", "🧢", "👟", "🎀", "🎺", "🥁", "🍭", "🧼", "🐢", "🐸",
    "🐰", "🐻", "🐼", "🦊", "🐱", "🐶", "🐭", "🐹", "🍓", "🍊", "🍋", "🍉", "🍒", "🥑",
    "🌽", "🎂", "🍩", "🍬", "🎵", "💡", "📚", "✏️", "🧊", "🧶", "🎨", "🚂", "🚗", "🚲",
    "⚽", "🏀", "🎾", "🎯", "🎪", "🎠", "🐙", "🦀", "🐬", "🍕", "🥨", "🥐", "🍿", "🎃",
    "🧲", "🔑", "⏰", "📷", "🎧", "🎮", "🧭", "🛸", "🚀", "🌈", "🔥", "💎", "👑"
  ],
  // Plain coloured shapes are off: they read as "rectangles" on a phone.
  shapes: [],
  shapeColors: ["#e0283a", "#8cc523", "#5aa7e8", "#ffd84a", "#c26ad6", "#ff8c42", "#2bb3a0"],
  rounds: [
    { title: "ROUND 1: NURSERY", subtitle: "FIVE THINGS WENT MISSING IN THE TOY PILE", density: 95, mode: "normal", after: 0.3, overlappers: 1, cover: 1 },
    // Round 2's pile is a taller map (h) that the phone drags up and down to search.
    { title: "ROUND 2: DIAPER BAG EXPLOSION", subtitle: "A BIGGER PILE. DRAG TO LOOK AROUND.", density: 230, h: 2600, mode: "normal", after: 0.4, overlappers: 1, cover: 2 },
    { title: "ROUND 3: NIGHT FEED", subtitle: "LIGHTS OFF. FEEL AROUND.", density: 95, mode: "night", after: 0.3, overlappers: 1, cover: 1 }
  ],
  // Virtual canvas size and gameplay constants (units, not pixels).
  w: 1000,
  h: 1400,
  sizeMin: 62,
  sizeMax: 100,
  targetSizeMin: 72,
  targetSizeMax: 86,
  targetGap: 300,
  hitRadius: 85,
  // Flashlight radius in units; on the phone the light floats this far above the finger.
  flashlight: 270,
  lightOffset: 190
};
