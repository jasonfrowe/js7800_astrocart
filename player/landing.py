#!/usr/bin/env python3
"""Write the Atari 7800 landing page (jasonrowe.org/Atari7800/) from
games.json: OUT/index.html and OUT/style.css. Each game's card links to its
folder (<slug>/) and shows the screenshot make_site.py put there.

  landing.py OUT [--version V]
"""
import argparse, html, json, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--version", default="")
    a = ap.parse_args()
    e = html.escape
    games = json.load(open(os.path.join(HERE, "games.json")))
    cards = []
    for g in games:
        s = e(g["slug"])
        img = f'<a href="{s}/"><img src="{s}/{e(g["image"])}" alt="{e(g["title"])}" loading="lazy"></a>' if g.get("image") else ""
        src = f' &middot; <a href="{e(g["repo"])}">Source</a>' if g.get("repo") else ""
        cards.append(f"""  <section class="card">
    {img}
    <h2><a href="{s}/">{e(g["title"])}</a></h2>
    <p>{e(g.get("blurb", ""))}</p>
    <p class="links"><a href="{s}/">Play</a>{src}</p>
  </section>""")
    v = "?v=" + e(a.version) if a.version else ""
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atari 7800 games</title>
<meta name="description" content="Atari 7800 homebrew games by Jason Rowe, playable in your browser.">
<link rel="stylesheet" href="style.css{v}">
</head>
<body>
<header class="top">
  <h1>Atari <span>7800</span></h1>
  <p class="tag">Homebrew games, playable in your browser</p>
</header>

<main class="landing">
<div class="games">
{chr(10).join(cards)}
</div>
</main>

<footer>
  <p>The games run in <a href="https://github.com/jasonfrowe/js7800_astrocart">js7800_astrocart</a>,
    a fork of <a href="https://github.com/raz0red/js7800">js7800</a> by raz0red that adds the
    AstroCart's math unit and second POKEY.</p>
</footer>
</body>
</html>
"""
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "index.html"), "w") as f:
        f.write(page)
    shutil.copy(os.path.join(HERE, "page", "style.css"), a.out)
    for name in ("index.html", "style.css"):
        os.chmod(os.path.join(a.out, name), 0o644)
    print(f"landing page in {a.out}")


if __name__ == "__main__":
    main()
