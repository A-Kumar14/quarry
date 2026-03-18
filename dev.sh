#!/usr/bin/env bash
# dev.sh — opens two Terminal windows side-by-side: backend (left) | frontend (right)

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Free port 8000 if something is already holding it
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
sleep 0.8

BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
PYTHON="$BACKEND_DIR/.venv/bin/python3"

osascript - "$BACKEND_DIR" "$FRONTEND_DIR" "$PYTHON" <<'APPLESCRIPT'
on run argv
  set backendDir  to item 1 of argv
  set frontendDir to item 2 of argv
  set pythonBin   to item 3 of argv

  set backendCmd  to "cd " & quoted form of backendDir & " && " & quoted form of pythonBin & " main.py"
  set frontendCmd to "cd " & quoted form of frontendDir & " && npm start"

  -- Get screen dimensions
  tell application "Finder"
    set screenBounds to bounds of window of desktop
    set screenW to item 3 of screenBounds
    set screenH to item 4 of screenBounds
  end tell

  set half to screenW div 2
  set menuBar to 38 -- approximate height of macOS menu bar

  tell application "Terminal"
    activate
    delay 0.3

    -- Backend window — left half
    do script backendCmd
    delay 0.2
    set backWin to front window
    set bounds of backWin to {0, menuBar, half, screenH}
    set custom title of selected tab of backWin to "Backend"

    -- Frontend window — right half
    do script frontendCmd
    delay 0.2
    set frontWin to front window
    set bounds of frontWin to {half, menuBar, screenW, screenH}
    set custom title of selected tab of frontWin to "Frontend"
  end tell
end run
APPLESCRIPT
