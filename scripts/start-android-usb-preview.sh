#!/usr/bin/env zsh

set -euo pipefail

cd "$(dirname "$0")/.."

adb start-server >/dev/null
adb wait-for-device
adb reverse tcp:8081 tcp:8081

echo "USB reverse ready. Starting Expo on localhost:8081..."
exec npx expo start --localhost --clear
