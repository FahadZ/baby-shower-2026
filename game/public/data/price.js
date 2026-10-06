// PRICE IS RIGHT data. PROVISIONAL: these placeholder prices are replaced with
// researched Canadian prices (retailer, URL and date) before the party.
// Edit freely: name/detail show on phones, price is the answer in CAD.
export default {
  items: {
    sophie: { name: "SOPHIE LA GIRAFE", detail: "THE FAMOUS RUBBER TEETHER", emoji: "🦒", price: 39.99, retailer: "PROVISIONAL", checked: "" },
    hatch: { name: "HATCH REST (2ND GEN)", detail: "SOUND MACHINE + NIGHT LIGHT", emoji: "🌙", price: 89.99, retailer: "PROVISIONAL", checked: "" },
    pail: { name: "DIAPER GENIE COMPLETE", detail: "THE STINK VAULT", emoji: "🗑️", price: 59.99, retailer: "PROVISIONAL", checked: "" },
    bottles: { name: "DR. BROWN'S GIFT SET", detail: "ANTI-COLIC BOTTLES", emoji: "🍼", price: 49.99, retailer: "PROVISIONAL", checked: "" },
    snoo: { name: "SNOO SMART SLEEPER", detail: "THE ROBOT BASSINET", emoji: "🤖", price: 2295, retailer: "PROVISIONAL", checked: "" },
    diapers: { name: "PAMPERS SWADDLERS SIZE 1", detail: "198-COUNT BOX", emoji: "📦", price: 49.97, perDiaper: 0.25, retailer: "PROVISIONAL", checked: "" }
  },
  rounds: [
    { title: "ROUND 1: THE GIRAFFE", subtitle: "HOW MUCH FOR THIS LITTLE GUY?", items: ["sophie"], min: 0, max: 100, step: 1 },
    { title: "ROUND 2: THE STARTER BUNDLE", subtitle: "GUESS THE TOTAL FOR ALL THREE", items: ["hatch", "pail", "bottles"], min: 0, max: 600, step: 5 },
    { title: "ROUND 3: THE BIG ONE", subtitle: "THE BASSINET THAT ROCKS ITSELF", items: ["snoo"], min: 0, max: 4000, step: 25, diaperNote: true }
  ]
};
