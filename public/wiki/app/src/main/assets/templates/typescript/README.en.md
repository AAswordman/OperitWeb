# Operit TypeScript Project

This is a TypeScript + pnpm project created with Operit.

## Quick Start

### 1. Install Dependencies
```bash
Click the "pnpm install" button
```

### 2. Development Mode (Live Compilation)
```bash
Click the "tsc watch" button
# TypeScript will automatically watch file changes and compile
```

### 3. Build the Project
```bash
Click the "pnpm build" button
```

### 4. Run the Project
```bash
Click the "pnpm start" button
Then click "Browser Preview" to view the result
```

## Project Structure

```
.
├── src/
│   └── index.ts          # TypeScript source code
├── dist/                 # Build output directory
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
└── .operit/config.json   # Operit workspace configuration
```

## Tech Stack

- 🔷 **TypeScript** - Type-safe JavaScript superset
- 📦 **pnpm** - Fast, disk-space-saving package manager
- 🟢 **Node.js** - JavaScript runtime

## Why Choose pnpm?

- ⚡ Faster install speed
- 💾 Saves disk space (hard links share dependencies)
- 🔒 Strict dependency management
- 🎯 Compatible with npm/yarn commands

## Common Commands

- `pnpm install` - Install dependencies
- `pnpm build` - Compile TypeScript
- `tsc watch` - Watch mode compilation
- `pnpm start` - Run the compiled code

## Development Tips

- TypeScript source code goes in the `src/` directory
- Compiled JavaScript is in the `dist/` directory
- Code changes need to be recompiled
- Watch mode compiles automatically

Happy Coding with TypeScript! 🎉
