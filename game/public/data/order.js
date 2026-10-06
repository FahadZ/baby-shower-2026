// PUT IT IN ORDER data. Five tiles per round, dragged into the right order.
// `hint` is shown only at the reveal (the age / the price), never during play.
// `correct` is the answer: keys in order from the top (first) to the bottom (last).
// Prices are Canadian sticker prices (CAD, before tax), checked 2026-10-06; the
// research with URLs is in game/research/prices-*.md.
export default {
  rounds: [
    {
      title: "ROUND 1: DIAPER CHANGE SPEEDRUN",
      prompt: "PUT THE STEPS IN ORDER",
      topLabel: "FIRST",
      bottomLabel: "LAST",
      items: [
        { key: "lay", label: "LAY BABY DOWN", emoji: "👶", hint: "STEP 1" },
        { key: "open", label: "OPEN THE DIRTY DIAPER", emoji: "💩", hint: "STEP 2" },
        { key: "wipe", label: "WIPE (FRONT TO BACK)", emoji: "🧻", hint: "STEP 3" },
        { key: "slide", label: "SLIDE THE CLEAN DIAPER UNDER", emoji: "🧷", hint: "STEP 4" },
        { key: "tabs", label: "FASTEN THE TABS", emoji: "✅", hint: "STEP 5" }
      ],
      correct: ["lay", "open", "wipe", "slide", "tabs"]
    },
    {
      title: "ROUND 2: MILESTONES",
      prompt: "FIRST TO LAST, BY TYPICAL AGE",
      topLabel: "FIRST",
      bottomLabel: "LAST",
      items: [
        { key: "smile", label: "FIRST SMILE", emoji: "😊", hint: "ABOUT 6 WEEKS" },
        { key: "rolls", label: "ROLLS OVER", emoji: "🔄", hint: "ABOUT 4 MONTHS" },
        { key: "sits", label: "SITS UP", emoji: "🧘", hint: "ABOUT 6 MONTHS" },
        { key: "crawls", label: "CRAWLS", emoji: "🐛", hint: "ABOUT 9 MONTHS" },
        { key: "walks", label: "WALKS", emoji: "🚶", hint: "ABOUT 12 MONTHS" }
      ],
      correct: ["smile", "rolls", "sits", "crawls", "walks"]
    },
    {
      title: "ROUND 3: CHEAPEST TO PRICIEST",
      prompt: "REAL CANADIAN PRICES. CHEAPEST AT THE TOP.",
      topLabel: "CHEAPEST",
      bottomLabel: "PRICIEST",
      items: [
        { key: "nosefrida", label: "NOSEFRIDA SNOTSUCKER", emoji: "👃", hint: "$22.99" },
        { key: "sophie", label: "SOPHIE LA GIRAFE", emoji: "🦒", hint: "$39.99" },
        { key: "hatch", label: "HATCH REST SOUND MACHINE", emoji: "🌙", hint: "ABOUT $89.99" },
        { key: "bouncer", label: "BABYBJÖRN BOUNCER BLISS", emoji: "🪑", hint: "$349.99" },
        { key: "snoo", label: "SNOO SMART SLEEPER", emoji: "🤖", hint: "$1,894.99" }
      ],
      correct: ["nosefrida", "sophie", "hatch", "bouncer", "snoo"]
    }
  ]
};
