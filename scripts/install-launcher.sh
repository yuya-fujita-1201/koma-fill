#!/bin/zsh
set -euo pipefail

APP_NAME="Koma Fill.app"
SOURCE_APP=""

if [[ -d "release/mac-arm64/${APP_NAME}" ]]; then
  SOURCE_APP="release/mac-arm64/${APP_NAME}"
elif [[ -d "release/mac/${APP_NAME}" ]]; then
  SOURCE_APP="release/mac/${APP_NAME}"
else
  echo "Built app not found under release/." >&2
  exit 1
fi

TARGET_APP="/Applications/${APP_NAME}"

osascript -e 'quit app "Koma Fill"' >/dev/null 2>&1 || true
sleep 1
rm -rf "${TARGET_APP}"
ditto "${SOURCE_APP}" "${TARGET_APP}"
echo "Installed ${TARGET_APP}"
