# Your own announcer clips (optional)

The draw screen looks for these files. If one is here, it plays instead of the built-in sound. If not, the built-in sound plays.

| File | Plays instead of |
|---|---|
| `whos-that-pokemon.mp3` | The built-in sting and the spoken "Who's that Pokémon?" |
| `its-095.mp3` (3-digit Pokédex number) | The spoken "It's Onix!" for that Pokémon |

- Use MP3. It plays in every browser.
- Trim each clip so it starts right away, with no silence or extra dialogue at either end.
- The Pokémon's cry still plays after the "It's …!" clip, so leave the cry out of it.
- Commit and push the files. The draw screen picks them up on the next reload. **Sound → settings** says whether it found `whos-that-pokemon.mp3`.

`../cries/` holds each Pokémon's cry and `../art/` its artwork, both named by Pokédex number.
