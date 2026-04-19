#!/bin/bash
# Download Google Fonts for PDF signature styling

set -e

FONTS_DIR="server/fonts"
mkdir -p "$FONTS_DIR"

echo "📥 Downloading DancingScript-Regular.ttf from Google Fonts..."
curl -L -o "$FONTS_DIR/DancingScript-Regular.ttf" \
  "https://github.com/google/fonts/raw/main/ofl/dancingscript/DancingScript-Regular.ttf"

if [ -f "$FONTS_DIR/DancingScript-Regular.ttf" ]; then
  echo "✅ DancingScript-Regular.ttf downloaded successfully ($(ls -lh "$FONTS_DIR/DancingScript-Regular.ttf" | awk '{print $5}'))"
else
  echo "❌ Failed to download DancingScript-Regular.ttf"
  exit 1
fi

echo "✅ All fonts ready!"
