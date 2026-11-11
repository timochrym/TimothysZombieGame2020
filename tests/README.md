# Headless checks

Need Node and Playwright (`npm i -D playwright` once, or a global install). Run from this folder:

    node siege_rest.js          # Ragdoll Siege: 5 bodies into every fort, then 6 s idle -> expects 0 bounces / 0 idle deaths
    node siege_rest.js birds    # same in Birds mode

    node zombieball_seats.js    # Zombie Ball ball is a real ragdoll, tackles ragdoll; Players panel seat toggles
    node studio.js              # Level Studio: place, drag, inspector, undo/redo, save, play-test and back
    node players.js             # Players panel: line-up formats and the who-is-who summary
    node gamepad.js             # fake pads: Arcade, pad 3 takes a CPU seat, build mode, punch, pause
    node course_select.js       # course / room / chamber select in Parkour, Crate Lab, Portal Lab, Wobble Wheels
    node brawl_bomb.js          # Brawl: a bomb drops, P1 grabs and throws it, it hurts the CPU and not the thrower
    node bedbrawl_fireball.js   # Bed Brawl: buy a fireball, it flies level and blasts a 4-block wall
    node table_cannons.js       # Table Games: a Hill Cannons match vs the hard CPU plays to a winner
    node wheels_vehicles.js     # Wobble Wheels: trolley and scooter ride Hill Hop (distance, upright, crash)
    node crash_cliff.js         # Crash Lab: scenario menu cycles, Cliff Fall scores a push and saves the best
    node bedbrawl_egg.js        # Bed Brawl: a bridge egg lays a walkable bridge level with your feet
    node brawl_gearworks.js     # Brawl: the Gearworks stage loads, its lift moves, a fight runs
    node brawl_bat.js           # Brawl: the bat drops, is picked up, a swing launches the CPU
    node word_rooms.js          # Word Lab rooms 6-8: unsolvable by walking, solved by their word
    node word_tower_fly.js      # Word Lab: "fly", climb, steer over the tower, get the star
    node word_pets.js           # Word Lab: dog / cat / bird follow the hero, the dog bites a zombie
    node lan_buttons.js         # LAN through the real buttons: Host, Join, host picks a game, joiner is in it
    node touch_phone.js         # touch controls on an emulated phone: Arcade tap, walk, shoot, pause
    node lan_phone.js           # a phone joins a LAN game by tapping and moves its hero with the touch buttons
    node brawl_moves.js         # Brawl: each hero's E move (shockwave, uppercut, slam, rocket punch) hits a CPU
    node table_pool.js          # Table Games: Pocket Race break by mouse, a full match vs the hard CPU
    node wheels_pogo.js         # Wobble Wheels: the pogo stays upright, hops and travels
    node table_darts.js         # Table Games: a full Sway Darts match vs the CPU
    node lan_play.js            # starts server.js on 8099: a host + 2 joiners, positions match, client FPS

Each prints its numbers and then the page errors (`[]` = none). See ROADMAP.md, "Your named feedback items".

`lib.js` opens the game headless and restores the native `Object` helpers the engine's `class Object` shadows.
