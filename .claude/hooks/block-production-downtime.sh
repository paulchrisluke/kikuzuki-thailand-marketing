#!/usr/bin/env bash
# PreToolUse hook (Bash). Denies commands that would take production down or
# destroy production data. Deterministic: no memory, no judgment.
#   - a production `wrangler deploy` from any config other than the repo's wrangler.toml
#   - destructive remote SQL (DROP/DELETE/TRUNCATE/ALTER/UPDATE) against the production D1 binding
#   - deleting a D1 database or the Worker
# Ordinary production deploys from wrangler.toml, every read, and everything
# aimed at preview/staging or an explicit --config binding stay allowed.
set -euo pipefail
input="$(cat)"
python3 - "$input" <<'PY'
import json, re, sys
cmd = json.loads(sys.argv[1]).get("tool_input", {}).get("command", "")
def deny(msg):
    print(msg, file=sys.stderr); sys.exit(2)
# Each shell segment is judged on its own, so a file whose text mentions a
# command is not treated as running it. Quoted heredoc bodies are still
# segments, which is the conservative side.
for seg in re.split(r'(?:&&|\|\||;|\n)', cmd):
    s = seg.strip().lower()
    if not s: continue
    if re.search(r'\bwrangler\s+deploy\b', s) and not re.search(r'--env[\s=]+[a-z]', s):
        if re.search(r'(^|\s)(-c|--config)[\s=]+', s) and not re.search(r'(-c|--config)[\s=]+(\./)?wrangler\.toml\b', s):
            deny("Blocked: production deploy from a non-repository config (maintenance/freeze deploys take customers down). Deploy production only from wrangler.toml.")
    if re.search(r'\bwrangler\s+(d1\s+)?delete\b', s):
        deny("Blocked: deleting a Worker or D1 database.")
    if re.search(r'\bd1\s+execute\b', s) and '--remote' in s and not re.search(r'--env[\s=]+(preview|staging)', s) and not re.search(r'(^|\s)(-c|--config)[\s=]+', s):
        if re.search(r'\b(drop|truncate|alter\s+table|delete\s+from|update\s+[a-z_]+\s+set)\b', s):
            deny("Blocked: destructive SQL against the production D1 binding. Reads are fine; mutations go through the application or the user.")
PY
