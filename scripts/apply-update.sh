#!/usr/bin/env bash
# Brings the PocketFish project folder up to date from update files (git bundles) and pushes it to GitHub:
#
#   bash scripts/apply-update.sh                        # every ~/Downloads/pocketfish-*.bundle
#   bash scripts/apply-update.sh path/to/x.bundle ...   # or name the files (any order)
#
# The project folder is ~/work/PocketFish (POCKETFISH_DIR=... for another one); a folder that doesn't exist
# yet is created. Options:
#   --no-push   only update the folder
#   --replace   when the folder has commits of its own: keep them on a backup branch, take the update's
#               history and force-push it (without it, the update is merged with them)
# Local changes (e.g. the signing team set in Xcode) are put aside and put back afterwards.
set -eo pipefail

REPO_URL=${POCKETFISH_REMOTE:-https://github.com/ImanSoltan/PocketFish.git}
push=1
replace=0
bundles=()
for a in "$@"; do
  case "$a" in
    --no-push) push=0 ;;
    --replace) replace=1 ;;
    -h | --help)
      sed -n '2,13p' "$0"
      exit 0
      ;;
    *) bundles+=("$a") ;;
  esac
done
if [ ${#bundles[@]} -eq 0 ]; then
  shopt -s nullglob
  bundles=("$HOME"/Downloads/pocketfish-*.bundle)
  shopt -u nullglob
fi
if [ ${#bundles[@]} -eq 0 ]; then
  echo "No update files: save the pocketfish-*.bundle files in ~/Downloads, or name them." >&2
  exit 1
fi
for b in "${bundles[@]}"; do
  [ -f "$b" ] || { echo "Not found: $b" >&2; exit 1; }
  bundles_abs+=("$(cd "$(dirname "$b")" && pwd)/$(basename "$b")")
done

# the project folder: this repository when the script runs from inside it, else ~/work/PocketFish
here=$(cd "$(dirname "$0")/.." && pwd)
if [ -n "${POCKETFISH_DIR:-}" ]; then
  dir=$POCKETFISH_DIR
elif [ -d "$here/.git" ] && grep -q '"name": "pocketfish"' "$here/package.json" 2>/dev/null; then
  dir=$here
else
  dir=$HOME/work/PocketFish
fi
if [ ! -e "$dir" ]; then
  echo "› Creating $dir"
  mkdir -p "$dir"
  git -C "$dir" init -q -b main
  git -C "$dir" remote add origin "$REPO_URL"
fi
cd "$dir"
git rev-parse --git-dir >/dev/null 2>&1 || { echo "$dir is not a git folder." >&2; exit 1; }
echo "› Project folder: $dir"

# temporary refs for what the bundles bring, removed at the end
cleanup() {
  git for-each-ref --format='%(refname)' refs/pocketfish-update/ | while read -r ref; do git update-ref -d "$ref"; done
}
trap cleanup EXIT

# fetch every bundle whose earlier history is already here, until nothing more fits
pending=("${bundles_abs[@]}")
i=0
damaged=0
progress=1
while [ $progress -eq 1 ] && [ ${#pending[@]} -gt 0 ]; do
  progress=0
  still=()
  for b in "${pending[@]}"; do
    if git bundle verify "$b" >/dev/null 2>&1; then
      i=$((i + 1))
      if git fetch -q "$b" "refs/heads/*:refs/pocketfish-update/$i/*" 2>/dev/null; then
        echo "  read $(basename "$b")"
        progress=1
      else
        echo "  ✗ $(basename "$b") is incomplete (an unfinished download?): delete it and download it again"
        damaged=1
      fi
    else
      still+=("$b")
    fi
  done
  pending=(${still[@]+"${still[@]}"})
done
for b in ${pending[@]+"${pending[@]}"}; do
  echo "  skipped $(basename "$b"): it builds on an update file that's missing (or isn't an update file)"
done
[ $damaged -eq 0 ] || { echo "Nothing was changed. Run this again once the file is downloaded completely." >&2; exit 1; }
[ $i -gt 0 ] || { echo "None of the files could be used." >&2; exit 1; }

# the newest commit: the one every other fetched commit leads to
heads=$(git for-each-ref --format='%(objectname)' refs/pocketfish-update/ | sort -u)
target=""
for h in $heads; do
  all=1
  for o in $heads; do
    git merge-base --is-ancestor "$o" "$h" || { all=0; break; }
  done
  if [ $all -eq 1 ]; then target=$h; break; fi
done
[ -n "$target" ] || { echo "The update files don't form one history; send them to the developer." >&2; exit 1; }
echo "› Latest: $(git log --format='%h %s' -1 "$target")"

old=$(git rev-parse -q --verify HEAD || true)
stashed=0
forced=0
if [ -z "$old" ]; then
  # a new folder, or a clone of an empty repository
  git checkout -q -B main "$target"
else
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git stash push -q -m "before pocketfish update $(date +%Y-%m-%d\ %H:%M)"
    stashed=1
    echo "› Local changes put aside"
  fi
  if [ "$(git symbolic-ref --short -q HEAD || true)" != main ]; then
    git checkout -q main 2>/dev/null || git checkout -q -b main
  fi
  if git merge-base --is-ancestor HEAD "$target"; then
    git merge -q --ff-only "$target"
  elif git merge-base --is-ancestor "$target" HEAD; then
    echo "› Already up to date (the folder has newer commits than the update files)"
  elif [ $replace -eq 1 ]; then
    backup="backup/before-update-$(date +%Y%m%d-%H%M%S)"
    git branch "$backup"
    git reset -q --hard "$target"
    forced=1
    echo "› The folder's own history is kept on the branch $backup"
  else
    # the folder has commits of its own (e.g. the signing team chosen in Xcode): keep them, merge the update in
    echo "› Merging the update with the folder's own commits:"
    git --no-pager log --format='    %h %s' "$target..HEAD"
    if ! git merge -q --no-edit -m "Merge update $(git log --format=%h -1 "$target")" "$target"; then
      conflicts=$(git diff --name-only --diff-filter=U)
      git merge --abort
      echo "✗ The update and those commits change the same lines in:" >&2
      echo "$conflicts" | sed 's/^/    /' >&2
      echo "  Nothing was changed. Send this message to the developer, or run again with --replace" >&2
      echo "  (keeps the folder's commits on a backup branch and takes the update's history)." >&2
      [ $stashed -eq 1 ] && git stash pop -q
      exit 1
    fi
  fi
  if [ $stashed -eq 1 ]; then
    if git stash pop -q; then
      echo "› Local changes put back"
    else
      echo "⚠ Your local changes clash with the update; they're kept in 'git stash list'." >&2
    fi
  fi
fi
new=$(git rev-parse HEAD)
echo "✓ $(git log --format='%h %s' -1)"

# dependencies, when they changed or were never installed
if [ ! -d node_modules ] || [ -z "$old" ] || ! git diff --quiet "$old" "$new" -- package.json package-lock.json; then
  if command -v npm >/dev/null; then
    echo "› npm install"
    npm install --no-audit --no-fund
  else
    echo "⚠ Install Node.js 22.12 or newer (nodejs.org), then run: npm install"
  fi
fi

if [ $push -eq 1 ]; then
  url=$(git remote get-url origin 2>/dev/null || true)
  if [ -z "$url" ]; then
    git remote add origin "$REPO_URL"
    url=$REPO_URL
  fi
  case "$url" in
    *PocketFish*)
      echo "› Pushing to $url"
      if [ $forced -eq 1 ]; then git push --force-with-lease -u origin main; else git push -u origin main; fi
      ;;
    *) echo "⚠ Not pushed: origin is $url. To use PocketFish: git remote set-url origin $REPO_URL" ;;
  esac
fi

echo
echo "Next: npm run testflight   (or npx cap open ios to run it from Xcode)"
