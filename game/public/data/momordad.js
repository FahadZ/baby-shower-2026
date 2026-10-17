// MOM OR DAD? data. Guests swipe each card left (MOM) or right (DAD).
// HOSTS: every card needs an `answer` of "mom" or "dad". The cards play in the
// order listed, up to 7 to a round: a longer list is split into near-equal
// rounds (14 facts = two rounds of 7), and each round's timer is 6 seconds a card.
// A list with fewer than 5 answered cards plays 5 of them with random DEMO
// answers instead (the host remote shows a reminder), so rehearsals still run.
//
//   photoCards : baby photos of the two of you. Drop JPGs in assets/babyphotos/
//                (see the README.txt there) and list them here. The photo round
//                only plays when at least 5 photos are listed.
//   factCards  : "WHO WAS THIS KID?" true stories from your own childhoods.
//   futureCards: "WHO WILL...?" predictions. There is no right answer; whichever
//                of you is "guilty" picks the answer.
export default {
  parents: {
    mom: { name: "OYSHE", avatar: { c: "peach", p: "p1" } },
    dad: { name: "FAHAD", avatar: { c: "mario", p: "p1" } }
  },

  // Example: { file: "mom-1.jpg", answer: "mom" }, { file: "dad-1.jpg", answer: "dad" }
  photoCards: [],

  // Round 1: the first seven cards, in this order.
  factCards: [
    { text: "WAS A VERY CAREFUL TODDLER", answer: "mom" },
    { text: "ENDED UP IN HOSPITAL BECAUSE OF A HOUSEPLANT", answer: "dad" },
    { text: "WAS BORN WITH A FULL HEAD OF HAIR", answer: "dad" },
    { text: "LEARNED TO RIDE A BIKE FIRST", answer: "mom" },
    { text: "THREW THINGS OUT THE WINDOW", answer: "mom" },
    { text: "BANGED THEIR HEAD ON THE WALL DURING TANTRUMS", answer: "dad" },
    { text: "GOT BETTER GRADES IN SCHOOL", answer: "mom" },
    // Round 2: the last seven.
    { text: "DRANK SODA FROM A BABY BOTTLE", answer: "dad" },
    { text: "SAW A GHOST AT AGE 2", answer: "mom" },
    { text: "THREW A BABY BOTTLE THAT TURNED THE TV BLACK AND WHITE", answer: "dad" },
    { text: "WAS THE NAUGHTIER TODDLER", answer: "dad" },
    { text: "HAS WORN GLASSES SINCE GRADE 2", answer: "mom" },
    { text: "WAS THE PICKIER EATER AS A KID", answer: "mom" },
    { text: "LEARNED TO SWIM FIRST", answer: "dad" }
  ],

  // Round 3: six cards, in this order.
  futureCards: [
    { text: "WHO WILL PANIC AT THE FIRST FEVER?", answer: "mom" },
    { text: "WHO WILL BUY THE FIRST VIDEO GAME CONSOLE?", answer: "dad" },
    { text: "WHO WILL WAKE UP FIRST WHEN THE BABY CRIES?", answer: "mom" },
    { text: "WHO WILL BE MORE COMPETITIVE IN GAMES WITH THE BABY?", answer: "dad" },
    { text: "WHO WILL TEACH THE FIRST SWEAR WORD?", answer: "dad" },
    { text: "WHO WILL BE MORE PROTECTIVE OF THE BABY?", answer: "mom" }
  ]
};
