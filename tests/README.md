# Headless checks

Need Node and Playwright (`npm i -D playwright` once, or a global install). Run from this folder:

    node siege_rest.js          # Ragdoll Siege: 5 bodies into every fort, then 6 s idle -> expects 0 bounces / 0 idle deaths
    node siege_rest.js birds    # same in Birds mode

`lib.js` opens the game headless and restores the native `Object` helpers the engine's `class Object` shadows.
