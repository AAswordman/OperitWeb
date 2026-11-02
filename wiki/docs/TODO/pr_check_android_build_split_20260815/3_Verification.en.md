# Verification and Fork Testing

## Static Verification

- Check workflow YAML and actionlint
- Run CI Python unit tests
- Check scope classification, job conditions, and `Candidate checks` aggregation logic

## Online Verification

- First push to the fork's `ci/split-android-pr-check` branch
- Create a test PR in the fork pointing at the fork's `main`, and observe whether the build/test jobs are independent
- Confirm that when the build job fails or the single-test job fails, the other still keeps its own result
- Confirm that PRs with no Android changes are not wrongly blocked
- After verification passes, the user decides whether to submit upstream

## Completed Verification

- Fork PR #15's Fast checks passed, including 46 CI gate unit tests and actionlint
- Fork PR #15's `Android build` job passed, with `assembleDebug` and the build report completed
- Fork PR #15's `Android JVM tests` job started independently and ran through Gradle test compilation
- `Candidate checks` correctly recorded `Android build=success` and `Android JVM tests=failure`
- The first round of JVM tests exposed pre-existing upstream test source errors, including `ProviderUsageCancellationTest.kt`,
  `RecordingSQLiteDriver.kt`, `TokenCanonicalTotalsTest.kt`, and `TokenCostCalculatorTest.kt`;
  imports and parameters have been completed, expired test fixtures removed, and log and Gemini usage test fixtures fixed
- After the fix, run `31835091374`'s `Android build` passed, with JVM tests leaving only
  3 cross-IO-dispatcher cancellation object-identity assertions in `ProviderUsageCancellationTest.kt`;
  changed to verifying cancellation message semantics, to avoid treating coroutine instance identity as a provider interface contract
- Fork PR #14's run `31839888120` fully passed: `Fast checks`, `Android JVM tests`,
  `Android build`, and `Candidate checks` were all success
- Trusted `Android Build` manual run passed, and uploaded Android reports and successful artifacts

This verification confirms that Android compilation is completed independently even when single tests fail, and that the latest run has verified JVM tests and
`Candidate checks` aggregation status.
