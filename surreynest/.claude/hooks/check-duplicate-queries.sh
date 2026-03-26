#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# check-duplicate-queries.sh
#
# PostToolUse hook: after Claude edits a file, check whether any new query
# or service functions it added could instead reuse or extend an existing one.
#
# How it works:
#   1. Reads the edited file path from the hook's JSON stdin
#   2. Only activates on Python service files and JS/TS API service files
#   3. Uses `git diff` to extract newly added function definitions
#   4. Searches the whole codebase for functions with similar names
#   5. If duplicates/near-duplicates found → returns decision:block with
#      specific feedback so Claude can reconsider and consolidate
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── 1. Parse input ────────────────────────────────────────────────────────────
INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
    print('')
" 2>/dev/null)

[ -z "$FILE_PATH" ] && exit 0

# ── 2. Only check relevant files ──────────────────────────────────────────────
# Python: service files, router files, any file with "query" or "repo" in name
# JS/TS:  files named *api*, *service*, *query*, *repository*
if [[ ! "$FILE_PATH" =~ (service|router|api|query|repository|repo)\.(py|js|ts|jsx|tsx)$ ]]; then
    exit 0
fi

# ── 3. Find project root ──────────────────────────────────────────────────────
PROJECT_ROOT=$(git -C "$(dirname "$FILE_PATH")" rev-parse --show-toplevel 2>/dev/null)
[ -z "$PROJECT_ROOT" ] && exit 0

# ── 4. Get the diff for this file (staged or unstaged) ────────────────────────
DIFF=$(git -C "$PROJECT_ROOT" diff HEAD -- "$FILE_PATH" 2>/dev/null)
if [ -z "$DIFF" ]; then
    DIFF=$(git -C "$PROJECT_ROOT" diff -- "$FILE_PATH" 2>/dev/null)
fi
[ -z "$DIFF" ] && exit 0

# ── 5. Extract newly added function names from diff ───────────────────────────
# Lines starting with "+" that define a function
if [[ "$FILE_PATH" == *.py ]]; then
    # Match "def function_name(" at module level or inside a class
    NEW_FUNCS=$(echo "$DIFF" | grep "^+" | \
        grep -E "^\+[[:space:]]*(async[[:space:]]+)?def [a-zA-Z_]" | \
        sed 's/.*def \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/' | \
        grep -v "^test_" | sort -u)
else
    # Match JS/TS function declarations and arrow functions
    NEW_FUNCS=$(echo "$DIFF" | grep "^+" | \
        grep -E "^\+[[:space:]]*(export[[:space:]]*)?(async[[:space:]]+)?function [a-zA-Z_]|^\+[[:space:]]*(export[[:space:]]*)?const [a-zA-Z_][a-zA-Z0-9_]* =" | \
        sed 's/.*function \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/' | \
        sed 's/.*const \([a-zA-Z_][a-zA-Z0-9_]*\) .*/\1/' | \
        sort -u)
fi

[ -z "$NEW_FUNCS" ] && exit 0

# ── 6. For each new function, search for existing similar ones ────────────────
FEEDBACK=""

while IFS= read -r func_name; do
    [ -z "$func_name" ] && continue

    # --- Exact name match in rest of codebase ---
    EXACT=$(grep -rn \
        --include="*.py" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" \
        -E "(def |function |const )${func_name}[[:space:](]" \
        "$PROJECT_ROOT" 2>/dev/null | \
        grep -v "$FILE_PATH" | \
        grep -v "__pycache__" | \
        grep -v "node_modules" | \
        grep -v "\.git" | \
        head -5)

    if [ -n "$EXACT" ]; then
        FEEDBACK="${FEEDBACK}⚠️  Function '${func_name}' already exists elsewhere:\n${EXACT}\n\n"
        continue
    fi

    # --- Semantic similarity: strip common query prefixes and search ---
    # e.g. get_property_by_uprn → property_by_uprn → search for "property" + "uprn"
    BASE=$(echo "$func_name" | \
        sed 's/^get_//' | sed 's/^fetch_//' | sed 's/^find_//' | \
        sed 's/^query_//' | sed 's/^load_//' | sed 's/^retrieve_//' | \
        sed 's/^read_//' | sed 's/^list_//' | sed 's/^search_//')

    if [ "$BASE" != "$func_name" ] && [ ${#BASE} -gt 4 ]; then
        SIMILAR=$(grep -rn \
            --include="*.py" --include="*.js" --include="*.ts" \
            -i "${BASE}" \
            "$PROJECT_ROOT" 2>/dev/null | \
            grep -E "(def |function |const )" | \
            grep -v "$FILE_PATH" | \
            grep -v "__pycache__" | \
            grep -v "node_modules" | \
            grep -v "\.git" | \
            head -5)

        if [ -n "$SIMILAR" ]; then
            FEEDBACK="${FEEDBACK}💡 New function '${func_name}' — similar existing functions found for '${BASE}':\n${SIMILAR}\nCould any of these be extended (add an argument, expand a SELECT) instead of adding a new function?\n\n"
        fi
    fi

done <<< "$NEW_FUNCS"

# ── 7. Return feedback to Claude ──────────────────────────────────────────────
if [ -n "$FEEDBACK" ]; then
    python3 -c "
import json, sys

feedback = sys.stdin.read()

message = (
    'QUERY DUPLICATION CHECK\n'
    '=======================\n'
    + feedback +
    'Please review the above before proceeding:\n'
    '  • If an exact match exists → remove the new function and call the existing one.\n'
    '  • If a similar function exists → consider adding an argument or expanding the SELECT instead of a new function.\n'
    '  • If the new function is genuinely different → this warning can be ignored.\n'
)

print(json.dumps({'decision': 'block', 'reason': message}))
" <<< "$FEEDBACK"
fi

exit 0
