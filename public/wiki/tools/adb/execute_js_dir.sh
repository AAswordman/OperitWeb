#!/bin/bash

set -euo pipefail

# Execute a JS function from a whole directory (supports require()) via ADB.
#
# Usage:
#   ./execute_js_dir.sh <suite_dir> [entry_js_rel_path] [function_name] [parameters_JSON|@params_file] [env_file_path]
#
# Examples:
#   ./tools/adb/execute_js_dir.sh app/src/androidTest/js com/ai/assistance/operit/util/ttscleaner/ttscleaner.js run '{}'
#   ./tools/adb/execute_js_dir.sh app/src/androidTest/js com/ai/assistance/operit/util/ttscleaner/ttscleaner.js run @params.json
#
# Notes:
# - Inline JSON is written into a temp file then pushed to device.
# - If env_file_path is omitted, tries <suite_dir>/.env.local
# - Bundles the entry with esbuild first, so shared local modules work without app-side module loading.
# - set OPERIT_RESULT_WAIT_SECONDS to customize result wait, default is 15 seconds

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <suite_dir> [entry_js_rel_path] [function_name] [parameters_JSON|@params_file] [env_file_path]"
  exit 1
fi

SUITE_DIR="$1"
ENTRY_REL="${2:-main.js}"
FUNCTION_NAME="${3:-run}"
PARAMS_ARG="${4:-{}}"
ENV_FILE_PATH="${5:-}"

RESULT_WAIT_SECONDS="${OPERIT_RESULT_WAIT_SECONDS:-15}"

if [ ! -d "$SUITE_DIR" ]; then
  echo "Error: Suite directory does not exist - $SUITE_DIR"
  exit 1
fi

if [ ! -f "$SUITE_DIR/$ENTRY_REL" ]; then
  echo "Error: Entry file does not exist - $SUITE_DIR/$ENTRY_REL"
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "Error: ADB command not found."
  exit 1
fi

resolve_app_package() {
  # Resolve the app before creating remote paths so directory execution targets the selected APK.
  local configured_package="${OPERIT_APP_PACKAGE:-}"
  local candidate

  if [ -n "$configured_package" ]; then
    case "$configured_package" in
      com.ai.assistance.operit.debug|com.ai.assistance.operit)
        ;;
      *)
        echo "Error: Unsupported Operit application package - $configured_package"
        return 1
        ;;
    esac
    if ! adb -s "$DEVICE_SERIAL" shell pm list packages "$configured_package" |
      tr -d '\r' | grep -Fxq "package:$configured_package"; then
      echo "Error: Operit application package is not installed - $configured_package"
      return 1
    fi
    APP_PACKAGE="$configured_package"
  else
    APP_PACKAGE=""
    for candidate in \
      com.ai.assistance.operit.debug \
      com.ai.assistance.operit
    do
      if adb -s "$DEVICE_SERIAL" shell pm list packages "$candidate" |
        tr -d '\r' | grep -Fxq "package:$candidate"; then
        APP_PACKAGE="$candidate"
        break
      fi
    done
    if [ -z "$APP_PACKAGE" ]; then
      echo "Error: Neither supported Operit application package is installed"
      return 1
    fi
  fi

  EXECUTE_JS_ACTION="com.ai.assistance.operit.EXECUTE_JS"
  SCRIPT_EXECUTION_RECEIVER="${APP_PACKAGE}/.core.tools.javascript.ScriptExecutionReceiver"
  echo "Using Operit application package: $APP_PACKAGE"
}

echo "Checking connected devices..."
mapfile -t DEVICE_LIST < <(adb devices | awk 'NR>1 && $2=="device" {print $1}')
DEVICE_COUNT=${#DEVICE_LIST[@]}
if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "Error: No authorized devices found"
  exit 1
fi

if [ "$DEVICE_COUNT" -eq 1 ]; then
  DEVICE_SERIAL="${DEVICE_LIST[0]}"
  echo "Using the only connected device: $DEVICE_SERIAL"
else
  while true; do
    echo "Multiple devices detected:"
    for ((i = 0; i < DEVICE_COUNT; i += 1)); do
      echo "  $((i + 1)). ${DEVICE_LIST[$i]}"
    done
    read -r -p "Select device (1-$DEVICE_COUNT): " CHOICE
    if ! [[ "$CHOICE" =~ ^[0-9]+$ ]]; then
      echo "Invalid input. Numbers only."
      continue
    fi
    if [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt "$DEVICE_COUNT" ]; then
      echo "Invalid choice."
      continue
    fi
    DEVICE_SERIAL="${DEVICE_LIST[$((CHOICE - 1))]}"
    echo "Selected device: $DEVICE_SERIAL"
    break
  done
fi

if ! resolve_app_package; then
  exit 1
fi

SUITE_NAME="$(basename "$SUITE_DIR")"
TARGET_BASE="/sdcard/Android/data/$APP_PACKAGE/js_temp"
TARGET_SUITES_DIR="$TARGET_BASE/suites"
TARGET_RESULT_FILE="$TARGET_BASE/${SUITE_NAME}_${FUNCTION_NAME}_$RANDOM.json"
BUNDLED_FILE="$(mktemp "${TMPDIR:-/tmp}/operit_js_bundle.XXXXXX.js")"

npx esbuild "$SUITE_DIR/$ENTRY_REL" --bundle --format=cjs --platform=neutral --outfile="$BUNDLED_FILE" --log-level=error || {
  rm -f "$BUNDLED_FILE"
  echo "Error: Failed to bundle entry script with esbuild"
  exit 1
}

echo "Preparing device directory..."
adb -s "$DEVICE_SERIAL" shell mkdir -p "$TARGET_SUITES_DIR"
TARGET_ENTRY_FILE="$TARGET_SUITES_DIR/$(basename "$BUNDLED_FILE")"

echo "Pushing bundled entry [$BUNDLED_FILE] to device..."
adb -s "$DEVICE_SERIAL" push "$BUNDLED_FILE" "$TARGET_ENTRY_FILE"
rm -f "$BUNDLED_FILE"

if [ -z "$ENV_FILE_PATH" ] && [ -f "$SUITE_DIR/.env.local" ]; then
  ENV_FILE_PATH="$SUITE_DIR/.env.local"
fi

HAS_ENV_FILE=false
TARGET_ENV_FILE=""
if [ -n "$ENV_FILE_PATH" ] && [ -f "$ENV_FILE_PATH" ]; then
  TARGET_ENV_FILE="$TARGET_BASE/$(basename "$ENV_FILE_PATH")"
  echo "Pushing env file [$ENV_FILE_PATH] to device..."
  adb -s "$DEVICE_SERIAL" push "$ENV_FILE_PATH" "$TARGET_ENV_FILE"
  HAS_ENV_FILE=true
fi

PARAMS_PREVIEW="$PARAMS_ARG"
PARAMS_LOCAL_TEMP=false
LOCAL_PARAMS_FILE=""
if [[ "$PARAMS_ARG" == @* ]]; then
  LOCAL_PARAMS_FILE="${PARAMS_ARG#@}"
  if [ ! -f "$LOCAL_PARAMS_FILE" ]; then
    echo "Error: Params file does not exist - $LOCAL_PARAMS_FILE"
    exit 1
  fi
else
  PARAMS_LOCAL_TEMP=true
  LOCAL_PARAMS_FILE="$(mktemp "${TMPDIR:-/tmp}/operit_js_params.XXXXXX.json")"
  printf '%s' "$PARAMS_ARG" > "$LOCAL_PARAMS_FILE"
fi

TARGET_PARAMS_FILE="$TARGET_BASE/$(basename "$LOCAL_PARAMS_FILE" .json)_$RANDOM.json"
echo "Pushing params [$PARAMS_PREVIEW] to device..."
adb -s "$DEVICE_SERIAL" push "$LOCAL_PARAMS_FILE" "$TARGET_PARAMS_FILE"

if [ "$PARAMS_LOCAL_TEMP" = "true" ]; then
  rm -f "$LOCAL_PARAMS_FILE" || true
fi

adb -s "$DEVICE_SERIAL" shell rm -f "$TARGET_RESULT_FILE"

echo "Executing [$FUNCTION_NAME] from [$TARGET_ENTRY_FILE] ..."
if [ "$HAS_ENV_FILE" = "true" ]; then
  adb -s "$DEVICE_SERIAL" shell "am broadcast -a $EXECUTE_JS_ACTION -n $SCRIPT_EXECUTION_RECEIVER --include-stopped-packages --es file_path '$TARGET_ENTRY_FILE' --es function_name '$FUNCTION_NAME' --es params_file_path '$TARGET_PARAMS_FILE' --es env_file_path '$TARGET_ENV_FILE' --es result_file_path '$TARGET_RESULT_FILE' --ez temp_params_file true --ez temp_env_file true"
else
  adb -s "$DEVICE_SERIAL" shell "am broadcast -a $EXECUTE_JS_ACTION -n $SCRIPT_EXECUTION_RECEIVER --include-stopped-packages --es file_path '$TARGET_ENTRY_FILE' --es function_name '$FUNCTION_NAME' --es params_file_path '$TARGET_PARAMS_FILE' --es result_file_path '$TARGET_RESULT_FILE' --ez temp_params_file true"
fi

echo "Waiting up to ${RESULT_WAIT_SECONDS}s for structured result..."
START_TIME="$(date +%s)"
while true; do
  if adb -s "$DEVICE_SERIAL" shell "if [ -f '$TARGET_RESULT_FILE' ]; then echo __READY__; fi" | grep -q "__READY__"; then
    break
  fi
  NOW_TIME="$(date +%s)"
  if [ $((NOW_TIME - START_TIME)) -ge "$RESULT_WAIT_SECONDS" ]; then
    echo "Error: Timed out waiting for result file: $TARGET_RESULT_FILE"
    exit 1
  fi
  sleep 1
done

echo "Structured execution result:"
adb -s "$DEVICE_SERIAL" shell "cat '$TARGET_RESULT_FILE'"
adb -s "$DEVICE_SERIAL" shell rm -f "$TARGET_RESULT_FILE"
