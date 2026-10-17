# Announcer and voice clips

The draw screen plays these when they're here. When a clip is missing, it falls back to a built-in sound.

| File | What it is | Without it |
|---|---|---|
| `whos-that-pokemon.mp3` | The original "Who's that Pokémon?" announcer line and jingle (included) | A synthesized sting plus text-to-speech |
| `reveal-sting.mp3` | The end of that jingle, played on the reveal (included) | A synthesized hit |
| `its-095.mp3` (3-digit Pokédex number) | A recorded "It's Onix!" for that Pokémon | Text-to-speech says it |
| `cry-095.mp3` | That Pokémon's anime voice ("Oniiix!"), played instead of its game cry | The cry in `../cries/` |

- Use MP3. It plays in every browser.
- Trim each clip so it starts right away, with no silence at either end.
- Commit and push the files. The draw screen picks them up on the next reload.

`../cries/` holds each Pokémon's cry and `../art/` its artwork, both named by Pokédex number.
