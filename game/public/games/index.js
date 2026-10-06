// Client-side game modules, in play order. The server decides the order; this
// map just finds the module for a game id.
import price from "./price.js";

export const GAMES = { [price.id]: price };
export const getGame = (id) => GAMES[id] || null;
