#!/usr/bin/env bash
# Publishes the source code of the current version to the public repository, as the GPL asks for every
# version you ship: everything except what .gitattributes marks export-ignore (the trained recognition
# models and their training pipeline, which are all rights reserved).
#
#   npm run publish-source            # after committing; run it for each build you upload
#
# Public repository: github.com/ImanSoltan/PocketFish-source (PUBLIC_REPO=... for another one), kept in
# a folder next to this one, ../PocketFish-source (PUBLIC_DIR=... for another one). Each run adds one
# commit there; the private history is never published.
set -eo pipefail
cd "$(dirname "$0")/.."

PUBLIC_REPO=${PUBLIC_REPO:-https://github.com/ImanSoltan/PocketFish-source.git}
dest=${PUBLIC_DIR:-$(cd .. && pwd)/PocketFish-source}
# the public commit is signed with this name and address, never the Mac's own (user and host name)
export GIT_AUTHOR_NAME=${PUBLIC_AUTHOR_NAME:-Iman Soltanzadeh}
export GIT_AUTHOR_EMAIL=${PUBLIC_AUTHOR_EMAIL:-17715353+ImanSoltan@users.noreply.github.com}
export GIT_COMMITTER_NAME=$GIT_AUTHOR_NAME GIT_COMMITTER_EMAIL=$GIT_AUTHOR_EMAIL

if ! git diff --quiet HEAD --; then
  echo "Commit your changes first: the public source is made from the last commit." >&2
  exit 1
fi
version=$(node -p "require('./package.json').version")
commit=$(git rev-parse --short HEAD)

# what would go out, checked before anything is written: no models, no training pipeline
if git archive --format=tar HEAD | tar -t | grep -E '^(public/models|ml)/' >/dev/null; then
  echo "✗ The export would include the models or ml/: check .gitattributes. Nothing was published." >&2
  exit 1
fi

if [ ! -d "$dest/.git" ]; then
  echo "› Getting $PUBLIC_REPO into $dest"
  if ! git clone -q "$PUBLIC_REPO" "$dest" 2>/dev/null; then
    echo "✗ Could not clone $PUBLIC_REPO: create it on GitHub first (public, empty, no README)." >&2
    exit 1
  fi
fi
if [ -n "$(git -C "$dest" status --porcelain)" ]; then
  echo "✗ $dest has changes of its own; it should only ever hold published snapshots." >&2
  exit 1
fi

echo "› Exporting PocketFish $version ($commit)"
git -C "$dest" checkout -q -B main 2>/dev/null || true
git -C "$dest" rm -rq --ignore-unmatch -- . >/dev/null
git archive --format=tar HEAD | tar -x -C "$dest"
git -C "$dest" add -A
if git -C "$dest" diff --cached --quiet; then
  echo "✓ Already published: the public source matches $commit"
  exit 0
fi
git -C "$dest" commit -q -m "PocketFish $version source ($commit)"
git -C "$dest" push -q -u origin main
echo "✓ Published to $PUBLIC_REPO: $(git -C "$dest" log --format='%h %s' -1)"
