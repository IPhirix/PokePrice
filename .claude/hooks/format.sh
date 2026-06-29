#!/usr/bin/env bash
FILE=$(python -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then exit 0; fi

EXT="${FILE##*.}"

case "$EXT" in
  js|jsx|ts|tsx|json|css|html)
    npx prettier --write "$FILE" 2>/dev/null || true
    ;;
  rs)
    rustfmt "$FILE" 2>/dev/null || true
    ;;
  py)
    ruff format "$FILE" 2>/dev/null || true
    ;;
esac
exit 0
