// ============================================================
//  The original 151. Index = Pokédex number (index 0 is unused).
// ============================================================
window.POKEDEX = [
  "",
  "Bulbasaur", "Ivysaur", "Venusaur", "Charmander", "Charmeleon", "Charizard",
  "Squirtle", "Wartortle", "Blastoise", "Caterpie", "Metapod", "Butterfree",
  "Weedle", "Kakuna", "Beedrill", "Pidgey", "Pidgeotto", "Pidgeot",
  "Rattata", "Raticate", "Spearow", "Fearow", "Ekans", "Arbok",
  "Pikachu", "Raichu", "Sandshrew", "Sandslash", "Nidoran♀", "Nidorina",
  "Nidoqueen", "Nidoran♂", "Nidorino", "Nidoking", "Clefairy", "Clefable",
  "Vulpix", "Ninetales", "Jigglypuff", "Wigglytuff", "Zubat", "Golbat",
  "Oddish", "Gloom", "Vileplume", "Paras", "Parasect", "Venonat",
  "Venomoth", "Diglett", "Dugtrio", "Meowth", "Persian", "Psyduck",
  "Golduck", "Mankey", "Primeape", "Growlithe", "Arcanine", "Poliwag",
  "Poliwhirl", "Poliwrath", "Abra", "Kadabra", "Alakazam", "Machop",
  "Machoke", "Machamp", "Bellsprout", "Weepinbell", "Victreebel", "Tentacool",
  "Tentacruel", "Geodude", "Graveler", "Golem", "Ponyta", "Rapidash",
  "Slowpoke", "Slowbro", "Magnemite", "Magneton", "Farfetch'd", "Doduo",
  "Dodrio", "Seel", "Dewgong", "Grimer", "Muk", "Shellder",
  "Cloyster", "Gastly", "Haunter", "Gengar", "Onix", "Drowzee",
  "Hypno", "Krabby", "Kingler", "Voltorb", "Electrode", "Exeggcute",
  "Exeggutor", "Cubone", "Marowak", "Hitmonlee", "Hitmonchan", "Lickitung",
  "Koffing", "Weezing", "Rhyhorn", "Rhydon", "Chansey", "Tangela",
  "Kangaskhan", "Horsea", "Seadra", "Goldeen", "Seaking", "Staryu",
  "Starmie", "Mr. Mime", "Scyther", "Jynx", "Electabuzz", "Magmar",
  "Pinsir", "Tauros", "Magikarp", "Gyarados", "Lapras", "Ditto",
  "Eevee", "Vaporeon", "Jolteon", "Flareon", "Porygon", "Omanyte",
  "Omastar", "Kabuto", "Kabutops", "Aerodactyl", "Snorlax", "Articuno",
  "Zapdos", "Moltres", "Dratini", "Dragonair", "Dragonite", "Mewtwo",
  "Mew"
];

// How the announcer voice should pronounce names that text-to-speech
// usually gets wrong. Anything not listed is spoken as written above.
window.POKEDEX_SAY = {
  1: "Bulba-sore", 2: "Ivy-sore", 3: "Venus-sore", 8: "War-tortle",
  10: "Cater-pee", 14: "Kah-koona", 15: "Bee-drill", 17: "Pidge-otto",
  18: "Pidge-ee-ot", 19: "Ruh-tah-tah", 22: "Fear-oh", 23: "Eh-kanz",
  25: "Peeka-choo", 26: "Rye-choo", 29: "Nee-doe-ran", 30: "Nee-doe-reena",
  31: "Nee-doe-queen", 32: "Nee-doe-ran", 33: "Nee-doe-reeno", 34: "Nee-doe-king",
  35: "Cleff-airy", 36: "Cleff-able", 38: "Nine tails", 41: "Zoo-bat",
  45: "Vile plume", 46: "Pair-us", 47: "Pair-uh-sect", 48: "Venn-oh-nat",
  51: "Dug trio", 52: "Mee-owth", 54: "Sigh-duck", 57: "Prime ape",
  58: "Growl-ith", 59: "Arc-uh-nine", 60: "Polly-wag", 61: "Polly-whirl",
  62: "Polly-wrath", 66: "Ma-chop", 67: "Ma-choke", 68: "Ma-champ",
  70: "Weepin-bell", 71: "Victree-bell", 73: "Tenta-cruel", 74: "Jee-oh-dude",
  75: "Gravel-er", 77: "Pony-tah", 78: "Rapid-ash", 80: "Slow-bro",
  81: "Mag-nuh-mite", 82: "Magnet-on", 83: "Far-fetched", 84: "Doe-doo-oh",
  85: "Doe-dree-oh", 86: "Seal", 87: "Doo-gong", 88: "Grime-er",
  89: "Muck", 90: "Shell-der", 92: "Ghastly", 94: "Ghen-gar",
  96: "Drowsy", 98: "Crabby", 102: "Ex-egg-cute", 103: "Ex-egg-yoo-tor",
  104: "Cue-bone", 105: "Mara-wack", 106: "Hit-mon-lee", 107: "Hit-mon-chan",
  108: "Lick-ee-tung", 109: "Coughing", 110: "Wheezing", 111: "Rye-horn",
  112: "Rye-don", 113: "Chan-see", 114: "Tan-gella", 115: "Kang-gas-con",
  116: "Horsey", 117: "Sea-dra", 119: "Sea king", 120: "Star-you",
  121: "Star-me", 122: "Mister Mime", 123: "Sigh-ther", 124: "Jinx",
  127: "Pincer", 128: "Tore-ohs", 129: "Magic-carp", 130: "Gyara-dose",
  131: "Lap-rus", 133: "Ee-vee", 134: "Vay-por-ee-on", 135: "Jolt-ee-on",
  136: "Flair-ee-on", 137: "Pore-ee-gon", 138: "Om-uh-night", 140: "Kah-boo-toe",
  141: "Kah-boo-tops", 142: "Air-oh-dactyl", 144: "Ar-tee-coo-no", 145: "Zap-dose",
  146: "Mol-tress", 147: "Druh-teeny", 150: "Mew two"
};
