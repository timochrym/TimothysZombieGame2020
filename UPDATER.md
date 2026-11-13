---
name: Zombie Game
window_title: Zombie Game Control Panel
folder_name: TimothysZombieGame2020
marker: index.html
branch: main
source_url: https://github.com/timochrym/TimothysZombieGame2020.git
open: index.html
build:
generated:
publish_files:
publish_folders:
publish_folder_file: .user-folder
server: on
server_port: 8000
deps_file:
auto_update_file: .auto-update
send_on_update: off
keep_restore_points: 30
commit_name:
commit_email:
addons: updater_addons
updater_source: https://github.com/timochrym/Updater.git
updater_ref:
updater_min: 2.8.0
# Project manifest (drafted 2026-11-13). The Control Panel does not read these yet; people and agents do.
# DRAFT: please confirm the value(s) of: done
type: product
goal: One engine, eight browser games with a shared arcade hub
output: index.html (vanilla JS canvas game, no build step)
done: tests/ pass (command not named yet; the arena_mix test is flaky)
review_repo: timochrym/Universal_Apps
review_dir: reviews/TimothysZombieGame2020
---

# UPDATER.md

This file tells the shared Control Panel how to look after this project. Copy it to the project's
root folder, edit the lines between the `---` markers, and keep the launcher files beside it.
One `key: value` per line. A blank value means "not used". Lists are separated by commas.

| Key | What it does |
| :--- | :--- |
| `name` | The name shown in the window. |
| `window_title` | The window's title, in full (default: `<name> Control Panel`), for example `My Project Control Dashboard`. It is what the taskbar, the Dock and the window switcher show. |
| `folder_name` | The folder a **Fresh install** creates (defaults to `name`). |
| `marker` | A file that proves a folder really is this project. **Delete** refuses folders without it. |
| `branch` | The version line to follow when none is linked. |
| `source_url` | Where **Fresh install** downloads the project from. |
| `open` | What the **Open** button opens (a file in the project). |
| `build` | A script to run after each update, for example `bundle.py`. It is run with Python. |
| `generated` | Files the build writes. They are never counted as your edits, and the update may replace them. |
| `publish_files`, `publish_folders` | Copied into the shared folder (see **Share a copy in a folder**) after each update. |
| `publish_folder_file` | The file that remembers the shared folder (keep it in `.gitignore`). |
| `server` | `on` shows the **Start / Stop / Restart server** buttons. |
| `server_port` | The port to try first. |
| `deps_file` | A `requirements.txt`; **Refresh** and **Fresh install** put its packages in `.venv`. |
| `auto_update_file` | If this file exists, the window updates on its own while it is open (Settings, Automatic updates). |
| `send_on_update` | `on`: Update also sends the changes made on this computer. Each computer can change it in Settings. |
| `keep_restore_points` | How many restore points to keep on each computer (default 30). |
| `commit_name`, `commit_email` | Who saved changes are signed by on a computer where git has no name yet (default: the computer's user name). |
| `updater_source` | Where the shared Control Panel itself is downloaded from. |
| `addons` | A folder of the project's own Python add-ons (default `updater_addons`). See "Add-ons" below. |
| `updater_ref` | A tag or branch of the shared Control Panel to stay on. Empty means the latest. |
| `updater_min` | The oldest Control Panel this project works with, e.g. `2.0.0`. An older downloaded copy is refreshed at once instead of within six hours. |

## Add-ons (a project's own steps)

A project keeps what is special to it in `updater_addons/*.py` (or the folder `addons:` names). The shared
Control Panel stays one copy for everybody; the add-on rides along in the project. Each file defines:

```python
def register(api):
    # A button on the Extras page (+ `--run audit`). group= is its heading there; home=True also puts it on Home.
    api.command('audit', run_audit, label='Run audit', help='Run the project checks', group='Checks')
    api.hook('update', sync_update)          # replaces Update; return True/False, or None to use the normal one
    api.hook('after_update', say_done)       # also: before_update, open, start
    api.hook('resolve', merge_by_meaning)    # a file changed on both sides: return the merged text, or None to keep both
```

`group=` and `home=` need engine 2.0. To stay loadable by an older engine, check `getattr(api, 'version', '1')` first
(an older engine rejects unknown keywords and the `resolve` event, and skips an add-on that raises).

Every function is `func(project, ctx)` (`ctx.log/ok/warn/err`, `ctx.run([...], cwd=...)`; update hooks also get
`check_only=`, `after_update` gets `ok=`, `start` gets `share=`, `resolve` gets `path, mine=, latest=` — the index stages
holding your side and the latest, read with `project.blob(':%d:%s' % (mine, path))`). `project.root` is the project folder.
A broken add-on is logged and skipped, so it can never stop the Control Panel from updating.
`python control_panel.py --list-addons` lists them; `--run NAME` runs one without a window.
