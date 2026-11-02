# Preferences Config File Detection and Repair

## Old Implementation

The data recovery UI could import and export full snapshots, but could not separately determine whether a Preferences DataStore config file was already corrupted. PR #1006 bound config recovery to the app startup flow, which was too broad in scope.

## Intent of the Change

- Only trigger config checks and repairs manually by the user from the data recovery UI
- Copy each existing Preferences config file to an isolated directory before verifying its readability
- Do not replace the existing DataStore owner, and do not add detection or repair to the normal app startup chain
- Only list config files that definitely cannot be decoded as repairable issues
- Before deleting an unreadable config file, first save it as a standalone ZIP, so the next normal access lets the existing DataStore create a clean config
- Do not modify the original file on path anomalies, file copy failures, or when the process state cannot be confirmed

## Expected Results

Users can confirm both config file and Room database status from the same "Config and Database Detection" entry. Config repair never runs in the background or during startup, and every reset has a traceable copy of the original.

[DONE]
