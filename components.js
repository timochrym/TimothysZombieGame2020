class Components {

    static getMouseWorldPos() {
        var worldX = (mouseX - xc) / cameraScaleX;
        var worldY = (yc - mouseY) / cameraScaleY;
        return [worldX, worldY];
    }

    static directionArrow(object) {
        var arrowsBusy = (!multiplayer && (ULDRupPressed || ULDRdownPressed || ULDRleftPressed || ULDRrightPressed));
        if (object.playerIndex === 0 && object.isPlayer && (mouseDown || useMouseAim) && !arrowsBusy) {
            var mPos = Components.getMouseWorldPos();
            var mdx = mPos[0] - object.x;
            var mdy = mPos[1] - object.y;
            object.degreeToGoCW = (Math.degrees(Math.atan2(mdx, mdy)) + 360) % 360;
        } else if (object.upPressed && object.rightPressed) {
            object.degreeToGoCW = 45;
        } else if (object.downPressed && object.rightPressed) {
            object.degreeToGoCW = 135;
        } else if (object.downPressed && object.leftPressed) {
            object.degreeToGoCW = 225;
        } else if (object.upPressed && object.leftPressed) {
            object.degreeToGoCW = 315;
        } else if (object.upPressed) {
            object.degreeToGoCW = 0;
        } else if (object.rightPressed) {
            object.degreeToGoCW = 90;
        } else if (object.downPressed) {
            object.degreeToGoCW = 180;
        } else if (object.leftPressed) {
            object.degreeToGoCW = 270;
        }

        object.distanceCW = (object.degreeToGoCW - object.degree + 360) % 360;
        object.distanceCCW = (object.degree - object.degreeToGoCW + 360) % 360;

        if (Math.min(object.distanceCW, object.distanceCCW) > degreeSpeed * 1.5) {
            if (object.distanceCW <= object.distanceCCW) {
                object.degreeSpeedX += degreeSpeed;
            } else {
                object.degreeSpeedX -= degreeSpeed;
            }
        } else {
            object.degree = object.degreeToGoCW;
            object.degreeSpeedX *= 0.5;
        }

        if (object.degreeSpeedX != 0) {
            object.degreeSpeedX = Math.subtractToZero(object.degreeSpeedX, degreeSpeed * 0.55);
        }

        var maxDegSpeed = degreeSpeed * 5.5;
        if (object.degreeSpeedX > maxDegSpeed) object.degreeSpeedX = maxDegSpeed;
        if (object.degreeSpeedX < -maxDegSpeed) object.degreeSpeedX = -maxDegSpeed;

        object.degree = (object.degree + object.degreeSpeedX + 360) % 360;

    }

    static moveTypeFinder(object) {
        object.shootPressed = false;
        object.abilityPressed = false;
        object.mouseShooting = false;

        if (object.isPlayer && object.isCPU) {
            if (GameModes.has("cpuThink")) GameModes.call("cpuThink", object);
            else Brawl.cpuThink(object);
            return;
        }
        if (object.isPlayer && GameModes.flag("playerControl", true) === false) {
            object.leftPressed = object.rightPressed = object.upPressed = object.downPressed = false;
            return;
        }
        if (object.isPlayer && typeof brawl !== "undefined" && brawl.active && brawl.phase !== "fight") {
            // countdown / game over: nobody can move
            object.leftPressed = object.rightPressed = object.upPressed = object.downPressed = false;
            return;
        }
        if (object.isPlayer) {
            var inp = object.input;
            if (object.playerIndex === 0) {
                object.upPressed = WASDupPressed;
                object.downPressed = WASDdownPressed;
                object.leftPressed = WASDleftPressed;
                object.rightPressed = WASDrightPressed;
                object.abilityPressed = inp.interact;
                var isDraggingPalette = (typeof SummonManager !== "undefined" && SummonManager.paletteDragging);
                if (mouseDown && !isDraggingPalette && (typeof SummonManager === "undefined" || SummonManager.toolMode == "shoot")) {
                    if ((object.heldObject && !object.heldObject.dead) || object.heldRagdoll) {
                        var mPos = Components.getMouseWorldPos();
                        object.tryGrabOrThrow(mPos[0], mPos[1]);
                        mouseDown = false;
                    } else {
                        object.mouseShooting = true;
                        object.shootPressed = true;
                    }
                } else {
                    object.shootPressed = inp.shoot;
                }
            } else {
                object.upPressed = ULDRupPressed;
                object.downPressed = ULDRdownPressed;
                object.leftPressed = ULDRleftPressed;
                object.rightPressed = ULDRrightPressed;
                object.shootPressed = inp.shoot;
                object.abilityPressed = inp.interact;
            }
            // Controller (if connected): OR its stick/buttons into this hero's input
            var pad = (typeof Pads !== "undefined") ? Pads.state[object.playerIndex] : null;
            object.padAiming = false;
            if (pad && pad.active) {
                object.leftPressed = object.leftPressed || pad.left;
                object.rightPressed = object.rightPressed || pad.right;
                object.upPressed = object.upPressed || pad.up;
                object.downPressed = object.downPressed || pad.down;
                object.shootPressed = object.shootPressed || pad.shoot;
                object.abilityPressed = object.abilityPressed || pad.interact;
            }
        } else if (object.moveType == "ZOMBIE") {
            Components.zombieAI(object);
        }

        object.lazerUp = false;
        object.lazerDown = false;
        object.lazerLeft = false;
        object.lazerRight = false;

        if (!multiplayer && object.isPlayer && object.playerIndex === 0) {
            if (ULDRupPressed || ULDRdownPressed || ULDRleftPressed || ULDRrightPressed) {
                useMouseAim = false;
                object.lazerUp = ULDRupPressed;
                object.lazerDown = ULDRdownPressed;
                object.lazerLeft = ULDRleftPressed;
                object.lazerRight = ULDRrightPressed;
                if (object.lazerUp && object.lazerRight) object.degreeToGoCW = 45;
                else if (object.lazerDown && object.lazerRight) object.degreeToGoCW = 135;
                else if (object.lazerDown && object.lazerLeft) object.degreeToGoCW = 225;
                else if (object.lazerUp && object.lazerLeft) object.degreeToGoCW = 315;
                else if (object.lazerUp) object.degreeToGoCW = 0;
                else if (object.lazerRight) object.degreeToGoCW = 90;
                else if (object.lazerDown) object.degreeToGoCW = 180;
                else if (object.lazerLeft) object.degreeToGoCW = 270;
            }
        }

        if (object.isPlayer) {
            Components.directionArrow(object);
            // Right stick aims directly (twin-stick)
            var padA = (typeof Pads !== "undefined") ? Pads.state[object.playerIndex] : null;
            if (padA && padA.active && padA.aim) {
                object.degree = (Math.degrees(Math.atan2(padA.aim[0], -padA.aim[1])) + 360) % 360;
                object.degreeToGoCW = object.degree;
                object.padAiming = true;
            }
        }
    }

    // ------------------------------------------------------------------
    // Small colour helper: lighten (+) / darken (-) a #rrggbb colour
    // ------------------------------------------------------------------
    static shade(hex, amt) {
        if (!hex || hex[0] !== "#" || hex.length !== 7) return hex;
        var n = parseInt(hex.slice(1), 16);
        var r = Math.max(0, Math.min(255, (n >> 16) + amt));
        var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
        var b = Math.max(0, Math.min(255, (n & 255) + amt));
        return "rgb(" + r + "," + g + "," + b + ")";
    }

    static worldToScreenX(x) { return x * cameraScaleX + xc; }
    static worldToScreenY(y) { return -y * cameraScaleY + yc; }

    // Nearest living enemy to a point (optionally inside a cone)
    static nearestEnemy(x, y, maxDist, exclude) {
        var best = null, bestD = maxDist;
        for (let i = 0; i < zombies.length; i++) {
            var z = zombies[i];
            if (z.dead || z === exclude) continue;
            var d = Math.hypot(z.x - x, z.y - y);
            if (d < bestD) { bestD = d; best = z; }
        }
        return best;
    }

    static freezeBlast(x, y, radius, frames) {
        Components.addRing(x, y, radius, "#bdeaff", 28);
        for (let i = 0; i < zombies.length; i++) {
            var z = zombies[i];
            if (z.dead) continue;
            if (Math.hypot(z.x - x, z.y - y) < radius) {
                z.frozenTimer = frames;
                Components.spawnSparks(z.x, z.y, "#bdeaff", 5);
            }
        }
        if (typeof brawl !== "undefined" && brawl.active) {
            for (let i = 0; i < characters.length; i++) {
                var fc = characters[i];
                if (fc.dead || fc.invulnTimer > 0 || Math.hypot(fc.x - x, fc.y - y) > radius || Math.hypot(fc.x - x, fc.y - y) < 5) continue;
                fc.frozenTimer = Math.round(frames * 0.5);
                Components.spawnSparks(fc.x, fc.y, "#bdeaff", 5);
            }
        }
    }

    static addRing(x, y, radius, color, life = 24) {
        if (!Components.rings) Components.rings = [];
        if (Components.rings.length > 24) Components.rings.shift();
        Components.rings.push({ x: x, y: y, r: 10, max: radius, color: color, life: life, maxLife: life });
    }

    static addBolt(x1, y1, x2, y2, color = "#fde047") {
        if (!Components.bolts) Components.bolts = [];
        if (Components.bolts.length > 30) Components.bolts.shift();
        Components.bolts.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: color, life: 9 });
    }

    static drawEffects() {
        if (Components.rings) {
            for (let i = Components.rings.length - 1; i >= 0; i--) {
                var r = Components.rings[i];
                r.life--;
                var t = 1 - r.life / r.maxLife;
                var rad = (10 + (r.max - 10) * (1 - Math.pow(1 - t, 3))) * cameraScaleX;
                ctx.save();
                ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
                ctx.strokeStyle = r.color;
                ctx.lineWidth = 6 * (1 - t) + 2;
                ctx.shadowColor = r.color;
                ctx.shadowBlur = 16;
                ctx.beginPath();
                ctx.arc(r.x * cameraScaleX + xc, -r.y * cameraScaleY + yc, rad, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                if (r.life <= 0) Components.rings.splice(i, 1);
            }
        }
        if (Components.bolts) {
            for (let i = Components.bolts.length - 1; i >= 0; i--) {
                var b = Components.bolts[i];
                b.life--;
                var x1 = b.x1 * cameraScaleX + xc, y1 = -b.y1 * cameraScaleY + yc;
                var x2 = b.x2 * cameraScaleX + xc, y2 = -b.y2 * cameraScaleY + yc;
                ctx.save();
                ctx.strokeStyle = b.color;
                ctx.lineWidth = 3;
                ctx.shadowColor = b.color;
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                var segs = 6;
                for (let k = 1; k < segs; k++) {
                    var tt = k / segs;
                    ctx.lineTo(x1 + (x2 - x1) * tt + (Math.random() - 0.5) * 22, y1 + (y2 - y1) * tt + (Math.random() - 0.5) * 22);
                }
                ctx.lineTo(x2, y2);
                ctx.stroke();
                ctx.restore();
                if (b.life <= 0) Components.bolts.splice(i, 1);
            }
        }
    }

    static healthBar(object) {
        if (typeof brawl !== "undefined" && brawl.active && object.isPlayer) {
            // Brawl: a name tag with the damage percent instead of a health bar
            var bcx = object.x * cameraScaleX + xc;
            var btop = (-object.y - object.s2 / 2) * cameraScaleY + yc;
            var blabel = object.playerLabel + "  " + Math.round(object.damagePct || 0) + "%";
            ctx.save();
            ctx.font = "800 13px 'Segoe UI', Arial, sans-serif";
            var btw = ctx.measureText(blabel).width + 18;
            var bpy = btop - 34;
            ctx.fillStyle = object.accent();
            object.roundRectPath(bcx - btw / 2, bpy, btw, 20, 10);
            ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = "#0a0f16"; ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(blabel, bcx, bpy + 10.5);
            ctx.beginPath(); ctx.moveTo(bcx - 5, bpy + 20); ctx.lineTo(bcx + 5, bpy + 20); ctx.lineTo(bcx, bpy + 27); ctx.closePath();
            ctx.fillStyle = object.accent(); ctx.fill();
            if (object.shield > 0 && object.shieldMax > 0) {
                ctx.fillStyle = "#6ee7ff";
                ctx.fillRect(bcx - 30, bpy + 30, 60 * Math.min(1, object.shield / object.shieldMax), 3);
            }
            ctx.restore();
            return;
        }
        var isHero = object.isPlayer;
        var barW = Math.max(isHero ? 84 : 58, object.s1 * cameraScaleX * 1.25);
        var barH = isHero ? 11 : 8;
        var cx = object.x * cameraScaleX + xc;
        var topY = (-object.y - object.s2 / 2) * cameraScaleY + yc;
        var screenX = cx - barW / 2;
        var screenY = topY - (isHero ? 30 : 20);
        var pct = Math.max(0, Math.min(1, object.health / object.maxHealth));

        ctx.save();
        // track
        ctx.fillStyle = "rgba(8, 12, 18, 0.88)";
        object.roundRectPath(screenX - 2, screenY - 2, barW + 4, barH + 4, 5);
        ctx.fill();
        var col;
        if (object.isZombie && isHero) col = "#c77dff";
        else if (object.isZombie) col = "#ff4d5e";
        else col = pct > 0.6 ? "#3ddc84" : (pct > 0.3 ? "#ffd23f" : "#ff4d5e");
        if (godMode && !object.isZombie) col = "#ffdd00";
        ctx.fillStyle = col;
        object.roundRectPath(screenX, screenY, Math.max(2, barW * pct), barH, 4);
        ctx.fill();
        // gloss
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(screenX + 2, screenY + 1, Math.max(0, barW * pct - 4), barH * 0.35);
        // shield overlay
        if (object.shield > 0 && object.shieldMax > 0) {
            ctx.fillStyle = "#6ee7ff";
            ctx.fillRect(screenX, screenY - 4, barW * Math.min(1, object.shield / object.shieldMax), 3);
        }

        if (isHero) {
            // fuel bar
            if (!object.isZombie && jetpackEnabled) {
                var fuelPct = Math.max(0, Math.min(1, object.jetpackFuel / object.jetpackMaxFuel));
                ctx.fillStyle = "rgba(8, 12, 18, 0.8)";
                ctx.fillRect(screenX, screenY + barH + 3, barW, 4);
                ctx.fillStyle = godMode ? "#ffdd00" : "#22d3ee";
                ctx.fillRect(screenX, screenY + barH + 3, barW * fuelPct, 4);
            }
            // name pill + pointer
            var tag = object.playerLabel || ("P" + (object.playerIndex + 1));
            var pillCol = object.isZombie ? "#c77dff" : object.accent();
            var label = tag + (object.isZombie ? " · UNDEAD" : "");
            ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
            var tw = ctx.measureText(label).width + 16;
            var py = screenY - 24;
            ctx.fillStyle = pillCol;
            object.roundRectPath(cx - tw / 2, py, tw, 18, 9);
            ctx.fill();
            ctx.strokeStyle = "#0a0f16";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, cx, py + 9.5);
            ctx.beginPath();
            ctx.moveTo(cx - 5, py + 18);
            ctx.lineTo(cx + 5, py + 18);
            ctx.lineTo(cx, py + 25);
            ctx.closePath();
            ctx.fillStyle = pillCol;
            ctx.fill();
        } else if (object.zombiePower && object.zombiePower !== "NORMAL" && object.zombiePower !== "NONE") {
            ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            var nm = object.zombiePower.replace("_", " ");
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0,0,0,0.85)";
            ctx.strokeText(nm, cx, screenY - 3);
            ctx.fillStyle = "#ffd6d6";
            ctx.fillText(nm, cx, screenY - 3);
        }
        ctx.restore();
    }

    static shootLazer(object) {
        if (object.lazerCooldown > 0) {
            object.lazerCooldown--;
        }
        if (object.abilityCooldown > 0) {
            object.abilityCooldown--;
        }
        if (object.frozenTimer > 0 || object.staggerTimer > 0 || object.ragdollTimer > 0 || object.hitstun > 0) return;

        // Shockwave (suppressed while the key is being used to revive a teammate)
        if (object.abilityPressed && !object.suppressAbility && GameModes.flag("ability", true) && (object.abilityCooldown == 0 || godMode || devOpts.infiniteAmmo) && object.isPlayer && !object.isZombie) {
            Components.addFloatingText("SHOCKWAVE!", object.x, object.y + 60, "#ffaa00", 20);
            if (typeof SFX !== "undefined") SFX.play("shockwave", object.x, object.y);
            Components.addRing(object.x, object.y, 320, "#ffaa33", 22);
            Components.blowUp(object.x, object.y, "#ff9922", 24, 320, -45 * rpgDamageMult * devOpts.playerDamage, object);
            object.abilityCooldown = (godMode || devOpts.infiniteAmmo) ? 10 : 150;
        }

        if (object.isPlayer && !GameModes.flag("shooting", true)) return;
        var canEnemyShoot = (object.isPlayer || object.zombiePower == "SPITTER" || object.zombiePower == "ARCHER" || object.zombiePower == "MAGE" || object.zombiePower == "BOSS_KING");
        if (object.isZombie && !canEnemyShoot && object.moveType == "ZOMBIE") {
            return;
        }

        var dx = 0;
        var dy = 0;
        var firing = false;
        var soloTwinStick = (!multiplayer && object.isPlayer && object.playerIndex === 0);

        if (object.mouseShooting) {
            var mPos = Components.getMouseWorldPos();
            dx = mPos[0] - object.x;
            dy = mPos[1] - object.y;
            firing = true;
        } else if (soloTwinStick && (object.lazerUp || object.lazerDown || object.lazerLeft || object.lazerRight)) {
            if (object.lazerUp) { dy += 1; firing = true; }
            if (object.lazerDown) { dy -= 1; firing = true; }
            if (object.lazerLeft) { dx -= 1; firing = true; }
            if (object.lazerRight) { dx += 1; firing = true; }
        } else if (object.shootPressed) {
            var rad = Math.radians(object.degree);
            dx = Math.sin(rad);
            dy = Math.cos(rad);
            firing = true;

            // Keyboard aim-assist: gently snap to the closest enemy that is roughly in front of you
            if (object.isPlayer && !object.mouseShooting) {
                var best = null, bestScore = Infinity;
                for (let i = 0; i < zombies.length; i++) {
                    var z = zombies[i];
                    if (z.dead) continue;
                    var ex = z.x - object.x, ey = z.y - object.y;
                    var ed = Math.hypot(ex, ey);
                    if (ed > 1200 || ed < 1) continue;
                    var cosA = (ex * dx + ey * dy) / ed;
                    if (cosA < 0.55) continue; // ~57 degree cone
                    var score = ed * (2 - cosA);
                    if (score < bestScore) { bestScore = score; best = z; }
                }
                if (best) {
                    dx = best.x - object.x;
                    dy = (best.y - object.y);
                }
            }
        }

        if (firing && object.lazerCooldown <= 0 && (dx != 0 || dy != 0)) {
            var len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;

            var hero = object.isPlayer;
            var living = hero && !object.isZombie;
            // --- Ammo: finite magazine + reserve; auto-reload when dry ---
            var ammoLimited = living && !object.unlimitedAmmo();
            if (ammoLimited) {
                if (object.reloadTimer > 0) return;
                if (object.ammoMag <= 0) {
                    if (object.ammoReserve > 0) object.startReload();
                    else if (object.noAmmoMsg <= 0) {
                        object.noAmmoMsg = 60;
                        Components.addFloatingText("OUT OF AMMO!", object.x, object.y + 78, "#ff6b6b", 16);
                        if (typeof SFX !== "undefined") SFX.play("empty", object.x, object.y);
                    }
                    return;
                }
                object.ammoMag--;
            }
            var isRapid = (hero && object.hasPower("RAPID")) || (living && godMode);
            var berserk = hero && object.hasPower("BERSERK");
            if (hero && object.isZombie) {
                object.lazerCooldown = 14;
            } else if (object.isZombie) {
                object.lazerCooldown = Math.round(((object.zombiePower == "ARCHER") ? 48 : (object.zombiePower == "MAGE" ? 68 : (object.zombiePower == "BOSS_KING" ? (object.enraged ? 34 : 52) : 58))) * BALANCE.enemyFireDelay);
            } else {
                object.lazerCooldown = godMode ? 3 : (isRapid ? 4 : lazerCooldownMax);
                if (berserk) object.lazerCooldown = Math.max(3, Math.round(object.lazerCooldown * 0.8));
            }

            var angles = [0];
            if (living) {
                angles = godMode ? [-18, -9, 0, 9, 18] : (isRapid ? [-10, 0, 10] : [0]);
            } else if (object.zombiePower == "MAGE") {
                angles = [-16, 0, 16];
            } else if (object.zombiePower == "BOSS_KING") {
                angles = [-24, -12, 0, 12, 24];
            }

            var baseAngle = Math.atan2(dy, dx);
            var projSpeed = lazerSpeed;
            var projColor = isRapid ? "#ffdd44" : (hero && !object.isZombie ? (object.playerIndex === 0 ? "#ff6b4a" : "#4cc9ff") : lazerColor);
            var projW = lazerW, projH = lazerH;
            if (living) { projW = 26; projH = 26; } // generous hero hitbox: shots connect more easily
            var projDmg = Math.round(lazerDamage * rpgDamageMult * (godMode ? 2 : 1) * devOpts.playerDamage);
            if (berserk) {
                projDmg *= 2;
                projColor = "#ff5a1f";
                projW *= 1.6;
                projH *= 1.6;
            }

            if (hero && object.isZombie) {
                projSpeed = lazerSpeed * 0.85;
                projColor = "#d8b4fe";
                projDmg = -11 * devOpts.playerDamage;
                projW = projH = 16;
            } else if (object.isZombie) {
                if (object.zombiePower == "ARCHER") {
                    projSpeed = lazerSpeed * 0.88;
                    projColor = "#ffe8a3";
                    projW = 18;
                    projH = 8;
                    projDmg = -12;
                } else if (object.zombiePower == "MAGE") {
                    projSpeed = lazerSpeed * 0.55;
                    projColor = "#e879f9";
                    projW = 16;
                    projH = 16;
                    projDmg = -14;
                } else if (object.zombiePower == "BOSS_KING") {
                    projSpeed = lazerSpeed * 0.72;
                    projColor = "#ff9f1c";
                    projW = 20;
                    projH = 20;
                    projDmg = -18;
                } else {
                    projSpeed = lazerSpeed * 0.65;
                    projColor = "#ff4d6d";
                    projDmg = -9;
                }
            }

            object.lastShotAt = Date.now();
            if (typeof brawl !== "undefined" && brawl.active && hero) {
                projDmg = berserk ? -16 : -8;      // light chip damage, small knockback
                object.lazerCooldown = Math.max(object.lazerCooldown, berserk ? 10 : 15);
            }
            var visW = living ? (berserk ? 22 : 14) : projW;
            if (typeof SFX !== "undefined") {
                if (hero) SFX.play(object.isZombie ? "spit" : "shoot", object.x, object.y, isRapid ? 0.7 : 1, 1 + object.playerIndex * 0.12 + (berserk ? -0.25 : 0));
                else SFX.play("enemyShoot", object.x, object.y);
            }
            for (var a = 0; a < angles.length; a++) {
                var ang = baseAngle + Math.radians(angles[a]);
                var vx = Math.cos(ang) * projSpeed;
                var vy = Math.sin(ang) * projSpeed;

                if (lazers.length >= 110) lazers.shift();
                lazers.push({
                    x: object.x + Math.cos(ang) * (object.s1 * 0.55),
                    y: object.y + Math.sin(ang) * (object.s2 * 0.55),
                    w: projW,
                    h: projH,
                    xspeed: vx,
                    yspeed: vy,
                    hitbox: Math.makeHitbox(projW, projH),
                    poly: Math.makeHitbox(projW, projH),
                    color: projColor,
                    owner: object,
                    team: object.team,
                    fromZombie: object.isZombie && !hero,
                    damage: projDmg,
                    homing: hero && object.hasPower("HOMING"),
                    chain: hero && object.hasPower("CHAIN"),
                    speed: projSpeed,
                    vw: visW,
                    life: 90
                });
            }
        }
    }

    static updateLazers() {
        for (let i = lazers.length - 1; i >= 0; i--) {
            var l = lazers[i];

            if (l.homing) {
                var tgt = Components.nearestEnemy(l.x, l.y, 800, null);
                if (tgt) {
                    var hx = tgt.x - l.x, hy = tgt.y - l.y;
                    var hl = Math.hypot(hx, hy) || 1;
                    l.xspeed += (hx / hl * l.speed - l.xspeed) * 0.16;
                    l.yspeed += (hy / hl * l.speed - l.yspeed) * 0.16;
                    var vl = Math.hypot(l.xspeed, l.yspeed) || 1;
                    l.xspeed = l.xspeed / vl * l.speed;
                    l.yspeed = l.yspeed / vl * l.speed;
                }
            }

            l.x += l.xspeed;
            l.y += l.yspeed;
            l.life--;

            Components.drawProjectile(l);
            if (typeof Ragdolls !== "undefined" && Ragdolls.list.length) Ragdolls.bulletHit(l);

            var removeLazer = (l.life <= 0);
            var lteam = (l.team !== undefined) ? l.team : (l.fromZombie ? 0 : 1);

            if (!removeLazer && CollisionDetector.collision(l, [0, 0], allObjects)) {
                var hit = l.collidedWith;
                if (hit != l.owner) {
                    if (hit instanceof Character) {
                        if (hit.team != lteam) {
                            hit.takeDamage(l.damage, l.xspeed * 0.35, l.yspeed * 0.2 + 2.5, l.owner);
                            Components.spawnSparks(l.x, l.y, l.color, 5);
                            if (l.chain && hit.isZombie) {
                                var hops = 0, last = hit, used = [hit];
                                while (hops < 3) {
                                    var nxt = null, nd = 360;
                                    for (let z = 0; z < zombies.length; z++) {
                                        var zz = zombies[z];
                                        if (zz.dead || used.indexOf(zz) !== -1) continue;
                                        var dd = Math.hypot(zz.x - last.x, zz.y - last.y);
                                        if (dd < nd) { nd = dd; nxt = zz; }
                                    }
                                    if (!nxt) break;
                                    Components.addBolt(last.x, last.y, nxt.x, nxt.y);
                                    nxt.takeDamage(l.damage * 0.6, 0, 3, l.owner);
                                    used.push(nxt);
                                    last = nxt;
                                    hops++;
                                }
                            }
                            removeLazer = true;
                        }
                    } else {
                        if (hit.movable) {
                            hit.xspeed += l.xspeed * 0.25;
                            hit.yspeed += l.yspeed * 0.15 + 2;
                        }
                        if (hit.explosive) {
                            hit.takeDamage(l.damage);
                        }
                        Components.spawnSparks(l.x, l.y, l.color, 3);
                        removeLazer = true;
                    }
                }
            }

            if (removeLazer) {
                lazers.splice(i, 1);
            }
        }
    }

    // Glowing, directional projectile with a short trail (heroes = round energy bolts, enemies = spiky diamonds)
    static drawProjectile(l) {
        var sx = l.x * cameraScaleX + xc;
        var sy = -l.y * cameraScaleY + yc;
        if (sx < -60 || sx > cssW + 60 || sy < -60 || sy > cssH + 60) return;
        var ang = Math.atan2(-l.yspeed, l.xspeed);
        var size = Math.max(7, (l.vw || l.w || 14) * 0.75 * Math.max(0.8, cameraScaleX * 1.2));
        var tail = size * 3.2;
        var hostile = (l.team !== undefined) ? (l.team === 0) : l.fromZombie;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        // cheap glow: a soft halo + a fading tail (no shadowBlur / gradients -> fast with 100+ bullets)
        ctx.fillStyle = l.color;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(-tail, 0);
        ctx.lineTo(0, -size * 0.55);
        ctx.lineTo(0, size * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(-tail * 0.5, 0);
        ctx.lineTo(0, -size * 0.4);
        ctx.lineTo(0, size * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        if (hostile) {
            ctx.fillStyle = l.color;
            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.lineTo(0, -size * 0.8);
            ctx.lineTo(-size * 0.7, 0);
            ctx.lineTo(0, size * 0.8);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "#1a0509";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.75, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = l.color;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        ctx.restore();
    }

    static spawnCoins(x, y, count = 3) {
        for (let i = 0; i < count; i++) {
            if (coinOrbs.length >= 28) coinOrbs.shift();
            coinOrbs.push({
                x: x + (Math.random() - 0.5) * 30,
                y: y + Math.random() * 20,
                w: 22,
                h: 22,
                xspeed: (Math.random() - 0.5) * 10,
                yspeed: 5 + Math.random() * 7,
                hitbox: Math.makeHitbox(22, 22),
                poly: Math.makeHitbox(22, 22),
                life: 700
            });
        }
    }

    static updateCoins() {
        for (let i = coinOrbs.length - 1; i >= 0; i--) {
            var c = coinOrbs[i];
            c.life--;
            c.yspeed -= gravity * 0.65;

            // Magnetize toward the nearest hero (bigger pull with the MAGNET power / god mode)
            var pullTarget = null, pullBest = Infinity;
            for (let hI = 0; hI < characters.length; hI++) {
                var hc = characters[hI];
                var range = godMode ? 600 : (hc.hasPower("MAGNET") ? 950 : 240);
                var hd = Math.hypot(hc.x - c.x, hc.y - c.y);
                if (hd < range && hd < pullBest) { pullBest = hd; pullTarget = hc; }
            }
            if (pullTarget && pullBest > 1) {
                var pf = pullTarget.hasPower("MAGNET") ? 2.6 : 1.4;
                c.xspeed += ((pullTarget.x - c.x) / pullBest) * pf;
                c.yspeed += ((pullTarget.y - c.y) / pullBest) * pf;
            }

            if (CollisionDetector.collision(c, [0, c.yspeed], staticObjects)) {
                c.y += c.yspeed + c.yOver;
                c.yspeed *= -0.55;
                c.xspeed *= 0.85;
            } else {
                c.y += c.yspeed;
            }
            c.x += c.xspeed;

            // Draw spinning gold coin with a glow
            var sx = c.x * cameraScaleX + xc;
            var sy = -c.y * cameraScaleY + yc;
            var radX = Math.max(4, Math.abs(Math.cos(c.life * 0.12)) * 13 * Math.max(0.9, cameraScaleX));
            var radY = 13 * Math.max(0.9, cameraScaleY);
            ctx.save();
            ctx.shadowColor = "#ffd700";
            ctx.shadowBlur = 10;
            ctx.fillStyle = "#ffd60a";
            ctx.strokeStyle = "#7a4a00";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(sx, sy, radX, radY, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            var picked = false;
            for (let p = 0; p < characters.length; p++) {
                var ch = characters[p];
                if (Math.hypot(ch.x - c.x, ch.y - c.y) < ch.s1 * 0.8) {
                    picked = true;
                    if (ch.isZombie) {
                        ch.addHumanity(6);
                        break;
                    }
                    coins++;
                    heroXP += 12;
                    if (typeof SFX !== "undefined") SFX.play("coin", c.x, c.y);
                    score += 25;
                    if (heroXP >= heroXPNext) {
                        heroXP -= heroXPNext;
                        heroLevel++;
                        heroXPNext = Math.round(heroXPNext * 1.5);
                        rpgDamageMult = 1 + (heroLevel - 1) * 0.08;
                        for (let q = 0; q < characters.length; q++) {
                            var hh = characters[q];
                            if (hh.isZombie) continue;
                            hh.maxHealth += 10;
                            hh.health = hh.maxHealth;
                            hh.jetpackMaxFuel += 15;
                            hh.jetpackFuel = hh.jetpackMaxFuel;
                            hh.recomputeStats();
                        }
                        Components.addFloatingText("LEVEL UP! LVL " + heroLevel + "!", ch.x, ch.y + 85, "#00f5d4", 26);
                        if (typeof SFX !== "undefined") SFX.play("levelup", ch.x, ch.y);
                        Components.addRing(ch.x, ch.y, 360, "#00f5d4", 26);
                        Components.spawnSparks(ch.x, ch.y, "#00f5d4", 16);
                    } else {
                        Components.addFloatingText("+12 XP", c.x, c.y + 20, "#ffdd00", 14);
                    }
                    break;
                }
            }

            if (picked || c.life <= 0) {
                coinOrbs.splice(i, 1);
            }
        }
    }

    static updateAfterImages() {
        for (let i = afterImages.length - 1; i >= 0; i--) {
            var a = afterImages[i];
            a.life--;
            ctx.save();
            ctx.globalAlpha = (a.life / a.maxLife) * 0.45;
            Polygon.create(a.poly, a.color, a);
            ctx.restore();
            if (a.life <= 0) {
                afterImages.splice(i, 1);
            }
        }
    }

    static addFloatingText(text, x, y, color = "#ffffff", size = 18) {
        if (floatingTexts.length >= 18) floatingTexts.shift();
        floatingTexts.push({
            text: text,
            x: x + (Math.random() - 0.5) * 20,
            y: y,
            yspeed: 2.2,
            color: color,
            size: size,
            life: 62,
            maxLife: 62
        });
    }

    static updateFloatingTexts() {
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            var ft = floatingTexts[i];
            ft.y += ft.yspeed;
            ft.life--;
            var alpha = Math.max(0, ft.life / ft.maxLife);
            var sx = ft.x * cameraScaleX + xc;
            var sy = -ft.y * cameraScaleY + yc;

            ctx.save();
            ctx.globalAlpha = Math.min(1, alpha * 1.6);
            ctx.font = "800 " + Math.round(Math.max(13, ft.size * 0.95)) + "px 'Segoe UI', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.lineJoin = "round";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(5,8,14,0.92)";
            ctx.strokeText(ft.text, sx, sy);
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, sx, sy);
            ctx.restore();

            if (ft.life <= 0) {
                floatingTexts.splice(i, 1);
            }
        }
    }

    static spawnSparks(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            if (particles.length >= 60) particles.shift();
            var sz = 6 + Math.random() * 6;
            particles.push({
                x: x,
                y: y,
                w: sz,
                h: sz,
                xspeed: (Math.random() - 0.5) * 11,
                yspeed: (Math.random() - 0.2) * 11,
                poly: Math.makeHitbox(sz, sz),
                color: color,
                life: 14 + Math.floor(Math.random() * 14)
            });
        }
    }

    static blowUp(x, y, color, count = 18, radius = 230, damage = -30, source = null) {
        screenShake = Math.min(9, screenShake + 5);
        Components.addRing(x, y, Math.min(radius, 420), color, 20);
        if (typeof Ragdolls !== "undefined") Ragdolls.explode(x, y, radius * 1.15, Math.min(17, 4 + Math.abs(damage) * 0.28));
        GameModes.call("onExplosion", x, y, radius, Math.min(17, 4 + Math.abs(damage) * 0.28));
        if (typeof Gadgets !== "undefined") Gadgets.onExplosion(x, y, radius);
        if (typeof SFX !== "undefined") SFX.play(Math.abs(damage) >= 20 ? "explode" : "kill", x, y, Math.min(1, radius / 300));

        for (let i = 0; i < count; i++) {
            if (particles.length >= 90) particles.shift();
            var sz = 10 + Math.random() * 16;
            var angle = Math.random() * Math.PI * 2;
            var spd = 4 + Math.random() * 15;
            particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                w: sz,
                h: sz,
                xspeed: Math.cos(angle) * spd,
                yspeed: Math.sin(angle) * spd + 4,
                poly: Math.makeHitbox(sz, sz),
                color: i % 2 == 0 ? color : "#ffcc33",
                life: 24 + Math.floor(Math.random() * 24)
            });
        }

        for (let i = 0; i < allObjects.length; i++) {
            var obj = allObjects[i];
            if (obj == source || obj.dead) continue;
            var dx = obj.x - x;
            var dy = obj.y - y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius && dist > 0.1) {
                var force = (1 - dist / radius) * 19;
                var nx = dx / dist;
                var ny = dy / dist;
                if (obj instanceof Character) {
                    if (!source || obj.team != source.team) {
                        obj.takeDamage(damage * (1 - dist / radius * 0.5), nx * force, ny * force + 6, source);
                    }
                } else if (obj.movable) {
                    obj.xspeed += nx * force;
                    obj.yspeed += ny * force + 6;
                    if (obj.explosive) {
                        obj.takeDamage(damage * 0.8);
                    }
                }
            }
        }
    }

    // ---- Ragdoll corpses: slain enemies tumble away limp and fade out ----
    static addCorpse(ch) {
        if (typeof Ragdolls === "undefined") return;
        if (ch.liveRagdoll) {
            // already tumbling: the ragdoll simply goes limp for good
            Ragdolls.toCorpse(ch.liveRagdoll, 900);
            ch.liveRagdoll = null;
            return;
        }
        var dir = (ch.xspeed >= 0) ? 1 : -1;
        Ragdolls.spawnFrom(ch, { corpse: true, life: 900, vx: ch.xspeed + dir * 3, vy: Math.max(ch.yspeed, 7) });
    }

    static updateCorpses() { /* replaced by Ragdolls.update/drawCorpses */ }

    static updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.yspeed -= gravity * 0.7;
            p.x += p.xspeed;
            p.y += p.yspeed;
            p.life--;
            Polygon.create(p.poly, p.color, p);
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    // Spawns an Interactive RPG Treasure Chest inside Castles, Under Bridges, in Attics & Deep Caverns!
    static spawnChest(x, bottomY, label = "Royal Treasure Chest", chunkIdx = null) {
        if (typeof treasureChests === "undefined") return;
        treasureChests.push({
            x: x,
            y: bottomY + 22,
            w: 56,
            h: 44,
            label: label,
            opened: false,
            chunkIdx: chunkIdx
        });
    }

    static updateChests() {
        if (typeof treasureChests === "undefined") return;
        for (let i = treasureChests.length - 1; i >= 0; i--) {
            var ch = treasureChests[i];
            if (ch.opened) {
                treasureChests.splice(i, 1);
                continue;
            }

            var sx = (ch.x - ch.w / 2) * cameraScaleX + xc;
            var sy = (-ch.y - ch.h / 2) * cameraScaleY + yc;
            var sw = ch.w * cameraScaleX;
            var sh = ch.h * cameraScaleY;

            if (sx + sw > -40 && sx < cssW + 40) {
                ctx.save();
                // Ornate RPG wooden & gold chest
                ctx.fillStyle = "#8c4a27";
                ctx.fillRect(sx, sy, sw, sh);
                ctx.fillStyle = "#b5651d";
                ctx.fillRect(sx + 3 * cameraScaleX, sy + 3 * cameraScaleY, sw - 6 * cameraScaleX, sh * 0.42);
                // Gold trim & lock clasp
                ctx.strokeStyle = "#ffdd44";
                ctx.lineWidth = Math.max(2, 3 * cameraScaleX);
                ctx.strokeRect(sx, sy, sw, sh);
                ctx.fillStyle = "#ffdd44";
                ctx.fillRect(sx + sw * 0.42, sy + sh * 0.35, sw * 0.16, sh * 0.28);
                ctx.restore();
            }

            // Open when touched by a human player or hit by a laser/thrown crate!
            var triggeredBy = null;
            for (let p = 0; p < characters.length; p++) {
                var pl = characters[p];
                if (!pl.isZombie && Math.hypot(pl.x - ch.x, pl.y - ch.y) < 78) {
                    triggeredBy = pl;
                    break;
                }
            }
            if (!triggeredBy) {
                for (let l = 0; l < lazers.length; l++) {
                    if (!lazers[l].fromZombie && Math.hypot(lazers[l].x - ch.x, lazers[l].y - ch.y) < 42) {
                        triggeredBy = redGuy;
                        lazers[l].life = 0;
                        break;
                    }
                }
            }

            if (triggeredBy) {
                ch.opened = true;
                Components.spawnCoins(ch.x, ch.y + 15, 4);
                Components.spawnSparks(ch.x, ch.y, "#ffdd44", 18);
                score += 150;
                heroXP += 30;

                // Grant a permanent RPG Relic Upgrade!
                var roll = Math.floor(Math.random() * 4);
                if (roll === 0) {
                    rpgDamageMult += 0.07;
                    Components.addFloatingText("💎 CHEST: +7% WEAPON DAMAGE", ch.x, ch.y + 65, "#ffdd44", 20);
                } else if (roll === 1) {
                    triggeredBy.maxHealth += 12;
                    triggeredBy.health = Math.min(triggeredBy.maxHealth, triggeredBy.health + 25);
                    Components.addFloatingText("💎 CHEST: +12 MAX HP", ch.x, ch.y + 65, "#55ff88", 20);
                } else if (roll === 2) {
                    triggeredBy.baseSpeed *= 1.03;
                    triggeredBy.speed = triggeredBy.baseSpeed;
                    Components.addFloatingText("💎 CHEST: +3% SWIFT BOOTS", ch.x, ch.y + 65, "#00f5d4", 20);
                } else {
                    triggeredBy.maxAirJumps = Math.min(2, (triggeredBy.maxAirJumps || 1) + 1);
                    triggeredBy.airJumps = triggeredBy.maxAirJumps;
                    Components.addFloatingText("💎 CHEST: SKY RELIC (+1 AIR JUMP)!", ch.x, ch.y + 65, "#c77dff", 20);
                }
            }
        }
    }

    // ====================================================================================
    // ENEMY AI
    //   - smart target choice (spreads across heroes, favours the wounded), flanking from both sides
    //   - guardians idle at their post until a hero gets close, shoots or hits them; wave enemies always hunt
    //   - ranged enemies check line-of-sight, lead their shots, kite and dodge; low-HP casters retreat
    //   - telegraphed specials: leaper pounce, tank charge, exploder fuse, bat dive-bombs, knight shield-lunge
    //   - the Boss King enrages at 50% HP and calls guards at 66% / 33%
    // ====================================================================================
    static hasLOS(x1, y1, x2, y2) {
        for (let s = 1; s < 9; s++) {
            var t = s / 9;
            var px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
            for (let i = 0; i < staticObjects.length; i++) {
                var st = staticObjects[i];
                if (st.isRamp || st.isBumper || st.dead || st.noCollide) continue;
                if (st.kind === "platform") continue;
                if (Math.abs(px - st.x) < st.w / 2 && Math.abs(py - st.y) < st.h / 2) return false;
            }
        }
        return true;
    }

    static leadAim(z, t, projSpeed) {
        var d = Math.hypot(t.x - z.x, t.y - z.y);
        var tt = d / Math.max(4, projSpeed);
        var px = t.x + (t.xspeed || 0) * tt * 0.8;
        var py = t.y + (t.yspeed || 0) * tt * 0.35;
        z.degree = (Math.degrees(Math.atan2(px - z.x, py - z.y)) + 360) % 360;
    }

    static pickTarget(z) {
        var best = null, bestScore = Infinity;
        for (let pass = 0; pass < 2 && !best; pass++) {
            for (let i = 0; i < characters.length; i++) {
                var c = characters[i];
                if (c.dead) continue;
                if (pass === 0 && c.isZombie) continue;
                var d = Math.hypot(c.x - z.x, c.y - z.y);
                var crowd = 0;
                for (let k = 0; k < zombies.length; k++) if (zombies[k] !== z && zombies[k].target === c && !zombies[k].dead) crowd++;
                var woundedBonus = (1 - c.health / Math.max(1, c.maxHealth)) * 260;
                var score = d + crowd * 140 - woundedBonus;
                if (z.target === c) score -= 120; // stickiness so they don't dither
                if (score < bestScore) { bestScore = score; best = c; }
            }
        }
        z.target = best;
    }

    static zombieAI(zombie) {
        zombie.upPressed = false;
        zombie.downPressed = false;
        zombie.leftPressed = false;
        zombie.rightPressed = false;
        zombie.shootPressed = false;
        if (zombie.frozenTimer > 0 || zombie.ragdollTimer > 0 || zombie.staggerTimer > 0) return;
        if (GameModes.flag("enemiesPassive", false)) return;

        zombie.aiTick = (zombie.aiTick || 0) + 1;
        var dec = function(k) { zombie[k] = Math.max(0, (zombie[k] || 0) - 1); };
        dec("leapCd"); dec("chargeCd"); dec("dodgeCd"); dec("alertTimer"); dec("specialCd");

        // ---- Target selection (re-evaluated every 15 frames) ----
        if (!zombie.target || zombie.target.dead || (zombie.aiTick + zombie.id) % 15 === 0) Components.pickTarget(zombie);
        var target = zombie.target;
        var pType = zombie.zombiePower;

        // gunfire alerts nearby enemies
        for (let h = 0; h < characters.length; h++) {
            var hh = characters[h];
            if (!hh.isZombie && Date.now() - (hh.lastShotAt || 0) < 400 && Math.hypot(hh.x - zombie.x, hh.y - zombie.y) < 1800) zombie.alertTimer = 420;
        }

        // ---- Aggro / patrol (wave spawns always hunt; guardians wait at their post) ----
        var dxT = target ? target.x - zombie.x : 0, dyT = target ? target.y - zombie.y : 0;
        var distT = target ? Math.hypot(dxT, dyT) : Infinity;
        var aggro = !!target && (zombie.hunter || zombie.alertTimer > 0 || distT < (zombie.aggroR || 1150));
        if (aggro && !zombie.hunter && distT < 1150) zombie.alertTimer = Math.max(zombie.alertTimer, 300);
        if (!aggro) {
            if (zombie.homeX === undefined) { zombie.homeX = zombie.x; zombie.homeY = zombie.y; }
            if (pType == "BAT") {
                zombie.flies = true;
                var hy = zombie.homeY + Math.sin(zombie.aiTick * 0.03 + zombie.id) * 50;
                if (hy > zombie.y + 12) zombie.upPressed = true; else if (hy < zombie.y - 12) zombie.downPressed = true;
            }
            if (Math.abs(zombie.x - zombie.homeX) > 260) {
                if (zombie.x > zombie.homeX) zombie.leftPressed = true; else zombie.rightPressed = true;
            } else {
                if (Math.random() < 0.012) zombie.aiDir = (Math.random() < 0.5 ? -1 : 1);
                if (zombie.aiDir < 0) zombie.leftPressed = true;
                if (zombie.aiDir > 0 && Math.abs(zombie.x - zombie.homeX) < 240) zombie.rightPressed = true;
            }
            return;
        }

        var hpPct = zombie.health / Math.max(1, zombie.maxHealth);
        if (zombie.aiTick % 6 === 0 || zombie.los === undefined) zombie.los = Components.hasLOS(zombie.x, zombie.y, target.x, target.y);
        var los = zombie.los;
        var sameLevel = Math.abs(dyT) < 90;
        var dirT = dxT >= 0 ? 1 : -1;
        var side = (zombie.id % 2 ? 1 : -1) * (zombie.flipSide ? -1 : 1);
        // flanking: when close, melee enemies aim for opposite sides of the hero so they surround instead of queueing
        var navTarget = (distT < 650 && pType != "ARCHER" && pType != "MAGE")
            ? { x: target.x + side * 130, y: target.y, s2: target.s2 }
            : target;
        var navigate = function(tg) {
            if (typeof Pathfinder !== "undefined") Pathfinder.updateZombieNavigation(zombie, tg);
            else if (tg.x > zombie.x + 15) zombie.rightPressed = true; else if (tg.x < zombie.x - 15) zombie.leftPressed = true;
        };
        var flee = function() {
            if (dirT > 0) zombie.leftPressed = true; else zombie.rightPressed = true;
            if (zombie.onGround && Math.random() < 0.01) zombie.upPressed = true;
        };

        // ---- Dodge: hop or sidestep incoming hero bullets (agile types only) ----
        if (zombie.dodgeCd <= 0 && zombie.onGround && (pType == "ARCHER" || pType == "MAGE" || pType == "LEAPER" || pType == "SPITTER" || pType == "BOSS_KING")) {
            for (let li = 0; li < lazers.length; li++) {
                var lz = lazers[li];
                if (lz.team !== 1) continue;
                var lx = zombie.x - lz.x, ly = zombie.y - lz.y;
                var ld = Math.hypot(lx, ly);
                if (ld < 280 && ld > 40) {
                    var lv = Math.hypot(lz.xspeed, lz.yspeed) || 1;
                    if ((lx * lz.xspeed + ly * lz.yspeed) / (ld * lv) > 0.93 && Math.random() < 0.55) {
                        zombie.upPressed = true;
                        zombie.xspeed += (lz.xspeed > 0 ? 1 : -1) * 2.5;
                        zombie.dodgeCd = 70;
                        break;
                    }
                }
            }
        }

        // ---- Soft separation so groups spread out instead of stacking ----
        for (let zi = 0; zi < zombies.length; zi++) {
            var oz = zombies[zi];
            if (oz === zombie || oz.dead) continue;
            var sx = zombie.x - oz.x;
            if (Math.abs(sx) < 46 && Math.abs(zombie.y - oz.y) < 60) { zombie.xspeed += (sx >= 0 ? 1 : -1) * 0.22; break; }
        }

        // ============================ per-type behaviour ============================
        if (pType == "BAT") {
            zombie.flies = true;
            zombie.batState = zombie.batState || "hover";
            zombie.batTimer = (zombie.batTimer || 0) + 1;
            if (zombie.batState == "hover") {
                var hx = target.x + Math.sin(zombie.aiTick * 0.02 + zombie.id) * 160, hyy = target.y + 190 + Math.sin(zombie.aiTick * 0.05 + zombie.id) * 30;
                if (hx > zombie.x + 14) zombie.rightPressed = true; else if (hx < zombie.x - 14) zombie.leftPressed = true;
                if (hyy > zombie.y + 12) zombie.upPressed = true; else if (hyy < zombie.y - 12) zombie.downPressed = true;
                if (zombie.batTimer > 90 && Math.abs(dxT) < 190 && dyT < -80 && !zombie.specialCd) {
                    zombie.batState = "dive"; zombie.batTimer = 0;
                    Components.addFloatingText("!", zombie.x, zombie.y + 50, "#ff4d5e", 20);
                }
            } else if (zombie.batState == "dive") {
                zombie.yspeed = -9; zombie.xspeed += dirT * 0.9;
                if (zombie.batTimer > 38 || zombie.y < target.y + 20) { zombie.batState = "retreat"; zombie.batTimer = 0; zombie.specialCd = 150; }
            } else {
                zombie.upPressed = true; zombie.xspeed += -dirT * 0.25;
                if (zombie.batTimer > 50) { zombie.batState = "hover"; zombie.batTimer = 0; }
            }
            return;
        }

        if (pType == "ARCHER" || pType == "MAGE") {
            var wounded = hpPct < 0.35;
            var keep = pType == "ARCHER" ? [300, 520] : [330, 560];
            var range = pType == "ARCHER" ? 760 : 700;
            if (wounded || distT < keep[0]) flee();
            else if (distT > keep[1] || !los) navigate(target);
            if (pType == "MAGE" && distT < 190 && zombie.abilityCooldown <= 0) {
                var blinkX = (dxT > 0 ? -220 : 220);
                if (!CollisionDetector.hitsStatic(zombie, blinkX, 40, staticObjects)) {
                    Components.spawnSparks(zombie.x, zombie.y, "#c77dff", 10);
                    zombie.x += blinkX; zombie.y += 40; zombie.abilityCooldown = 150;
                    Components.spawnSparks(zombie.x, zombie.y, "#c77dff", 10);
                }
            }
            if (distT < range && los && Math.abs(dyT) < 420) {
                Components.leadAim(zombie, target, lazerSpeed * (pType == "ARCHER" ? 0.88 : 0.55));
                zombie.shootPressed = true;
            }
            Components.antiStuck(zombie);
            return;
        }

        if (pType == "SPITTER") {
            if (distT < 260) flee(); else if (distT > 520 || !los) navigate(navTarget);
            if (distT < 650 && los) { Components.leadAim(zombie, target, lazerSpeed * 0.65); zombie.shootPressed = true; }
            Components.antiStuck(zombie);
            return;
        }

        // ---- melee / charger family: approach first ----
        var committed = false;

        if (pType == "TANK") {
            if (zombie.chargeState == "wind") {
                committed = true;
                zombie.chargeWind--;
                zombie.scaleX = 1 + Math.sin(zombie.aiTick * 1.2) * 0.05;
                if (zombie.chargeWind <= 0) {
                    zombie.chargeState = "go";
                    zombie.dashVX = dirT * 13; zombie.dashVY = -0.5; zombie.dashTimer = 30; zombie.dashCooldown = 0;
                    zombie.chargeCd = 220;
                    screenShake = Math.max(screenShake, 4);
                }
            } else {
                if (zombie.chargeState == "go" && zombie.dashTimer <= 0) zombie.chargeState = null;
                if (zombie.chargeCd <= 0 && zombie.onGround && sameLevel && distT > 220 && distT < 760 && los && !zombie.chargeState) {
                    zombie.chargeState = "wind"; zombie.chargeWind = 36;
                    Components.addFloatingText("CHARGE!", zombie.x, zombie.y + 90, "#ff6b6b", 20);
                    zombie.hitFlashTimer = 6;
                }
            }
        } else if (pType == "LEAPER") {
            if (zombie.leapWind > 0) {
                committed = true;
                zombie.leapWind--;
                zombie.scaleY = 0.78; zombie.scaleX = 1.2;
                if (zombie.leapWind === 0 && zombie.onGround) {
                    zombie.yspeed = 12.8; zombie.xspeed = dirT * 11;
                    zombie.onGround = false; zombie.leapCd = 120;
                }
            } else if (zombie.leapCd <= 0 && zombie.onGround && distT > 200 && distT < 540 && Math.abs(dyT) < 200) {
                zombie.leapWind = 18;
            }
        } else if (pType == "EXPLODER") {
            if (zombie.fuse > 0) {
                zombie.fuse--;
                zombie.hitFlashTimer = (zombie.fuse % 8 < 4) ? 2 : 0;
                if (zombie.fuse === 0) { zombie.takeDamage(-999, 0, 0); return; }
            } else if (distT < 135) {
                zombie.fuse = 46;
                Components.addFloatingText("TICK... TICK...", zombie.x, zombie.y + 80, "#fbbf24", 16);
            }
            if (zombie.fuse > 0) { if (dirT > 0) zombie.rightPressed = true; else zombie.leftPressed = true; committed = true; }
        } else if (pType == "KNIGHT") {
            if (zombie.onGround && sameLevel && distT > 150 && distT < 400 && zombie.dashCooldown <= 0 && los) {
                zombie.dashVX = dirT * 16; zombie.dashVY = 1; zombie.dashTimer = 10; zombie.dashCooldown = 100;
                Components.spawnSparks(zombie.x, zombie.y, "#e0fbfc", 6);
            }
        } else if (pType == "SLIME" || pType == "MINI_SLIME") {
            // rhythmic bounding hops toward the hero
            zombie.hopT = (zombie.hopT || 0) + 1;
            if (zombie.onGround && zombie.hopT > 38) { zombie.hopT = 0; zombie.upPressed = true; }
        } else if (pType == "BOSS_KING") {
            if (hpPct < 0.5 && !zombie.enraged) {
                zombie.enraged = true; zombie.speed *= 1.3;
                Components.addFloatingText("THE KING IS ENRAGED!", zombie.x, zombie.y + 130, "#ff4d5e", 26);
                screenShake = Math.max(screenShake, 8);
            }
            if (hpPct < 0.66 && !zombie.summon1) { zombie.summon1 = true; Components.summonGuards(zombie); }
            if (hpPct < 0.33 && !zombie.summon2) { zombie.summon2 = true; Components.summonGuards(zombie); }
            if (distT < 780 && los) { Components.leadAim(zombie, target, lazerSpeed * 0.72); zombie.shootPressed = true; }
            if (zombie.onGround && Math.abs(dxT) < 360 && Math.random() < (zombie.enraged ? 0.05 : 0.03)) zombie.upPressed = true;
        }

        if (!committed) navigate(navTarget);
        Components.antiStuck(zombie);
    }

    static summonGuards(boss) {
        Components.addFloatingText("THE KING CALLS HIS GUARDS!", boss.x, boss.y + 130, "#fbbf24", 24);
        screenShake = Math.max(screenShake, 6);
        for (let g = -1; g <= 1; g += 2) {
            if (zombies.length > 24) break;
            var m = spawnZombie(g < 0 ? "KNIGHT" : "NORMAL", boss.x + g * 170, boss.y + 40);
            m.hunter = true;
        }
    }

    // Enemies that push against something without moving hop, then switch sides
    static antiStuck(z) {
        if (z.aiLastX === undefined) { z.aiLastX = z.x; z.aiStuck = 0; }
        var pushing = z.leftPressed !== z.rightPressed;
        if (pushing && Math.abs(z.x - z.aiLastX) < 0.5 && z.onGround) z.aiStuck++;
        else z.aiStuck = Math.max(0, z.aiStuck - 2);
        z.aiLastX = z.x;
        if (z.aiStuck > 45) z.upPressed = true;
        if (z.aiStuck > 100) { z.aiStuck = 0; z.flipSide = !z.flipSide; z.navPath = []; }
    }
}
