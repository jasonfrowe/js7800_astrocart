#!/bin/sh
# Build dist/js7800.min.js when it is missing or older than the sources, and
# print its path. (npm install first in a fresh checkout. webpack 4 needs
# the legacy OpenSSL provider on Node 17 and later.)
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
BUNDLE="$ROOT/dist/js7800.min.js"
if [ ! -s "$BUNDLE" ] || [ -n "$(find "$ROOT/src/js" -newer "$BUNDLE" -name '*.js' ! -name ProSystemDat.js | head -1)" ]; then
    echo "building the js7800 bundle" >&2
    cd "$ROOT"
    [ -d node_modules ] || npm ci --no-audit --no-fund >&2
    node db/convert.js db/ProSystem.dat > src/js/prosystem/ProSystemDat.js
    NODE_OPTIONS=--openssl-legacy-provider npx webpack --mode=production > /dev/null
fi
echo "$BUNDLE"
