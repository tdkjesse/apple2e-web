# Apple IIe Web — Apple2JS migration

This branch uses the MIT-licensed [Apple2JS](https://github.com/whscullin/apple2js) emulator as a pinned Git submodule at `vendor/apple2js` (revision `ee0aed25f73c69d0245e86a2a5fccb3324c3056c`). The previous homegrown emulator is preserved on `archive/homegrown-emulator`; the original `main` branch is untouched.

## Run the upstream Apple IIe emulator

```sh
git switch migration/apple2js
git submodule update --init --recursive
cd vendor/apple2js
npm install
npm start
```

Open http://127.0.0.1:8080/apple2jse.html (or the address reported by the upstream dev server). For Android Termux, npm dependencies with native modules may require additional platform tooling. Run `npm test` and `npm run build` in `vendor/apple2js` to validate. Do not use the previous Vite URL or `npm run dev`.

**Important:** This branch has not yet been verified to boot the user's Might and Magic disk. Load ROMs and game disk images locally only. Do not commit copyrighted ROMs or game disk files. Preserve upstream MIT license notices when distributing modified code.
