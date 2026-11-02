# Version Range Button State

Old implementation:

- The list already defined an `Unavailable(Warning)` download entry state, but it was not invoked for version ranges
- The details page only disabled the download button, while keeping the icon and color of a regular primary action

Changes:

- Determine whether the range is exceeded using `BuildConfig.VERSION_NAME` and the latest plugin version's minimum and maximum app versions
- When out of range, the list uses the warning unavailable icon, and the details page uses the warning icon and error color on the disabled button

Expected result:

Users can identify incompatible plugins before entering the details page, and the details page keeps a consistent risk prompt.

[DONE]
