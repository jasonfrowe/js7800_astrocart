#!/usr/bin/env python3
"""Put together a game's web player: the page (from the game's web/game.json),
play.js and style.css, the ROM and the js7800 bundle, in OUT.

  make_site.py GAME_DIR OUT --bundle dist/js7800.min.js [--version V]

GAME_DIR is the game's repository, after its build (game.json's "rom" names
the built cartridge in it). game.json:

  slug        the page's folder on kona (jasonrowe.org/Atari7800/<slug>/)
  title       the page's title; title_accent: its last words, in the accent color
  tagline     a line under the title
  rom         the built .a78, relative to GAME_DIR
  build       the command that builds it (run by publish.sh and the workflow)
  ready       the line shown once the cartridge has loaded
  controls    [[action, keys], ...]: in keys, [X] is a key cap
  about       [html paragraph, ...]: the page's description
  repo        the game's GitHub repository URL
  image       a screenshot in GAME_DIR, for the Atari 7800 landing page

Everything but slug, title and rom is optional.
"""
import argparse, html, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))

KEYS_NOTE = ("Keyboard: the arrow keys are the joystick, [Z] and [X] buttons 1 and 2, "
             "[F2] Select, [F3] Reset and [F4] Pause; player 2 is [J] [L] [I] [K] with "
             "[N] and [M]. A gamepad works too, and the cog in the bar below the screen "
             "changes the keys. Browsers start sound only once you click or press a key.")


def keys_html(text):
    """Escape text, with [X] as a key cap."""
    out, pos = [], 0
    for m in re.finditer(r"\[([^\]]+)\]", text):
        out.append(html.escape(text[pos:m.start()]))
        out.append("<kbd>" + html.escape(m.group(1)) + "</kbd>")
        pos = m.end()
    out.append(html.escape(text[pos:]))
    return "".join(out)


def page(g, rom_name, version):
    e = html.escape
    title = g["title"]
    accent = g.get("title_accent", "")
    if accent and title.endswith(accent):
        h1 = e(title[:-len(accent)]) + "<span>" + e(accent) + "</span>"
    else:
        h1 = e(title)
    v = "?v=" + e(version) if version else ""
    rows = "\n".join(f"      <tr><th>{e(a)}</th><td>{keys_html(k)}</td></tr>"
                     for a, k in g.get("controls", []))
    about = "\n".join(f"    <p>{p}</p>" for p in g.get("about", []))
    repo = g.get("repo", "")
    links = []
    if repo:
        links.append(f'<a href="{e(repo)}">Source</a>')
    links.append(f'<a href="{e(rom_name)}" download>Download the ROM</a>')
    tagline = f'\n  <p class="tag">{e(g["tagline"])}</p>' if g.get("tagline") else ""
    desc = e(g.get("tagline", title))
    return f"""<!doctype html>
<!--
  {e(title)} in the browser, made by js7800_astrocart's player/make_site.py.
  The emulator is js7800 by raz0red (GPL-2.0), from the js7800_astrocart fork,
  which adds the AstroCart math unit and second POKEY.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{desc}">
<link rel="stylesheet" href="style.css{v}">
<script src="js/js7800.min.js{v}"></script>
<script src="play.js{v}" defer></script>
</head>
<body>
<header class="top">
  <h1>{h1}</h1>{tagline}
</header>

<main>
  <div id="player" data-rom="{e(rom_name)}" data-ready="{e(g.get('ready', 'Click or press a key for sound.'))}">
    <div id="js7800__target"></div>
    <p id="status" class="status">Loading the cartridge&hellip;</p>
  </div>

  <section class="help">
    <h2>Controls</h2>
    <table>
{rows}
    </table>
    <p class="note">{keys_html(KEYS_NOTE)}</p>
  </section>

  <section class="about">
    <h2>The game</h2>
{about}
    <p>{" &middot; ".join(links)}</p>
  </section>
</main>

<footer>
  <p><a href="https://jasonrowe.org/Atari7800/">More Atari 7800 games</a>.
    Emulator: <a href="https://github.com/raz0red/js7800">js7800</a> by raz0red (GPL-2.0),
    with AstroCart support from <a href="https://github.com/jasonfrowe/js7800_astrocart">js7800_astrocart</a>.</p>
</footer>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("game_dir")
    ap.add_argument("out")
    ap.add_argument("--bundle", required=True, help="js7800.min.js")
    ap.add_argument("--version", default="", help="names the build in the .js/.css URLs (for caches)")
    a = ap.parse_args()

    g = json.load(open(os.path.join(a.game_dir, "web", "game.json")))
    rom = os.path.join(a.game_dir, g["rom"])
    if not os.path.isfile(rom):
        sys.exit(f"no ROM at {rom}: build the game first")
    rom_name = g["slug"] + ".a78"

    if os.path.exists(a.out):
        shutil.rmtree(a.out)
    os.makedirs(os.path.join(a.out, "js"))
    with open(os.path.join(a.out, "index.html"), "w") as f:
        f.write(page(g, rom_name, a.version))
    for name in ("play.js", "style.css"):
        shutil.copy(os.path.join(HERE, "page", name), a.out)
    shutil.copy(rom, os.path.join(a.out, rom_name))
    shutil.copy(a.bundle, os.path.join(a.out, "js", "js7800.min.js"))
    shutil.copy(os.path.join(HERE, "..", "LICENSE"), os.path.join(a.out, "js", "js7800-LICENSE.txt"))
    if g.get("image"):
        img = os.path.join(a.game_dir, g["image"])
        shutil.copy(img, os.path.join(a.out, "screen" + os.path.splitext(img)[1].lower()))
    open(os.path.join(a.out, ".nojekyll"), "w").close()
    for root, dirs, files in os.walk(a.out):
        for d in dirs:
            os.chmod(os.path.join(root, d), 0o755)
        for f in files:
            os.chmod(os.path.join(root, f), 0o644)
    print(f"site in {a.out}")


if __name__ == "__main__":
    main()
