# Announcer and voice clips

All of these come from the original English broadcast of the "Who's That Pokémon?" segment (Charmander, Season 1). The draw screen plays a clip when it's here and falls back to a built-in sound when it isn't.

| File | What it is | Without it |
|---|---|---|
| `whos-that-pokemon.mp3` | The opening: Poké Ball sound, music, "Who's that Pokémon?" (4.8 s, timed to the opening animation) | A synthesized sting plus text-to-speech |
| `reveal-music.mp3` | The reveal music with the announcer taken out, so any name can go over it | A synthesized hit |
| `its-004.mp3` (3-digit Pokédex number) | That Pokémon's real "It's ___!" line, played 0.95 s into the reveal music | Text-to-speech says it |
| `cry-004.mp3` | That Pokémon's anime voice ("Char!"), played instead of its game cry | The cry in `../cries/` |

Charmander (#004) has both of its real clips. To add another Pokémon, save its clips with its number:

- Use MP3. It plays in every browser.
- Trim each clip so it starts right away, with no silence at either end.
- Commit and push the files. The draw screen picks them up on the next reload.

`../cries/` holds each Pokémon's cry and `../art/` its artwork, both named by Pokédex number.
