#!/bin/zsh
set -e

SCRIPT_DIR=${0:A:h}
LIBRARY="/Users/gao/Desktop/TOOLS"

/usr/bin/python3 "$SCRIPT_DIR/dashboard_panel.py" --root "$LIBRARY"
/usr/bin/open "$LIBRARY/dashboard/static.html"
