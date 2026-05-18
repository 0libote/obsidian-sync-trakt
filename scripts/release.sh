#!/usr/bin/env bash
# End-to-end local release: bump versions, build, commit, tag, push, and
# create a draft GitHub Release with main.js / manifest.json / styles.css
# attached. The .github/workflows/release.yml workflow does the same thing
# in CI; this script lets you ship a release without using any Actions
# minutes — useful when over quota, when working offline, or when you just
# prefer not to wait for CI.
#
# Usage:  ./scripts/release.sh <version>          (e.g. 1.0.1)
# Skip the local build step if you already have a fresh main.js:
#         RELEASE_SKIP_BUILD=1 ./scripts/release.sh 1.0.1
# Skip local lint / tests / release i18n checks:
#         RELEASE_SKIP_CHECKS=1 ./scripts/release.sh 1.0.1
# Skip the local "gh release create" step (CI / workflow will do it):
#         RELEASE_SKIP_GH=1 ./scripts/release.sh 1.0.1

set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.0.1"
  exit 1
fi

# Validate semver — Obsidian's plugin spec requires plain x.y.z (no v-prefix,
# no pre-release suffix in the tag name).
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be in x.y.z format (got '$VERSION')"
  exit 1
fi

# Refuse to operate on a dirty tree — any in-flight edits would silently
# end up in the version-bump commit and confuse `git blame`.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes — commit or stash first"
  exit 1
fi

# Sanity-check that gh is authenticated (only matters if we'll create the
# release locally; gate the check on the same flag).
if [ -z "${RELEASE_SKIP_GH:-}" ]; then
  if ! gh auth status >/dev/null 2>&1; then
    echo "Error: 'gh' is not authenticated. Run 'gh auth login' or set"
    echo "RELEASE_SKIP_GH=1 to skip the local release-create step."
    exit 1
  fi
fi

echo "▶ Releasing $VERSION..."

# 1. Bump manifest.json
node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  m.version = '$VERSION';
  fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2) + '\n');
"

# 2. Bump package.json (--no-git-tag-version so we control the tag below)
npm version "$VERSION" --no-git-tag-version --no-workspaces-update > /dev/null

# 3. Append to versions.json with the current minAppVersion
node -e "
  const fs = require('fs');
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const versions = JSON.parse(fs.readFileSync('versions.json', 'utf8'));
  versions[manifest.version] = manifest.minAppVersion;
  fs.writeFileSync('versions.json', JSON.stringify(versions, null, 2) + '\n');
"

# 4. Release gates. These run after the version bump so the changelog,
#    in-app release log, UI strings, and localized docs are checked
#    against the exact version being released.
if [ -z "${RELEASE_SKIP_CHECKS:-}" ]; then
  echo "▶ Running release checks..."
  npm run lint
  npm run test:i18n
  npm run check:release-i18n
fi

# 5. Build main.js — produces the artifact we'll attach to the release.
#    Skip when RELEASE_SKIP_BUILD=1 is set (assumes a fresh main.js exists).
if [ -z "${RELEASE_SKIP_BUILD:-}" ]; then
  echo "▶ Building..."
  npm run build
fi

# main.js, manifest.json, and styles.css must all be present at this point —
# bail loudly if not, since the release would otherwise be incomplete.
for asset in main.js manifest.json styles.css; do
  if [ ! -f "$asset" ]; then
    echo "Error: required asset '$asset' is missing — cannot create release."
    exit 1
  fi
done

# 6. Commit the version bump
git add manifest.json package.json package-lock.json versions.json
git commit -m "chore: release $VERSION"

# 7. Tag the release commit
git tag -a "$VERSION" -m "$VERSION"

# 8. Push commit + tag
git push origin main
git push origin "$VERSION"

# 9. Create the GitHub Release locally (draft, with the three Obsidian assets)
if [ -z "${RELEASE_SKIP_GH:-}" ]; then
  echo "▶ Creating draft GitHub Release..."
  # Resolve the GitHub repo from the `origin` remote URL explicitly. Without
  # this, `gh` picks one of the configured remotes (often upstream when the
  # fork was created with `git remote add upstream …`), and refuses to create
  # the release because the tag isn't on that repo.
  ORIGIN_URL=$(git remote get-url origin 2>/dev/null || true)
  REPO=$(echo "$ORIGIN_URL" \
    | sed -E 's#(git@github\.com:|https://github\.com/)([^/]+/[^.]+)(\.git)?#\2#' \
    | sed 's#\.git$##')
  if [ -z "$REPO" ]; then
    echo "Error: couldn't parse a GitHub owner/repo from origin URL: $ORIGIN_URL"
    echo "Skipping the gh release create step. Run manually:"
    echo "  gh release create $VERSION -R <owner>/<repo> --draft main.js manifest.json styles.css"
    exit 1
  fi

  gh release create "$VERSION" \
    -R "$REPO" \
    --title="$VERSION" \
    --draft \
    main.js manifest.json styles.css

  echo "✓ Done. Edit + publish the draft at:"
  echo "   https://github.com/$REPO/releases"
else
  echo "✓ Tag pushed. Skipping local release-create (RELEASE_SKIP_GH=1) —"
  echo "  the .github/workflows/release.yml workflow will create the draft."
fi
