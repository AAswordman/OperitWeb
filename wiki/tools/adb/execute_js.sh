#!/bin/bash

# Check parameters
if [ -z "${1:-}" ]; then
    echo "Usage: $0 <JS_file_path> [function_name] [parameters_JSON|@params_file] [env_file_path]"
    echo "Example: $0 example.js"
    echo "Example: $0 example.js main"
    echo "Example: $0 example.js main '{\"name\":\"John\"}'"
    echo "Example: $0 example.js main @params.json"
    echo "Example: $0 example.js main '{}' .env.local"
    echo "Note: set OPERIT_RESULT_WAIT_SECONDS to customize result wait, default is 15 seconds"
    exit 1
fi

# Parameters
FILE_PATH="$1"
if [ -z "${2:-}" ]; then
    FUNCTION_NAME="main"
    PARAMS_ARG="{}"
    ENV_FILE_PATH=""
else
    FUNCTION_NAME="$2"
    if [ -z "${3:-}" ]; then
        PARAMS_ARG="{}"
        ENV_FILE_PATH="${4:-}"
    else
        PARAMS_ARG="$3"
        ENV_FILE_PATH="${4:-}"
    fi
fi

if [ -z "${OPERIT_RESULT_WAIT_SECONDS:-}" ]; then
    RESULT_WAIT_SECONDS=15
else
    RESULT_WAIT_SECONDS="$OPERIT_RESULT_WAIT_SECONDS"
fi

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    echo "Error: File does not exist - $FILE_PATH"
    exit 1
fi

# Check ADB availability
if ! command -v adb >/dev/null 2>&1; then
    echo "Error: ADB command not found."
    echo "Make sure Android SDK is installed and adb is in PATH"
    exit 1
fi

resolve_app_package() {
    # The receiver and js_temp directory are application-scoped; a fixed Release id breaks
    # execution against the Debug APK even when both APKs are installed.
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

# Device detection
echo "Checking connected devices..."
mapfile -t DEVICE_LIST < <(adb devices | awk 'NR>1 && $2=="device" {print $1}')
DEVICE_COUNT=${#DEVICE_LIST[@]}

if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo "Error: No authorized devices found"
    exit 1
fi

# Device selection
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
        if [ "$CHOICE" -lt 1 ]; then
            echo "Number too small"
            continue
        fi
        if [ "$CHOICE" -gt "$DEVICE_COUNT" ]; then
            echo "Number too large"
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

prepare_params_file() {
    PARAMS_PREVIEW="$PARAMS_ARG"
    PARAMS_LOCAL_TEMP=false

    if [[ "${PARAMS_ARG:-}" == @* ]]; then
        LOCAL_PARAMS_FILE="${PARAMS_ARG#@}"
        if [ ! -f "$LOCAL_PARAMS_FILE" ]; then
            echo "Error: Params file does not exist - $LOCAL_PARAMS_FILE"
            exit 1
        fi
        return
    fi

    LOCAL_PARAMS_FILE="$(mktemp "${TMPDIR:-/tmp}/operit_js_params.XXXXXX.json")"
    PARAMS_LOCAL_TEMP=true
    printf '%s' "${PARAMS_ARG:-{}}" > "$LOCAL_PARAMS_FILE"
}

cleanup_local_params() {
    if [ "${PARAMS_LOCAL_TEMP:-false}" = "true" ] && [ -n "${LOCAL_PARAMS_FILE:-}" ]; then
        rm -f "$LOCAL_PARAMS_FILE"
    fi
}

# File operations
echo "Creating directory structure..."
TARGET_DIR="/sdcard/Android/data/$APP_PACKAGE/js_temp"
adb -s "$DEVICE_SERIAL" shell mkdir -p "$TARGET_DIR"
TARGET_FILE="$TARGET_DIR/$(basename "$FILE_PATH")"
RESULT_STEM="$(printf "%s_%s_%s" "$(basename "$FILE_PATH")" "$FUNCTION_NAME" "$(date +%s)" | tr -c 'A-Za-z0-9._-' '_')"
TARGET_RESULT_FILE="$TARGET_DIR/${RESULT_STEM}.json"

echo "Pushing [$FILE_PATH] to device..."
adb -s "$DEVICE_SERIAL" push "$FILE_PATH" "$TARGET_FILE"
if [ $? -ne 0 ]; then
    echo "Error: Failed to push file"
    exit 1
fi

# Resolve env file path
if [ -z "$ENV_FILE_PATH" ]; then
    SCRIPT_DIR="$(dirname "$FILE_PATH")"
    if [ -f "$SCRIPT_DIR/.env.local" ]; then
        ENV_FILE_PATH="$SCRIPT_DIR/.env.local"
    fi
fi

TARGET_ENV_FILE=""
HAS_ENV_FILE=false
if [ -n "$ENV_FILE_PATH" ] && [ -f "$ENV_FILE_PATH" ]; then
    TARGET_ENV_FILE="$TARGET_DIR/$(basename "$ENV_FILE_PATH")"
    echo "Pushing env file [$ENV_FILE_PATH] to device..."
    adb -s "$DEVICE_SERIAL" push "$ENV_FILE_PATH" "$TARGET_ENV_FILE"
    if [ $? -ne 0 ]; then
        echo "Error: Failed to push env file"
        exit 1
    fi
    HAS_ENV_FILE=true
fi

prepare_params_file
TARGET_PARAMS_FILE="$TARGET_DIR/$(basename "$LOCAL_PARAMS_FILE" .json)_$(date +%s).json"

echo "Pushing params [$PARAMS_PREVIEW] to device..."
adb -s "$DEVICE_SERIAL" push "$LOCAL_PARAMS_FILE" "$TARGET_PARAMS_FILE"
if [ $? -ne 0 ]; then
    cleanup_local_params
    echo "Error: Failed to push params file"
    exit 1
fi

adb -s "$DEVICE_SERIAL" shell rm -f "$TARGET_RESULT_FILE"

# Execute JS function
echo "Executing [$FUNCTION_NAME] with params source: $TARGET_PARAMS_FILE"
if [ "$HAS_ENV_FILE" = "true" ]; then
    adb -s "$DEVICE_SERIAL" shell "am broadcast -a $EXECUTE_JS_ACTION -n $SCRIPT_EXECUTION_RECEIVER --include-stopped-packages --es file_path '$TARGET_FILE' --es function_name '$FUNCTION_NAME' --es params_file_path '$TARGET_PARAMS_FILE' --es env_file_path '$TARGET_ENV_FILE' --es result_file_path '$TARGET_RESULT_FILE' --ez temp_file true --ez temp_params_file true --ez temp_env_file true"
else
    adb -s "$DEVICE_SERIAL" shell "am broadcast -a $EXECUTE_JS_ACTION -n $SCRIPT_EXECUTION_RECEIVER --include-stopped-packages --es file_path '$TARGET_FILE' --es function_name '$FUNCTION_NAME' --es params_file_path '$TARGET_PARAMS_FILE' --es result_file_path '$TARGET_RESULT_FILE' --ez temp_file true --ez temp_params_file true"
fi
if [ $? -ne 0 ]; then
    cleanup_local_params
    echo "Error: Failed to send execution broadcast"
    exit 1
fi

cleanup_local_params

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
