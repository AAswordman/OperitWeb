# Android Slider

## Old Implementation

Classic used a `SettingSliderItem` with a numeric input box, while Agent used the default Material `Slider` with a number shown on the right. Neither control had real mapping labels, and they shared no visual implementation.

## New Implementation

The shared `ThinkingQualitySlider` uses a Material 3 `Slider` with a custom track and thumb:

- Five discrete positions, internally still mapped to the global level
- Inside a 20dp transparent outer frame, draw a 16dp active track, a 12dp circular thumb, and a 4dp stop indicator
- Provider mapping text is shown below the track
- Step labels share the stop indicator's 10dp endpoint inset and equidistant anchor points, with maximum width adjusted to the spacing between adjacent steps
- Labels display at most two lines, staying within the container bounds on narrow screens and with enlarged fonts
- The current provider value is shown on the right side of the title
- Provider parameter names are not shown in the UI
- The active track is drawn only from the start to the current step; the right side stays transparent and shows only unselected step dots
- Gradient and thumb highlight are both derived from the current custom theme color, with no fixed color values
- The thumb is fully embedded in the active track, with no outer ring or shadow drawn
- The shimmer only plays inside the active track while dragging, and stops on release
- Animation stops when thinking mode is off or reduced motion is enabled
