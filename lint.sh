#!/usr/bin/env bash
# Runs every linter of the project; exits non-zero if any of them fails.
# Needs: Node (run `npm ci` once), uv (for ruff/yamllint) and Docker (for hadolint/shellcheck).
set -uo pipefail
cd "$(dirname "$0")" || exit 1

RUFF=ruff@0.14.0
YAMLLINT=yamllint@1.37.1
HADOLINT=hadolint/hadolint:v2.12.0
SHELLCHECK=koalaman/shellcheck:v0.10.0

failed=()
run() {
    local name=$1
    shift
    echo "== $name"
    if ! "$@"; then
        failed+=("$name")
    fi
}

run htmlhint npx --no-install htmlhint index.html
run stylelint npx --no-install stylelint "css/**/*.css"
run eslint npx --no-install eslint js/
run "ruff check" uvx "$RUFF" check tests tools
run "ruff format" uvx "$RUFF" format --check tests tools
run yamllint uvx "$YAMLLINT" --strict .
run hadolint docker run --rm -i "$HADOLINT" < Dockerfile
run shellcheck docker run --rm -v "$PWD:/mnt:ro" -w /mnt "$SHELLCHECK" build.sh lint.sh

echo
if ((${#failed[@]})); then
    echo "Lint FAILED: ${failed[*]}"
    exit 1
fi
echo "All linters passed"
