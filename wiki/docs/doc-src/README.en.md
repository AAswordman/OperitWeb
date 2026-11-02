# doc-src

This is the single source of truth for project design, development, and feature documentation, maintained by topic so the current implementation and plans can be found quickly, and so i18n and the documentation site can be built.

## Directory Structure

- `architecture/`: overall architecture, core modules, and runtime flow design
- `dev-core/`: core development material, including build, contribution guide, and low-level interface descriptions
- `feature-protocol/`: specific features and protocol flows, such as intent triggers, tool calls, and chat import
- `package-dev/`: development notes for feature packages and business modules, also for users and their agents developing packages
- `research/`: research notes and technical verification results for external dependencies or APIs introduced or integrated
- `test-example/`: test examples, experiment records, and issue analysis for features in the project

## Documentation Maintenance

- When adding a document, place it in the best-matching topic directory and reflect its subject in the file name
- When a plan changes significantly, update the related design documents in sync to avoid documentation drifting from the current implementation
- Arrange documents, scripts, source code, and other files per project conventions, introducing a tagged index where necessary
- Before moving a file, be sure to check all documents and files with `rg` for references that depend on its relative location, and update them promptly
- It is recommended to use an Agent to move file locations (unless you know exactly what you are doing), and remember to explicitly prompt it to check all kinds of references and relative links
- Building the App should not directly depend on the relative locations of documents; it should first resolve appropriate metadata, or create it if there is none
- Never let a release build or CDN directly index project directory locations, as this severely limits future restructuring and reduces robustness

See the [Documentation Writing Guide](before_docing.en.md) for reference.
