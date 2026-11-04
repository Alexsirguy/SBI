#!/usr/bin/env bash
# Regenerates the Linux screenshot baselines in Playwright's own image, matching the CI runner.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
image="mcr.microsoft.com/playwright:v1.64.1-noble"
out="$root/apps/web/e2e/screenshots.spec.ts-snapshots"
mkdir -p "$out"
docker run --rm \
  -v "$root:/src:ro" \
  -v "$out:/out" \
  -e CI=1 \
  -e NEXT_PUBLIC_API_URL=http://localhost:4000 \
  -e NEXT_PUBLIC_MIXPANEL_TOKEN=e2e-token \
  "$image" bash -euo pipefail -c '
    mkdir /work
    tar -C /src --exclude=node_modules --exclude=.next --exclude=.turbo --exclude=.git -cf - . | tar -C /work -xf -
    cd /work
    # The pinned pnpm from package.json, so the lockfile installs exactly as in CI.
    npm install --global --silent "pnpm@$(node -p "require(\"./package.json\").packageManager.split(\"@\")[1]")"
    pnpm install --frozen-lockfile --reporter=silent
    pnpm --filter @sbi/web build >/dev/null
    cd apps/web
    pnpm exec playwright test e2e/screenshots.spec.ts --update-snapshots=all --reporter=line
    rm -f /out/*.png
    cp e2e/screenshots.spec.ts-snapshots/*.png /out/
  '
echo "Baselines written to $out"
