# DataStore Domain Repair

## Old Implementation

`PreferencesHealthManager` only handles `CorruptionException`. Logical corruption does not enter the repair plan.

## Change Intent

- Run idempotent domain validation on a readable copy
- Repair order: `model_configs` → `user_preferences` → `functional_configs` → `character_cards` → `character_groups`, with `api_settings` independent
- When validation does not converge, stop writing and keep the original ZIP
- Unknown future JSON fields are kept while the record is still usable

## Expected Result

Users can perform, in data recovery, a repair of a readable but logically corrupted DataStore through the same entry point as file reset, without entering the app startup chain.

