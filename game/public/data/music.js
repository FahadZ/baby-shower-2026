// TV SOUNDTRACK. Every game has its own tune (8-bit arrangements of public-domain
// classics), the how-to screen plays a quiet beat-only version of it, gameplay plays
// it in full (a little faster in the last 10 seconds), and the lobby, reveals and
// results play music generated on the fly so it never loops the same way twice.
// The format is in engine/notes.js. Edit freely; `npm test` checks every bar adds up.
//
// Song fields: bpm, beats (per bar), div (steps per beat), lead (pulse25 | pulse12 |
// pulse50 | tri), bass (oct8 | root8 | walk | oompah | rootfifth | pulse16 | long),
// arp (up | updown | stab | none), drums (rock | four | gallop | waltz | rag | battle |
// soft | tick | none), intro (sections played once), loop (sections repeated),
// accel (tempo gain per bar, for Diaper Dash), continuous (never restarts mid-game).
// Sections may override bass / arp / drums.

export const SONGS = {
  // PRICE IS RIGHT: Scott Joplin, The Entertainer (1902). Ragtime game-show strut.
  entertainer: {
    bpm: 92, beats: 2, div: 4, lead: "pulse25", bass: "oompah", arp: "stab", drums: "rag",
    loop: [{
      mel: "E5 C6 . E5 C6 . E5 C6 | . . . . . . C6 D6 | D#6 E6 C6 D6 E6 . B5 D6 | . C6 . . . . D5 D#5 |" +
           "E5 C6 . E5 C6 . E5 C6 | . . . . . . A5 G5 | F#5 A5 C6 E6 . D6 C6 A5 | D6 . . . . . D5 D#5",
      chords: "C C G7 C C C/F D7 G7"
    }]
  },

  // WHERE'S THE BINKY (rounds 1-2): Pop Goes the Weasel. Hide and seek in 6/8.
  weasel: {
    bpm: 112, beats: 2, div: 3, lead: "pulse25", bass: "rootfifth", arp: "up", drums: "gallop",
    loop: [{
      mel: "C5 . C5 D5 . D5 | E5 G5 E5 C5 . . | C5 . C5 D5 . D5 | E5 . . C5 . . |" +
           "C5 . C5 D5 . D5 | E5 G5 E5 C5 . . | A5 . . D5 . F5 | E5 . . C5 . .",
      chords: "C C G7 C C C F/G7 C"
    }]
  },

  // WHERE'S THE BINKY round 3, NIGHT FEED: Brahms' Lullaby on a music box.
  lullaby: {
    bpm: 80, beats: 3, div: 2, lead: "tri", bass: "long", arp: "updown", drums: "none",
    loop: [{
      mel: "E5 E5 G5 . . . | E5 E5 G5 . . . | E5 G5 C6 . B5 . | A5 . A5 . G5 . |" +
           "D5 E5 F5 . D5 . | D5 E5 F5 . . . | D5 F5 B5 A5 G5 B5 | C6 . . . . .",
      chords: "C C C F/C G G7 G7 C"
    }]
  },

  // MOM OR DAD?: Twinkle Twinkle Little Star, bouncy.
  twinkle: {
    bpm: 138, beats: 4, div: 2, lead: "pulse25", bass: "oct8", arp: "up", drums: "rock",
    loop: [{
      mel: "C5 . C5 . G5 . G5 . | A5 . A5 . G5 . . . | F5 . F5 . E5 . E5 . | D5 . D5 . C5 . . . |" +
           "G5 . G5 . F5 . F5 . | E5 . E5 . D5 . . . | G5 . G5 . F5 . F5 . | E5 . E5 . D5 . . . |" +
           "C5 . C5 . G5 . G5 . | A5 . A5 . G5 . . . | F5 . F5 . E5 . E5 . | D5 . D5 . C5 . . .",
      chords: "C F/C F/C G/C C/F C/G C/F C/G C F/C F/C G/C"
    }]
  },

  // DIAPER DASH: Grieg, In the Hall of the Mountain King. Starts slow, speeds up every bar.
  mountain: {
    bpm: 104, beats: 4, div: 2, lead: "pulse25", bass: "root8", arp: "none", drums: "four",
    accel: { perBar: 0.035, max: 2 },
    loop: [{
      mel: "A4 B4 C5 D5 E5 C5 E5 . | D#5 B4 D#5 . D5 Bb4 D5 . | A4 B4 C5 D5 E5 C5 E5 A5 | G5 E5 C5 E5 G5 . . . |" +
           "E5 F#5 G5 A5 B5 G5 B5 . | A#5 F#5 A#5 . A5 F5 A5 . | E5 F#5 G5 A5 B5 G5 B5 E6 | D6 B5 G5 B5 D6 . . .",
      chords: "Am B/Bb Am C Em F#/F Em G"
    }]
  },

  // PUT IT IN ORDER: Mozart, Eine kleine Nachtmusik, then scales running up in order.
  nacht: {
    bpm: 126, beats: 4, div: 2, lead: "pulse25", bass: "walk", arp: "up", drums: "rock",
    loop: [{
      mel: "G5 . D5 G5 . D5 G5 D5 | G5 B5 D6 . . . - - | C6 . A5 C6 . A5 C6 A5 | F#5 A5 D5 . . . - -",
      chords: "G G D7 D"
    }, {
      mel: "G4 A4 B4 C5 D5 E5 F#5 G5 | F#5 . D5 . A4 . D5 . | E5 D5 C5 B4 A4 G4 F#4 E4 | D4 . F#4 . A4 . D5 . |" +
           "G4 A4 B4 C5 D5 E5 F#5 G5 | A5 . F#5 . D5 . A4 . | G5 F#5 E5 D5 C5 B4 A4 F#4 | G4 . . . - - - -",
      chords: "G D C/D D G D C/D G"
    }]
  },

  // FIT THE DIAPER BAG: Korobeiniki (the Tetris tune). Packing puzzle, obviously.
  korobeiniki: {
    bpm: 144, beats: 4, div: 2, lead: "pulse25", bass: "oct8", arp: "none", drums: "rock",
    loop: [{
      mel: "E5 . B4 C5 D5 . C5 B4 | A4 . A4 C5 E5 . D5 C5 | B4 . . C5 D5 . E5 . | C5 . A4 . A4 . - - |" +
           "- D5 . F5 A5 . G5 F5 | E5 . . C5 E5 . D5 C5 | B4 . B4 C5 D5 . E5 . | C5 . A4 . A4 . - -",
      chords: "E Am E Am Dm C E Am"
    }, {
      mel: "E5 . . . C5 . . . | D5 . . . B4 . . . | C5 . . . A4 . . . | G#4 . . . B4 . . . |" +
           "E5 . . . C5 . . . | D5 . . . B4 . . . | C5 . E5 . A5 . . . | G#5 . . . - - - -",
      chords: "Am E Am E Am E Am E", arp: "up"
    }]
  },

  // BOSS BATTLE: Bach's Toccata in D minor as the entrance, then a battle loop.
  // Plays straight through the whole boss game (no restarts between questions).
  toccata: {
    bpm: 150, beats: 4, div: 4, lead: "pulse25", bass: "pulse16", arp: "up", drums: "battle", continuous: true,
    intro: [{
      mel: "A5 G5 A5 . . . . . . . . . . . - - | - - - - G5 F5 E5 D5 C#5 . . . . . . . | D5 . . . . . . . . . . . - - - - |" +
           "A4 G4 A4 . . . . . . . . . . . - - | - - - - G4 F4 E4 D4 C#4 . . . . . . . | D4 . . . . . . . . . . . . . . .",
      chords: "A A Dm A A Dm", bass: "long", arp: "none", drums: "none"
    }],
    loop: [{
      mel: "D5 . A4 . D5 . E5 . F5 . E5 . D5 . A4 . | Bb4 . . . A4 . . . G4 . . . A4 . . . |" +
           "D5 . A4 . D5 . E5 . F5 . G5 . A5 . F5 . | G5 . . . F5 . . . E5 . . . C#5 . . . |" +
           "A5 . . . G5 . F5 . E5 . . . F5 . G5 . | F5 . . . E5 . D5 . C#5 . . . D5 . E5 . |" +
           "D5 . . . . . F5 . A5 . . . D6 . . . | C#6 . . . A5 . . . E5 . . . C#5 . . .",
      chords: "Dm Bb/A Dm Gm/A Dm Bb/A Dm A"
    }, {
      // Breakdown: drums, bass and arpeggios only.
      mel: "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
      chords: "Dm Bb Gm A"
    }]
  },

  // FINAL RANKINGS: Beethoven, Ode to Joy, full fanfare.
  ode: {
    bpm: 132, beats: 4, div: 2, lead: "pulse25", bass: "oct8", arp: "up", drums: "four",
    loop: [{
      mel: "E5 . E5 . F5 . G5 . | G5 . F5 . E5 . D5 . | C5 . C5 . D5 . E5 . | E5 . . D5 D5 . . . |" +
           "E5 . E5 . F5 . G5 . | G5 . F5 . E5 . D5 . | C5 . C5 . D5 . E5 . | D5 . . C5 C5 . . . |" +
           "D5 . D5 . E5 . C5 . | D5 . E5 F5 E5 . C5 . | D5 . E5 F5 E5 . D5 . | C5 . D5 . G4 . . . |" +
           "E5 . E5 . F5 . G5 . | G5 . F5 . E5 . D5 . | C5 . C5 . D5 . E5 . | D5 . . C5 C5 . . .",
      chords: "C G C G C G C G/C G/C G/C G/C G C G C G/C"
    }]
  },

  // Generated on the fly: a progression is picked every four bars and the melody is
  // improvised from the scale, so these never repeat exactly.
  lobby: {
    gen: true, bpm: 98, beats: 4, div: 2, lead: "pulse12", bass: "walk", arp: "updown", drums: "soft",
    progs: [["Cmaj7", "Am7", "Dm7", "G7"], ["Fmaj7", "G6", "Em7", "Am7"], ["Dm7", "G7", "Cmaj7", "A7"], ["Fmaj7", "Fm7", "Cmaj7", "G7"]],
    scale: ["C", "D", "E", "G", "A"], density: 0.45, range: [67, 84]
  },
  suspense: {
    gen: true, bpm: 112, beats: 4, div: 2, lead: "tri", bass: "root8", arp: "none", drums: "tick", volume: 0.7,
    progs: [["Am", "Am", "F", "E"], ["Dm", "Am", "Bb", "E"], ["Am", "F", "Dm", "E7"]],
    scale: ["A", "B", "C", "E", "F"], density: 0.18, range: [69, 81]
  },
  victory: {
    gen: true, bpm: 140, beats: 4, div: 2, lead: "pulse25", bass: "oct8", arp: "up", drums: "four",
    progs: [["C", "G", "Am", "F"], ["F", "G", "C", "C"], ["Am", "F", "C", "G"], ["F", "G", "Em", "Am"]],
    scale: ["C", "D", "E", "G", "A"], density: 0.55, range: [67, 86]
  },

  // CREDITS: the original theme, as a send-off.
  credits: { file: "assets/audio/theme.wav" }
};

export const GAME_SONGS = { price: "entertainer", binky: "weasel", momordad: "twinkle", dash: "mountain", order: "nacht", bag: "korobeiniki", boss: "toccata" };

function gameSong(snap) {
  const id = snap.game && snap.game.id;
  if (id === "binky" && snap.content && snap.content.mode === "night") return "lullaby";
  return GAME_SONGS[id] || "victory";
}

// What the TV should be playing for a state snapshot: { song, mode, key }. mode
// "groove" mutes the tune (how-to screens); a new key restarts the song unless it
// is `continuous` (the boss). null: silence.
export function trackFor(snap) {
  if (!snap) return null;
  const g = snap.gameIndex;
  const boss = snap.game && snap.game.id === "boss";
  switch (snap.phase) {
    case "lobby": return { song: "lobby", mode: "full", key: "lobby" };
    case "intro": return { song: gameSong(snap), mode: "full", key: "g" + g };
    case "howto": return { song: gameSong(snap), mode: "groove", key: "g" + g };
    case "playing": return { song: gameSong(snap), mode: "full", key: "r" + snap.roundId };
    case "locked":
    case "reveal": return boss ? { song: "toccata", mode: "full", key: "g" + g } : { song: "suspense", mode: "full", key: "s" + snap.roundId };
    case "results":
    case "leaderboard": return boss ? { song: "toccata", mode: "full", key: "g" + g } : { song: "victory", mode: "full", key: "v" + snap.roundId };
    case "final":
    case "predictions": return { song: "ode", mode: "full", key: "final" };
    case "credits": return { song: "credits", mode: "full", key: "credits" };
    default: return null;
  }
}
