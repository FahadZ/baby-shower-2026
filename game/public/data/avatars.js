// The character roster. Each character ships in four palettes:
// p1 is the original sprite, p2-p4 are alternate costume colours made by
// scripts/make-avatar-palettes.py. The server imports this too, to validate
// picks and to hand bots real slots. Only characters listed here are offered.
export const PALETTES = ["p1", "p2", "p3", "p4"];

// move: which celebration plays for this character on the podium.
//   thunderbolt | slash | spin | kirby | jump
export const ROSTER = [
  { c: "mario", name: "Mario", franchise: "Super Mario", move: "jump" },
  { c: "peach", name: "Peach", franchise: "Super Mario", move: "jump" },
  { c: "mushroom", name: "Super Mushroom", franchise: "Super Mario", move: "jump" },
  { c: "link", name: "Link", franchise: "The Legend of Zelda", move: "spin" },
  { c: "kirby", name: "Kirby", franchise: "Kirby", move: "kirby" },
  { c: "pikachu", name: "Pikachu", franchise: "Pokémon", move: "thunderbolt" },
  { c: "sonic", name: "Sonic", franchise: "Sonic the Hedgehog", move: "jump" },
  { c: "cloud", name: "Cloud", franchise: "Final Fantasy", move: "slash" },
  { c: "pacman", name: "Pac-Man", franchise: "Pac-Man", move: "jump" },
  { c: "ghost", name: "Inky", franchise: "Pac-Man", move: "jump" }
];

export const ROSTER_BY_ID = Object.fromEntries(ROSTER.map((r) => [r.c, r]));

export function avatarFile(avatar) {
  if (!avatar) return "";
  const suffix = avatar.p && avatar.p !== "p1" ? "-" + avatar.p : "";
  return "assets/avatars/" + avatar.c + suffix + ".png";
}

export function avatarName(avatar) {
  const r = avatar && ROSTER_BY_ID[avatar.c];
  return r ? r.name : "?";
}

export function franchises() {
  const out = [];
  for (const r of ROSTER) if (!out.includes(r.franchise)) out.push(r.franchise);
  return out;
}
