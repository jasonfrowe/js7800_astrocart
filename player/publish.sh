#!/bin/sh
# Publish games to kona (jasonrowe.org/Atari7800/): for each game repository,
# build its last commit in a clean clone (work in progress is left out), make
# its page with make_site.py and copy it to <slug>/; then rewrite the landing
# page from games.json. Other folders there are left alone.
#
#   player/publish.sh ~/Software/Atari7800/Astrowing [more game repos...]
#   player/publish.sh --landing        (only the landing page)
#
# HOST (default kona) and DEST (default /var/www/html/Atari7800) say where.
# Needs wasmtime, python3, node and npm (the bundle is built when stale).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
HOST=${HOST:-kona}
DEST=${DEST:-/var/www/html/Atari7800}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

BUNDLE=$("$HERE/bundle.sh")
V=$(git -C "$HERE" rev-parse --short HEAD)

for REPO in "$@"; do
    [ "$REPO" = "--landing" ] && continue
    REPO=$(cd "$REPO" && pwd)
    NAME=$(basename "$REPO")
    echo "== $NAME"
    git clone -q "$REPO" "$TMP/$NAME"
    G=$(git -C "$TMP/$NAME" rev-parse --short HEAD)
    SLUG=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["slug"])' "$TMP/$NAME/web/game.json")
    BUILD=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("build",""))' "$TMP/$NAME/web/game.json")
    if [ -n "$BUILD" ]; then
        (cd "$TMP/$NAME" && sh -c "$BUILD") > "$TMP/$NAME.build.log" 2>&1 || {
            tail -20 "$TMP/$NAME.build.log"; echo "$NAME: build failed"; exit 1; }
    fi
    python3 "$HERE/make_site.py" "$TMP/$NAME" "$TMP/site-$SLUG" --bundle "$BUNDLE" --version "$G-$V"
    rsync -rlpt --delete "$TMP/site-$SLUG/" "$HOST:$DEST/$SLUG/"
    echo "published $NAME ($G) to $HOST:$DEST/$SLUG/"
done

python3 "$HERE/landing.py" "$TMP/landing" --version "$V"
rsync -rlpt "$TMP/landing/index.html" "$TMP/landing/style.css" "$HOST:$DEST/"
echo "landing page updated"
