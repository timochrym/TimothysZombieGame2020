# Headless checks

Need Node and Playwright (`npm i -D playwright` once, or a global install). Run from this folder:

    node siege_rest.js          # Ragdoll Siege: 5 bodies into every fort, then 6 s idle -> expects 0 bounces / 0 idle deaths
    node siege_rest.js birds    # same in Birds mode

    node zombieball_seats.js    # Zombie Ball ball is a real ragdoll, tackles ragdoll; Players panel seat toggles
    node studio.js              # Level Studio: place, drag, inspector, undo/redo, save, play-test and back
    node players.js             # Players panel: line-up formats and the who-is-who summary
    node gamepad.js             # fake pads: Arcade, pad 3 takes a CPU seat, build mode, punch, pause
    node course_select.js       # course / room / chamber select in Parkour, Crate Lab, Portal Lab, Wobble Wheels
    node lan_play.js            # starts server.js on 8099: a host + 2 joiners, positions match, client FPS

Each prints its numbers and then the page errors (`[]` = none). See ROADMAP.md, "Your named feedback items".

`lib.js` opens the game headless and restores the native `Object` helpers the engine's `class Object` shadows.
