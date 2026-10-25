# Layout mockups (proposal, not the game)

Static pictures of a proposed bigger Snake layout, drawn with the real renderer. Nothing here changes the game. They need owner approval before any implementation.

- `phone-night-a-start.png`: Start with a big Play button on the board.
- `phone-night-b-playing.png`: Playing. Portrait board (14 by 20 cells), top row of icon readouts, quick setup chips, big Pause button, optional D-pad.
- `phone-night-c-paused.png`: Paused with Resume and Restart.
- `phone-night-d-gameover.png`: Game over with Play again.
- `phone-night-e-setup.png`: Quick setup sheet with Edges, Maze, Lives and a real three step Speed control.
- `desktop-night.png`, `desktop-colour.png`: Desktop layout with a large board and a compact side column.
- `phone-colour-playing.png`, `phone-lcd-playing.png`: the same screen in the other themes.
- `index.html`: the source of the pictures (open it with `?theme=night&only=play` and similar).

Open choices: a portrait board on phones needs its own maze layouts; the full screen button works on Android and desktop only; sound is shown as a placeholder.

## More mockups: snake styles, mazes, colours
- `sheets/sheet-3-snake-styles.png`: Modern tube (current), Classic pixel, Striped, Scales, Beads, Neon, Pixel cobra. Drawing only; rules unchanged.
- `sheets/sheet-4-mazes.png`: Clear field, the 3 maze layouts in the game, and 8 new ideas (Corners, Tunnels, Zigzag, Rooms, Diamond, Islands, Staircase, Bars). The script that drew them checks that the start row is clear and every free cell is reachable. New layouts would need engine tests and a picker in Game setup.
- `sheets/sheet-5-snake-colours.png`: Green, Cyan, Blue, Violet, Pink and Lime. No red, orange or yellow, so the snake never looks like the fruit or bonus.
- `styles.html`: the source (`?sheet=styles`, `?sheet=mazes`, `?sheet=colours`).
- `sheets/sheet-1-three-looks.png`, `sheets/sheet-2-phone-flow.png`: combined views of the layout mockups.
Proposal only. None of this is in the game yet.

## Launcher (several games)
- `sheets/sheet-6-launcher.png`: A shelf with Snake as the hero, B arcade list, C desktop. Bounce and Space Impact are shown as "Coming soon" with illustrative art only. Includes a Daily challenge card (same seeded run for everyone, shared as text, no server). Source: `launcher.html`. Proposal only.
