#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

IPA_NAME="RaceWarsTrackerv2.0.ipa"
echo "==> 1. Sincronizando recursos web..."
python3 "$ROOT_DIR/scripts/prepare-web.py"

echo "==> 2. Preparando bundle de la aplicación iOS..."
TMP_DIR=$(mktemp -d /tmp/rwt_ipa_XXXXXX)
trap "rm -rf '$TMP_DIR'" EXIT

BASE_IPA="$ROOT_DIR/RaceWarsTracker-6.ipa"
if [ ! -f "$BASE_IPA" ]; then
  BASE_IPA="$ROOT_DIR/RaceWarsTrackerv2.0.ipa"
fi

unzip -q "$BASE_IPA" -d "$TMP_DIR"

echo "==> 3. Inyectando assets web actualizados..."
rm -rf "$TMP_DIR/Payload/App.app/public"/*
cp -r "$ROOT_DIR/ios/App/App/public"/* "$TMP_DIR/Payload/App.app/public/"

# Actualizar nombre y versión en Info.plist
plutil -replace CFBundleDisplayName -string "Race Wars Tracker v2.0" "$TMP_DIR/Payload/App.app/Info.plist" 2>/dev/null || true
plutil -replace CFBundleShortVersionString -string "2.0.0" "$TMP_DIR/Payload/App.app/Info.plist" 2>/dev/null || true

echo "==> 4. Limpiando firmas antiguas para sideloading (AltStore, Sideloadly, TrollStore)..."
rm -rf "$TMP_DIR/Payload/App.app/_CodeSignature"
find "$TMP_DIR/Payload/App.app/Frameworks" -type d -name "_CodeSignature" -exec rm -rf {} + 2>/dev/null || true

echo "==> 5. Empaquetando $IPA_NAME..."
cd "$TMP_DIR"
zip -r -q "$ROOT_DIR/$IPA_NAME" Payload

echo "✅ IPA compilada y empaquetada con éxito:"
echo "   -> $ROOT_DIR/$IPA_NAME ($(ls -lh "$ROOT_DIR/$IPA_NAME" | awk '{print $5}'))"
