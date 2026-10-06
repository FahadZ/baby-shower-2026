// Server-side game modules in play order. Each module follows the contract in
// game/README.md: content(), score(), revealData(), botAnswer(), liveStat().
import price from "./price.js";
import bag from "./bag.js";
import dash from "./dash.js";
import momordad from "./momordad.js";
import binky from "./binky.js";
import order from "./order.js";
import boss from "./boss.js";

export const GAMES = [price, bag,dash, momordad,binky, order, boss];
export const GAMES_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));
