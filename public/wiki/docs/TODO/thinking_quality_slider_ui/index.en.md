---
topic: Thinking quality slider UI
status: in_progress
---

# Thinking quality slider UI

## Original Situation

Android Classic and Agent used two duplicate thinking-level controls. The controls only displayed a global numeric level, and Classic also allowed editing the number; the providers' real mappings were scattered across their respective request-building code.

## Intent of the Fix

Use a Material 3 style discrete slider showing the real mapping text for the current provider, protocol, and model. Internally use the `thinking_option_id` string contract, no longer keeping global fixed level numbers.

The track's active region uses the theme primary color and a slow shimmer animation, accelerating while dragging, and animation is turned off when the system reduces motion effects.

## Scope

- Unify provider mapping descriptions and request parameter sources
- Refactor the two thinking-level controls in Android Classic and Agent
- Sync Web model selection state and the two Web input styles
- Each provider registers its own number of options; duplicate wire values are kept only when the protocol genuinely supports alias levels with different semantics
- Add tests and implementation records for the mapping contract

## Detailed Steps

1. Mapping contract
2. Android slider
3. Web sync
4. Verification records

## Completion Record

- [DONE] Provider mappings, Android/Web sliders, and theme primary color shimmer implemented
- [DONE] Remote Release build passed
- [DONE] Visual revision passed remote Release build
- [REJECTED] Early thumb/track ratio and gradient proposal failed visual acceptance
- [REJECTED] Early black thumb and full-width gradient proposal failed visual acceptance
- [WIP] Transparent outer frame, active-region-only fill, and inset highlight thumb passed Release build, awaiting visual acceptance
- [WIP] Android/Web level label responsive anchor layout passed Release build, awaiting visual acceptance
