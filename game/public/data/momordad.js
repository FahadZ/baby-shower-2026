// MOM OR DAD? data. Guests swipe each card left (MOM) or right (DAD).
// HOSTS: fill in every `answer` with "mom" or "dad". Cards with a blank answer
// are skipped; when a round has fewer than 5 answered cards the game fills it
// with random DEMO answers (and says so on the reveal) so rehearsals still run.
//
//   photoCards : baby photos of the two of you. Drop JPGs in assets/babyphotos/
//                (see the README.txt there) and list them here. The photo round
//                only plays when at least 5 photos are listed.
//   factCards  : "WHO WAS THIS BABY?" true stories from your own childhoods.
//   futureCards: "WHO WILL...?" predictions. There is no right answer; whichever
//                of you is "guilty" picks the answer.
export default {
  parents: {
    mom: { name: "OYSHE", avatar: { c: "peach", p: "p1" } },
    dad: { name: "FAHAD", avatar: { c: "mario", p: "p1" } }
  },

  // Example: { file: "mom-1.jpg", answer: "mom" }, { file: "dad-1.jpg", answer: "dad" }
  photoCards: [],

  factCards: [
    { text: "CRIED EVERY NIGHT UNTIL AGE TWO", answer: "" },
    { text: "WALKED AT 9 MONTHS", answer: "" },
    { text: "FIRST WORD WAS 'NO'", answer: "" },
    { text: "ATE SAND AT THE BEACH", answer: "" },
    { text: "HAD A FULL HEAD OF HAIR AT BIRTH", answer: "" },
    { text: "SLEPT THROUGH THE NIGHT FROM WEEK SIX", answer: "" },
    { text: "WAS BORN TWO WEEKS LATE", answer: "" },
    { text: "BIT A COUSIN AT DAYCARE", answer: "" },
    { text: "LOVED BATHS", answer: "" },
    { text: "HATED THE CAR SEAT", answer: "" },
    { text: "WAS THE CHUBBIER BABY", answer: "" },
    { text: "HAD COLIC", answer: "" },
    { text: "WAS A THUMB SUCKER", answer: "" },
    { text: "REFUSED ALL VEGETABLES", answer: "" },
    { text: "ESCAPED THE CRIB", answer: "" }
  ],

  futureCards: [
    { text: "WHO WILL BE THE SOFTIE?", answer: "" },
    { text: "WHO WILL DO THE 3 AM FEED?", answer: "" },
    { text: "WHO WILL CRY FIRST AT DAYCARE DROP-OFF?", answer: "" },
    { text: "WHO WILL BUY THE FIRST VIDEO GAME CONSOLE?", answer: "" },
    { text: "WHO WILL TEACH THE FIRST SWEAR WORD?", answer: "" },
    { text: "WHO WILL TAKE MORE PHOTOS?", answer: "" },
    { text: "WHO WILL BE THE FUN ONE?", answer: "" },
    { text: "WHO WILL PANIC AT THE FIRST FEVER?", answer: "" },
    { text: "WHO WILL WIN MOST STARING CONTESTS?", answer: "" },
    { text: "WHO WILL SNEAK THE BABY SWEETS?", answer: "" },
    { text: "WHO WILL FALL ASLEEP DURING BEDTIME STORIES?", answer: "" },
    { text: "WHO WILL MAKE THE BABY'S FIRST COSPLAY?", answer: "" },
    { text: "WHO WILL LOSE THE PACIFIER MOST?", answer: "" },
    { text: "WHO WILL BE STRICTER ABOUT SCREEN TIME?", answer: "" },
    { text: "WHO WILL CHANGE MORE DIAPERS?", answer: "" }
  ]
};
