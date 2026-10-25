#!/usr/bin/env bash
# Usage: scripts/build-android-local.sh debug|preview
# debug   prebuilds the development variant and runs assembleDebug (dev client APK, needs Metro).
# preview prebuilds the preview variant and runs assembleRelease signed with the debug keystore.
set -euo pipefail

variant="${1:-debug}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
mobile_dir="$repo_root/apps/mobile"

# Defaults are the standard install locations. Set ANDROID_HOME and JAVA_HOME yourself to override them.
if [ "$(uname)" = "Darwin" ]
then
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
else
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
  if [ -z "${JAVA_HOME:-}" ]
  then
    echo "Set JAVA_HOME to a JDK 21 install. Easier on Windows and WSL: npm run app:build:dev builds in the cloud (QUICKSTART.md)." >&2
    exit 1
  fi
fi

if [ ! -d "$ANDROID_HOME" ]
then
  echo "Android SDK not found at $ANDROID_HOME" >&2
  exit 1
fi
echo "JAVA_HOME=$JAVA_HOME"
"$JAVA_HOME/bin/java" -version

case "$variant" in
  debug)
    app_variant="development"
    gradle_task="assembleDebug"
    apk_glob="app/build/outputs/apk/debug/*.apk"
    ;;
  preview)
    app_variant="preview"
    gradle_task="assembleRelease"
    apk_glob="app/build/outputs/apk/release/*.apk"
    if [ -z "${EXPO_PUBLIC_API_BASE_URL:-}" ]
    then
      echo "Set EXPO_PUBLIC_API_BASE_URL to the deployed https API before a preview build" >&2
      exit 1
    fi
    ;;
  *)
    echo "Unknown variant $variant. Use debug or preview." >&2
    exit 1
    ;;
esac

cd "$mobile_dir"
APP_VARIANT="$app_variant" npx expo prebuild --platform android --clean --no-install
cd android
./gradlew "$gradle_task" --no-daemon
ls -lh $apk_glob
