#!/usr/bin/env bash
# Builds PocketFish and uploads it to App Store Connect for TestFlight, without clicking through Xcode:
#
#   npm run testflight                      # team from the Xcode project (Signing & Capabilities)
#   TEAM_ID=XXXXXXXXXX npm run testflight   # or name it
#
# Needs a Mac with Xcode, signed in to your developer account (Xcode → Settings → Accounts), or an
# App Store Connect API key in ASC_KEY_PATH, ASC_KEY_ID and ASC_ISSUER_ID. Xcode picks the next free
# build number itself. After the upload, App Store Connect processes the build (10–30 minutes) and the
# TestFlight app on the iPhone offers it.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(uname)" != Darwin ]] || ! command -v xcodebuild >/dev/null; then
  echo "TestFlight uploads need a Mac with Xcode (and: sudo xcode-select -s /Applications/Xcode.app)." >&2
  exit 1
fi

PROJECT=ios/App/App.xcodeproj
ARCHIVE=ios/App/build/PocketFish.xcarchive
EXPORT=ios/App/output/testflight

TEAM_ID="${TEAM_ID:-$(grep -m1 -o 'DEVELOPMENT_TEAM = [A-Z0-9]*' "$PROJECT/project.pbxproj" | awk '{print $3}' || true)}"
if [[ -z "$TEAM_ID" ]]; then
  cat >&2 <<'MSG'
No development team. Choose it once in Xcode (App target → Signing & Capabilities → Team), or run
  TEAM_ID=XXXXXXXXXX npm run testflight
with the Team ID from developer.apple.com → Account → Membership details.
MSG
  exit 1
fi

# an App Store Connect API key instead of the account signed in to Xcode (optional)
auth=()
if [[ -n "${ASC_KEY_PATH:-}" ]]; then
  auth=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
fi

# Xcode 15.3 renamed the export method
version=$(xcodebuild -version | awk 'NR == 1 { print $2 }')
major=${version%%.*}
minor=$(echo "$version" | cut -d. -f2)
method=app-store-connect
if ((major < 15 || (major == 15 && ${minor:-0} < 3))); then method=app-store; fi

echo "› Building the web app and copying it into the iOS project"
npm run build
npx cap sync ios
node scripts/release-check.mjs

echo "› Archiving with Xcode $version, team $TEAM_ID (a few minutes)"
rm -rf "$ARCHIVE"
xcodebuild -project "$PROJECT" -scheme App -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" -allowProvisioningUpdates ${auth[@]+"${auth[@]}"} \
  DEVELOPMENT_TEAM="$TEAM_ID" -quiet archive

echo "› Uploading to App Store Connect"
mkdir -p "$EXPORT"
cat >"$EXPORT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>$method</string>
  <key>destination</key>
  <string>upload</string>
  <key>teamID</key>
  <string>$TEAM_ID</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key>
  <true/>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
PLIST
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$EXPORT/ExportOptions.plist" \
  -exportPath "$EXPORT" -allowProvisioningUpdates ${auth[@]+"${auth[@]}"}

cat <<'DONE'

✓ Uploaded. App Store Connect now processes the build (10–30 minutes, you get an email).
  With "Automatic distribution" on for your internal TestFlight group, it then appears in the
  TestFlight app on the iPhone: open TestFlight → PocketFish → Update (or turn on Automatic Updates there).
  Then publish the source of this version (the GPL asks for it): npm run publish-source
DONE
