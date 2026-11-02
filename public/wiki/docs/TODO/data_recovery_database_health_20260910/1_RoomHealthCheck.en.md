# Room Health Check

## Old Implementation

The data recovery UI only allowed the user to manually enter SQL. When the database could not be opened normally, the user had no structured diagnostic results.

## Modification Intent

- Check whether `app_database` is a regular file
- Use a SQLite corruption handler that does not proactively delete the damaged source
- Execute `PRAGMA quick_check`, `PRAGMA user_version`, and `PRAGMA foreign_key_check`
- Check the path types and sizes of WAL, SHM, and journal files
- After the main process has stopped and the basic SQLite checks have passed, verify the complete Room schema and migration chain on an isolated copy
- Model the results as explicit health levels and check items
- Display the report below the SQL executor

## Expected Results

Users can confirm the current state of the database without executing custom SQL, and know whether there is a definite way to handle the problem.

[DONE]
