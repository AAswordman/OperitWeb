# Mapping Contract

## Old Implementation

OpenAI, Gemini, DeepSeek, NVIDIA, SiliconFlow, and OpenRouter each keep their own mapping from global levels to request parameters inside the provider, and the UI cannot read the same description.

## New Implementation

`ThinkingQualityMapping` describes the control type, parameter name, and each internal level's display value and wire value. Both provider request building and the UI obtain the definitions through `ThinkingQualityMappingRegistry`.

Each level keeps an independent position, even when multiple levels use the same wire value. The UI only displays `displayLabel`, while internal requests continue to use the typed `wireValue`.

Providers without a level parameter explicitly use `TOGGLE_ONLY`, and the UI does not guess level meanings.

