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
                    if (object.heldObject && !object.heldObject.dead) {
                        var mPos = Components.getMouseWorldPos();
                        object.throwHeldObject(mPos[0], mPos[1]);
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
            var pillCol = object.isZombie ? "#c77dff" : (object.playerIndex === 0 ? "#ff5a5f" : "#3da5ff");
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
        if (object.frozenTimer > 0 || object.staggerTimer > 0) return;

        // Shockwave (suppressed while the key is being used to revive a teammate)
        if (object.abilityPressed && !object.suppressAbility && (object.abilityCooldown == 0 || godMode || devOpts.infiniteAmmo) && object.isPlayer && !object.isZombie) {
            Components.addFloatingText("SHOCKWAVE!", object.x, object.y + 60, "#ffaa00", 20);
            Components.addRing(object.x, object.y, 320, "#ffaa33", 22);
            Components.blowUp(object.x, object.y, "#ff9922", 24, 320, -45 * rpgDamageMult * devOpts.playerDamage, object);
            object.abilityCooldown = (godMode || devOpts.infiniteAmmo) ? 10 : 150;
        }

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
                object.lazerCooldown = Math.round(((object.zombiePower == "ARCHER") ? 48 : (object.zombiePower == "MAGE" ? 68 : (object.zombiePower == "BOSS_KING" ? 52 : 58))) / Math.max(0.3, devOpts.timeScale > 0 ? 1 : 1));
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

            var visW = living ? (berserk ? 22 : 14) : projW;
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
        if (sx < -60 || sx > canvas.width + 60 || sy < -60 || sy > canvas.height + 60) return;
        var ang = Math.atan2(-l.yspeed, l.xspeed);
        var size = Math.max(7, (l.vw || l.w || 14) * 0.75 * Math.max(0.8, cameraScaleX * 1.2));
        var tail = size * 3.2;
        var hostile = (l.team !== undefined) ? (l.team === 0) : l.fromZombie;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 14;
        var grad = ctx.createLinearGradient(-tail, 0, 0, 0);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, l.color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-tail, 0);
        ctx.lineTo(0, -size * 0.55);
        ctx.lineTo(0, size * 0.55);
        ctx.closePath();
        ctx.fill();
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
                    heroXP += 25;
                    score += 50;
                    if (heroXP >= heroXPNext) {
                        heroXP -= heroXPNext;
                        heroLevel++;
                        heroXPNext = Math.round(heroXPNext * 1.35);
                        rpgDamageMult = 1 + (heroLevel - 1) * 0.18;
                        for (let q = 0; q < characters.length; q++) {
                            var hh = characters[q];
                            if (hh.isZombie) continue;
                            hh.maxHealth += 20;
                            hh.health = hh.maxHealth;
                            hh.jetpackMaxFuel += 15;
                            hh.jetpackFuel = hh.jetpackMaxFuel;
                            hh.recomputeStats();
                        }
                        Components.addFloatingText("LEVEL UP! LVL " + heroLevel + "!", ch.x, ch.y + 85, "#00f5d4", 26);
                        Components.addRing(ch.x, ch.y, 360, "#00f5d4", 26);
                        Components.spawnSparks(ch.x, ch.y, "#00f5d4", 16);
                    } else {
                        Components.addFloatingText("+25 XP", c.x, c.y + 20, "#ffdd00", 14);
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

            if (sx + sw > -40 && sx < canvas.width + 40) {
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
                Components.spawnCoins(ch.x, ch.y + 15, 9);
                Components.spawnSparks(ch.x, ch.y, "#ffdd44", 18);
                score += 400;
                heroXP += 65;

                // Grant a permanent RPG Relic Upgrade!
                var roll = Math.floor(Math.random() * 4);
                if (roll === 0) {
                    rpgDamageMult += 0.18;
                    Components.addFloatingText("💎 CHEST: +18% WEAPON DAMAGE!", ch.x, ch.y + 65, "#ffdd44", 20);
                } else if (roll === 1) {
                    triggeredBy.maxHealth += 30;
                    triggeredBy.health = triggeredBy.maxHealth;
                    Components.addFloatingText("💎 CHEST: +30 MAX HP & FULL HEAL!", ch.x, ch.y + 65, "#55ff88", 20);
                } else if (roll === 2) {
                    triggeredBy.baseSpeed *= 1.08;
                    triggeredBy.speed = triggeredBy.baseSpeed;
                    Components.addFloatingText("💎 CHEST: +8% SWIFT BOOTS!", ch.x, ch.y + 65, "#00f5d4", 20);
                } else {
                    triggeredBy.maxAirJumps = Math.min(3, (triggeredBy.maxAirJumps || 1) + 1);
                    triggeredBy.airJumps = triggeredBy.maxAirJumps;
                    Components.addFloatingText("💎 CHEST: SKY RELIC (+1 AIR JUMP)!", ch.x, ch.y + 65, "#c77dff", 20);
                }
            }
        }
    }

    static zombieAI(zombie) {
        zombie.upPressed = false;
        zombie.downPressed = false;
        zombie.leftPressed = false;
        zombie.rightPressed = false;
        zombie.shootPressed = false;

        if (zombie.frozenTimer > 0) return;

        var target = null;
        var bestDist = Infinity;
        // Hunt living heroes first; once every hero has fallen the horde turns on the undead ones
        for (let pass = 0; pass < 2 && !target; pass++) {
            for (let i = 0; i < characters.length; i++) {
                var c = characters[i];
                if (c.dead) continue;
                if (pass === 0 && c.isZombie) continue;
                var d = Math.hypot(c.x - zombie.x, c.y - zombie.y);
                if (d < bestDist) {
                    bestDist = d;
                    target = c;
                }
            }
        }

        if (!target) {
            if (Math.random() < 0.02) zombie.aiDir = (Math.random() < 0.5 ? -1 : 1);
            if (zombie.aiDir < 0) zombie.leftPressed = true;
            if (zombie.aiDir > 0) zombie.rightPressed = true;
            return;
        }

        var dx = target.x - zombie.x;
        var dy = target.y - zombie.y;
        var pType = zombie.zombiePower;

        // 1. BAT / GARGOYLE SWOOPER AI (Flies freely through air & caverns!)
        if (pType == "BAT") {
            zombie.flies = true;
            var swoopY = target.y + 25 + Math.sin(Date.now() * 0.008 + zombie.id) * 55;
            if (dx > 12) zombie.rightPressed = true;
            else if (dx < -12) zombie.leftPressed = true;
            if (swoopY > zombie.y + 10) zombie.upPressed = true;
            else if (swoopY < zombie.y - 10) zombie.downPressed = true;
            return;
        }

        // 2. SKELETON ARCHER AI (Keeps sniper distance on towers/bridges & shoots arrows)
        if (pType == "ARCHER") {
            if (bestDist < 220) {
                // Retreat to keep range
                if (dx > 0) zombie.leftPressed = true;
                else zombie.rightPressed = true;
            } else if (bestDist > 480) {
                if (typeof Pathfinder !== "undefined") Pathfinder.updateZombieNavigation(zombie, target);
            }
            if (bestDist < 720 && Math.abs(dy) < 340) {
                zombie.degree = (Math.degrees(Math.atan2(dx, dy)) + 360) % 360;
                zombie.shootPressed = true;
            }
            return;
        }

        // 3. NECROMANCER MAGE AI (Fires 3-way arcane bolts & teleports when cornered)
        if (pType == "MAGE") {
            if (bestDist > 420 && typeof Pathfinder !== "undefined") {
                Pathfinder.updateZombieNavigation(zombie, target);
            } else if (bestDist < 160 && zombie.abilityCooldown <= 0) {
                // Arcane Blink Teleport!
                var blinkX = (dx > 0 ? -200 : 200);
                if (!CollisionDetector.hitsStatic(zombie, blinkX, 40, staticObjects)) {
                    Components.spawnSparks(zombie.x, zombie.y, "#c77dff", 10);
                    zombie.x += blinkX;
                    zombie.y += 40;
                    zombie.abilityCooldown = 140;
                }
            }
            if (bestDist < 680) {
                zombie.degree = (Math.degrees(Math.atan2(dx, dy)) + 360) % 360;
                zombie.shootPressed = true;
            }
            return;
        }

        // Standard A* Pathfinding for ground enemies (ZOMBIE, SLIME, KNIGHT, BOSS_KING, etc.)
        if (typeof Pathfinder !== "undefined") {
            Pathfinder.updateZombieNavigation(zombie, target);
        } else {
            if (dx > 15) zombie.rightPressed = true;
            else if (dx < -15) zombie.leftPressed = true;
        }

        // 4. ACID / MAGMA SLIME AI (Rhythmic high-arcing bounds)
        if (pType == "SLIME" || pType == "MINI_SLIME") {
            if (zombie.onGround && ((Date.now() + zombie.id * 90) % 600 < 80)) {
                zombie.upPressed = true;
            }
        }

        // 5. DARK ARMORED KNIGHT AI (Executes a fast horizontal Shield/Sword Lunge!)
        if (pType == "KNIGHT") {
            if (zombie.onGround && Math.abs(dx) < 300 && Math.abs(dy) < 70 && zombie.dashCooldown <= 0) {
                zombie.dashVX = (dx >= 0 ? 1 : -1) * 16;
                zombie.dashVY = 2;
                zombie.dashTimer = 10;
                zombie.dashCooldown = 95;
                Components.spawnSparks(zombie.x, zombie.y, "#e0fbfc", 6);
            }
        }

        // 6. CITADEL BOSS KING AI (5-way royal fireballs + heavy slam jumps)
        if (pType == "BOSS_KING") {
            if (bestDist < 780) {
                zombie.degree = (Math.degrees(Math.atan2(dx, dy)) + 360) % 360;
                zombie.shootPressed = true;
            }
            if (zombie.onGround && Math.abs(dx) < 340 && Math.random() < 0.03) {
                zombie.upPressed = true;
            }
        }

        if (pType == "LEAPER" && zombie.onGround && Math.abs(dx) < 280 && dy > 25) {
            zombie.upPressed = true;
        }
        if (pType == "SPITTER" && bestDist < 650) {
            zombie.degree = (Math.degrees(Math.atan2(dx, dy)) + 360) % 360;
            zombie.shootPressed = true;
        }
        if (pType == "EXPLODER" && bestDist < 85) {
            zombie.takeDamage(-999, 0, 0);
        }
    }
}
