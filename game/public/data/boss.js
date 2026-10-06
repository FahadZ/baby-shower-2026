// BOSS BATTLE data: baby trivia with surprising answers, plus the boss itself.
// Three questions are picked per game (seeded, so every phone agrees). Edit
// freely: `answer` is the index into `options`, `fact` shows on the reveal.
export default {
  boss: { name: "KING BINKY", hpPerPlayer: 2400 },

  questions: [
    {
      q: "HOW MANY BONES IS A NEWBORN BORN WITH?",
      options: ["ABOUT 100", "ABOUT 206", "ABOUT 300", "ABOUT 500"],
      answer: 2,
      fact: "AROUND 300! LOTS OF THEM FUSE TOGETHER AS THE BABY GROWS, DOWN TO THE 206 YOU'VE GOT NOW."
    },
    {
      q: "ON DAY ONE, A NEWBORN'S STOMACH IS ABOUT THE SIZE OF A...",
      options: ["TENNIS BALL", "EGG", "GRAPEFRUIT", "CHERRY"],
      answer: 3,
      fact: "A CHERRY! IT HOLDS ABOUT A TEASPOON. BY DAY TEN IT'S ALREADY UP TO EGG SIZE."
    },
    {
      q: "WHEN DO BABIES START CRYING ACTUAL TEARS?",
      options: ["THE MOMENT THEY'RE BORN", "AROUND 3-4 WEEKS", "AROUND 6 MONTHS", "AROUND AGE 1"],
      answer: 1,
      fact: "NEWBORNS WAIL WITHOUT TEARS. THE TEAR DUCTS USUALLY GET GOING AT ABOUT 3 TO 4 WEEKS OLD."
    },
    {
      q: "HOW MANY DIAPERS DOES THE AVERAGE BABY GO THROUGH IN YEAR ONE?",
      options: ["ABOUT 800", "ABOUT 1,500", "ABOUT 2,500-3,000", "ABOUT 6,000"],
      answer: 2,
      fact: "ROUGHLY 2,500 TO 3,000. THAT'S 7 OR 8 A DAY. STOCK UP, PLAYER 1 AND PLAYER 2."
    },
    {
      q: "WHICH OF THESE ISN'T BONE YET WHEN A BABY IS BORN?",
      options: ["THE SKULL", "THE RIBS", "THE JAW", "THE KNEECAPS"],
      answer: 3,
      fact: "KNEECAPS! A NEWBORN'S ARE SOFT CARTILAGE. THEY ONLY HARDEN INTO BONE SOMEWHERE BETWEEN AGE 2 AND 6."
    },
    {
      q: "HOW SOON CAN A NEWBORN RECOGNISE MOM'S VOICE?",
      options: ["RIGHT AT BIRTH", "AFTER ABOUT A WEEK", "AFTER ABOUT A MONTH", "AROUND 6 MONTHS"],
      answer: 0,
      fact: "RIGHT AWAY! BABIES HEAR MOM FROM INSIDE THE WOMB AND PREFER HER VOICE FROM DAY ONE."
    },
    {
      q: "HOW OFTEN DOES A BABY BLINK?",
      options: ["ABOUT 20 TIMES A MINUTE", "ABOUT 2 TIMES A MINUTE", "ABOUT 10 TIMES A MINUTE", "ABOUT 60 TIMES A MINUTE"],
      answer: 1,
      fact: "ONLY A COUPLE OF TIMES A MINUTE. GROWN-UPS BLINK 15 TO 20 TIMES. THAT'S WHY THE STARING CONTEST IS UNWINNABLE."
    },
    {
      q: "WHAT IS THE MOST-VIEWED VIDEO ON YOUTUBE?",
      options: ["BABY SHARK DANCE", "DESPACITO", "GANGNAM STYLE", "A MINECRAFT SPEEDRUN"],
      answer: 0,
      fact: "BABY SHARK DANCE. DOO DOO DOO DOO DOO DOO. OVER 15 BILLION VIEWS AND COUNTING. YOU'RE WELCOME."
    },
    {
      q: "HOW MANY HOURS A DAY DOES A NEWBORN SLEEP?",
      options: ["ABOUT 8", "ABOUT 16-17", "ABOUT 12", "ABOUT 22"],
      answer: 1,
      fact: "16 TO 17 HOURS. JUST NEVER MORE THAN A FEW IN A ROW. 'SLEEP WHEN THE BABY SLEEPS', THEY SAY."
    },
    {
      q: "WHAT IS THE MOST COMMON BIRTHDAY MONTH IN CANADA AND THE US?",
      options: ["JANUARY", "MAY", "DECEMBER", "SEPTEMBER"],
      answer: 3,
      fact: "SEPTEMBER. COUNT BACK NINE MONTHS AND YOU LAND ON THE HOLIDAYS. NO FURTHER QUESTIONS."
    }
  ]
};
