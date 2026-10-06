BABY PHOTOS FOR "MOM OR DAD?" (round 1: WHO IS THIS BABY?)

1. Drop baby photos of Oyshe and Fahad into this folder.
   Name them  mom-1.jpg, mom-2.jpg ... mom-5.jpg  and  dad-1.jpg ... dad-5.jpg
   (any count works, but the round only plays when at least 5 photos are listed).
2. JPG only, 800 px on the longest side at most (phones load them live; keep each
   under ~200 KB). Crop so the baby's face is in the middle: the card is portrait.
3. List every photo in  game/public/data/momordad.js  under photoCards, e.g.
     photoCards: [
       { file: "mom-1.jpg", answer: "mom" },
       { file: "dad-1.jpg", answer: "dad" },
       ...
     ],
   Only the file name goes in the data file; the game adds assets/babyphotos/.
4. Mix in a few that are hard to tell apart. Five random ones are shown per game.

Guests never see the file names, only the picture.
