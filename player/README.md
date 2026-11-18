# The web player

Atari 7800 games in the browser, with this emulator: each game gets a page
(the emulator, its controls and a description) on
[jasonrowe.org/Atari7800](https://jasonrowe.org/Atari7800/) and on its
repository's GitHub Pages site.

A game repository needs:

- `web/game.json`: the page and how to build the game (see `make_site.py`
  for the fields). For example:

  ```json
  {
    "slug": "astrowing",
    "title": "Astro Wing: Starfighter",
    "title_accent": "Starfighter",
    "tagline": "A new space shooter for the Atari 7800",
    "rom": "build/output/astrowing.a78",
    "build": "tools/build.sh",
    "controls": [["Rotate", "[←] [→]"], ["Fire", "[Z]"]],
    "about": ["The Evil Empire has scattered five Relics of Power..."],
    "repo": "https://github.com/jasonfrowe/Astrowing",
    "image": "docs/Astrowing_screenshot.png"
  }
  ```

  In `controls`, `[Z]` is a key cap. `about` is HTML. The build must work in a
  fresh clone on Linux or macOS (7800basic's WebAssembly tools under wasmtime
  do), and Python packages come from `requirements.txt` if there is one.

- `.github/workflows/web.yml`, for GitHub Pages (and Pages set to "GitHub
  Actions" in the repository's settings):

  ```yaml
  name: Web
  on:
    push:
      branches: [main]
    workflow_dispatch:
  jobs:
    web:
      uses: jasonfrowe/js7800_astrocart/.github/workflows/player.yml@astrocart
      permissions:
        contents: read
        pages: write
        id-token: write
  ```

## kona

`player/publish.sh GAME_REPO...` builds each game's last commit in a clean
clone, makes its page and copies it to `kona:/var/www/html/Atari7800/<slug>/`,
then rewrites the landing page from `games.json` (add a game there to list
it). The pages have no inline scripts: kona's Content-Security-Policy allows
only scripts from the site itself.

## Files

| | |
|---|---|
| `page/` | `play.js` (starts the emulator, loads the ROM) and `style.css` |
| `make_site.py` | one game's site: page, ROM, bundle |
| `landing.py` | the Atari 7800 landing page, from `games.json` |
| `bundle.sh` | builds `dist/js7800.min.js` when it is stale |
| `publish.sh` | to kona |
| `../.github/workflows/player.yml` | the shared GitHub Pages workflow |
