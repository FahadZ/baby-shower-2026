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
  // Everything else in the scene. None of these may equal a target glyph.
  distractors: [
    "🧸", "🪀", "🎈", "🎁", "🪁", "🧩", "🪆", "🎲", "🍎", "🍌", "🍇", "🥕", "🧁", "🍪",
    "🐣", "🐥", "🐤", "🦋", "🐞", "🐟", "🌼", "🌸", "🍄", "⭐", "🌙", "☁️", "🧢", "👟",
    "🎀", "🧵", "🪄", "🎺", "🥁", "🧃", "🥛", "🍭", "🪥", "🧴", "🧼", "🪣", "🧹", "🛼",
    "🛷", "🐢", "🐸", "🐰", "🐻", "🐼", "🦊", "🐱", "🐶", "🐭", "🐹", "🍓", "🍊", "🍋",
    "🍉", "🍒", "🥑", "🌽", "🎂", "🍩", "🍬", "🎵", "🎶", "💡", "📚", "✏️", "🧊", "🧶",
    "🎨", "🖍️", "🚂", "🚗", "🚲", "🛹", "⚽", "🏀", "🎾", "🎯", "🎪", "🎠", "🪅"
  ],
  // Plain coloured pixel shapes mixed in for variety (they take the glyph colour).
  shapes: ["■", "●", "▲", "◆", "★", "♥"],
  shapeColors: ["#e0283a", "#8cc523", "#5aa7e8", "#ffd84a", "#c26ad6", "#ff8c42", "#2bb3a0"],
  rounds: [
    { title: "ROUND 1: NURSERY", subtitle: "FIVE THINGS WENT MISSING IN THE TOY PILE", density: 220, mode: "normal", after: 0.35, overlappers: 1, cover: 2 },
    { title: "ROUND 2: DIAPER BAG EXPLOSION", subtitle: "SAME FIVE, WAY MORE STUFF", density: 380, mode: "normal", after: 0.5, overlappers: 2, cover: 3 },
    { title: "ROUND 3: NIGHT FEED", subtitle: "LIGHTS OFF. FEEL AROUND.", density: 220, mode: "night", after: 0.35, overlappers: 1, cover: 2 }
  ],
  // Virtual canvas size and gameplay constants (units, not pixels).
  w: 1000,
  h: 1400,
  sizeMin: 28,
  sizeMax: 60,
  targetSizeMin: 38,
  targetSizeMax: 50,
  targetGap: 230,
  hitRadius: 60,
  flashlight: 140
};
