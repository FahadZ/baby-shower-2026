// Server-side game modules in play order. Each module follows the contract in
// game/README.md: content(), score(), revealData(), botAnswer(), liveStat().
import price from "./price.js";

export const GAMES = [price];
export const GAMES_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));
