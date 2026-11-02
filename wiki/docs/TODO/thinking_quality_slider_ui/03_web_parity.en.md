# Web Parity

## Old Implementation

Web Classic and Agent used a native `select` to display global numbers. The model-switching interface only refreshed the model selector, and the thinking mapping did not come back with the current model.

## New Implementation

`WebModelSelectorState` carries the current provider/model's `thinking_quality_mapping`. The shared Web slider renders labels from the mapping, while input settings still only save the current internal level.

Web uses a 20px transparent outer frame, a 16px active track, a 12px round thumb, and a 4px stop indicator. The active track only fills up to the current notch, with the right side kept transparent; the gradient and thumb highlight are both derived from the current custom theme variables. The CSS shimmer is only enabled while dragging and stops on release; animation is disabled under `prefers-reduced-motion`.

Notch labels use the same 10px endpoint inset and percentage anchors as the stop indicators, no longer using an equal-width Grid. Label maximum width is computed from notch spacing, and follows `--chat-font-scale` to keep a two-line height.

Provider parameter names are kept in the mapping data, but are not rendered as user-interface content.
