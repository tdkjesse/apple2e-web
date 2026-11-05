# Apple2JS migration (work branch)

Source: https://github.com/whscullin/apple2js
License: MIT; retain upstream LICENSE and attribution.

The previous emulator is preserved at `archive/homegrown-emulator`. This branch is for replacing the core, not modifying the archived implementation.

## Baseline strategy

1. Import a pinned upstream Apple2JS revision, including its project files, without adding ROMs or commercial disk images.
2. Keep the upstream Apple IIe browser entrypoint (`apple2jse.html`) working before adapting the interface.
3. Install dependencies and run upstream tests/build; record any failures, particularly on Android Termux.
4. Test the user's locally supplied Might and Magic Side A in the unchanged upstream emulator before customizing it.
5. After the baseline passes, adapt the touchscreen keyboard, local disk mounting, disk swaps, speed and sound controls.

## Important differences

Upstream currently uses Webpack and Jest, not this project's Vite/Vitest scripts. Do not assume the old `npm run dev` works after import. Upstream README specifies `npm start` and `http://localhost:8080/apple2jse.html`.

## Local import (when ready)

The upstream source should be imported as an actual source tree, not copied from a hosted/minified bundle. Keep LICENSE and preserve a record of the upstream commit SHA. Never commit personal ROM files or copyrighted game disks.
