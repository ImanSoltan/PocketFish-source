#!/usr/bin/env bash
# First-time setup of PocketFish on a Mac: checks Node and Xcode, installs the dependencies, builds the app
# into the iOS project and, given your Team ID, saves the signing team in the Xcode project (committed, so
# Xcode, npm run testflight and later updates all use it without local changes):
#
#   bash scripts/setup-mac.sh                # or: npm run setup:mac
#   bash scripts/setup-mac.sh ABCDE12345     # with the Team ID (developer.apple.com → Account → Membership details)
set -eo pipefail
cd "$(dirname "$0")/.."

TEAM_ID=${1:-${TEAM_ID:-}}
PBX=ios/App/App.xcodeproj/project.pbxproj
problems=0

[ "$(uname)" = Darwin ] || { echo "This is for a Mac." >&2; exit 1; }

# Node 22.12 or newer
if ! command -v node >/dev/null; then
  echo "✗ Node.js is missing: install the LTS version from nodejs.org (or: brew install node)"
  problems=1
else
  v=$(node -p 'process.versions.node')
  major=${v%%.*}
  minor=$(echo "$v" | cut -d. -f2)
  if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 12 ]; }; then
    echo "✗ Node.js $v is too old: install 22.12 or newer from nodejs.org"
    problems=1
  else
    echo "✓ Node.js $v"
  fi
fi

# Xcode, selected as the active developer directory (not just the command line tools)
if ! xcodebuild -version >/dev/null 2>&1; then
  echo "✗ Xcode is missing or not selected: install it from the App Store, open it once, then run"
  echo "    sudo xcode-select -s /Applications/Xcode.app"
  problems=1
else
  echo "✓ $(xcodebuild -version | head -1)"
fi
[ $problems -eq 0 ] || exit 1

echo "› npm install"
npm install --no-audit --no-fund
echo "› Building the app into the iOS project"
npm run build
npx cap sync ios

# the signing team, in both build configurations of the App target
current=$(grep -m1 -o 'DEVELOPMENT_TEAM = [A-Z0-9]*' "$PBX" | awk '{print $3}' || true)
if [ -n "$TEAM_ID" ] && [ "$TEAM_ID" != "$current" ]; then
  [[ "$TEAM_ID" =~ ^[A-Z0-9]{10}$ ]] || { echo "✗ A Team ID is 10 letters and digits, like ABCDE12345." >&2; exit 1; }
  if [ -n "$current" ]; then
    sed -i '' "s/DEVELOPMENT_TEAM = $current;/DEVELOPMENT_TEAM = $TEAM_ID;/" "$PBX"
  else
    perl -pi -e 's/^(\s*)CODE_SIGN_STYLE = Automatic;\n/$1CODE_SIGN_STYLE = Automatic;\n$1DEVELOPMENT_TEAM = '"$TEAM_ID"';\n/' "$PBX"
  fi
  git add "$PBX"
  git commit -q -m "Xcode signing team" -- "$PBX"
  echo "✓ Signing team $TEAM_ID saved in the Xcode project and committed (git push to share it)"
elif [ -n "$current" ]; then
  echo "✓ Signing team $current"
else
  echo "⚠ No signing team yet: run again with your Team ID (bash scripts/setup-mac.sh ABCDE12345)"
fi

cat <<'NEXT'

Ready. Next:
  npm run testflight   build and upload a TestFlight build
  npx cap open ios     open Xcode to run it on a connected iPhone
NEXT
