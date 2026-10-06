// Client-side game modules, in play order. The server decides the order; this
// map just finds the module for a game id.
import price from "./price.js";
import dash from "./dash.js";
import momordad from "./momordad.js";
import binky from "./binky.js";
import order from "./order.js";
import boss from "./boss.js";

export const GAMES = { [price.id]: price, [dash.id]: dash, [momordad.id]: momordad,[binky.id]: binky, [order.id]: order, [boss.id]: boss };
export const getGame = (id) => GAMES[id] || null;
