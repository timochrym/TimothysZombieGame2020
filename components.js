class Components {

    static getMouseWorldPos() {
        var worldX = (mouseX - xc) / cameraScaleX;
        var worldY = (yc - mouseY) / cameraScaleY;
        return [worldX, worldY];
    }

    static directionArrow(object) {
        if (object.moveType == "WASD" && (mouseDown || useMouseAim) && !ULDRupPressed && !ULDRdownPressed && !ULDRleftPressed && !ULDRrightPressed) {
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

        var indicatorColor = object.isZombie ? "#4e9a36" : (godMode ? "#ffdd00" : (object.powerType ? "#ffdd44" : speedIndicatorColor));
        object.arrow = Polygon.rotate(arrow, [0, -48], object.degree);
        Polygon.create(object.arrow, indicatorColor, object);
    }

    static moveTypeFinder(object) {
        object.shootPressed = false;
        object.abilityPressed = false;
        object.mouseShooting = false;

        if (object.moveType == "WASD") {
            object.upPressed = WASDupPressed;
            object.downPressed = WASDdownPressed;
            object.leftPressed = WASDleftPressed;
            object.rightPressed = WASDrightPressed;
            object.abilityPressed = EPressed;
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
            } else if (multiplayer) {
                object.shootPressed = SpacePressed || EnterPressed;
            }
        } else if (object.moveType == "ULDR") {
            object.upPressed = ULDRupPressed;
            object.downPressed = ULDRdownPressed;
            object.leftPressed = ULDRleftPressed;
            object.rightPressed = ULDRrightPressed;
            object.shootPressed = EnterPressed || ShiftPressed;
            object.abilityPressed = ShiftPressed;
        } else if (object.moveType == "ZOMBIE") {
            Components.zombieAI(object);
        }

        object.lazerUp = false;
        object.lazerDown = false;
        object.lazerLeft = false;
        object.lazerRight = false;

        if (!multiplayer && object.lazerType == "ULDR" && !object.isZombie) {
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

        if (!object.isZombie) {
            Components.directionArrow(object);
        }
    }

    static healthBar(object) {
        var barW = healthBarW * (object.sizeScale || 1);
        var barH = healthBarH;
        var yOff = (object.s2 / 2) + 20;

        var screenX = (object.x - barW / 2) * cameraScaleX + xc;
        var screenY = (-object.y - yOff) * cameraScaleY + yc;
        var scaledW = barW * cameraScaleX;
        var scaledH = barH * cameraScaleY;

        ctx.fillStyle = healthBarDColor;
        ctx.fillRect(screenX, screenY, scaledW, scaledH);

        var pct = Math.max(0, Math.min(1, object.health / object.maxHealth));
        ctx.fillStyle = object.isZombie ? "#9be564" : (godMode ? "#ffdd00" : healthBarHColor);
        ctx.fillRect(screenX, screenY, scaledW * pct, scaledH);

        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(screenX, screenY, scaledW, scaledH);

        // Jetpack Joyride Fuel Bar right below Health Bar for Players!
        if (!object.isZombie && jetpackEnabled) {
            var fuelPct = Math.max(0, Math.min(1, object.jetpackFuel / object.jetpackMaxFuel));
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(screenX, screenY + scaledH + 2, scaledW, 4 * cameraScaleY);
            ctx.fillStyle = godMode ? "#ffdd00" : "#00f5d4";
            ctx.fillRect(screenX, screenY + scaledH + 2, scaledW * fuelPct, 4 * cameraScaleY);
        }

        if (object.powerTimer > 0) {
            var pPct = object.powerTimer / object.powerTimerMax;
            ctx.fillStyle = "#ffdd00";
            ctx.fillRect(screenX, screenY - 6 * cameraScaleY, scaledW * pPct, 4 * cameraScaleY);
        }
    }

    static shootLazer(object) {
        if (object.lazerCooldown > 0) {
            object.lazerCooldown--;
        }

        if (object.abilityCooldown > 0) {
            object.abilityCooldown--;
        }
        if (object.abilityPressed && (object.abilityCooldown == 0 || godMode) && !object.isZombie) {
            Components.addFloatingText("SHOCKWAVE!", object.x, object.y + 60, "#ffaa00", 20);
            Components.blowUp(object.x, object.y, "#ff9922", 24, 300, -45 * rpgDamageMult, object);
            object.abilityCooldown = godMode ? 10 : 150;
        }

        var canEnemyShoot = (object.zombiePower == "SPITTER" || object.zombiePower == "ARCHER" || object.zombiePower == "MAGE" || object.zombiePower == "BOSS_KING");
        if (object.isZombie && !canEnemyShoot && object.moveType == "ZOMBIE") {
            return;
        }

        var dx = 0;
        var dy = 0;
        var firing = false;

        if (object.mouseShooting) {
            var mPos = Components.getMouseWorldPos();
            dx = mPos[0] - object.x;
            dy = mPos[1] - object.y;
            firing = true;
        } else if (!multiplayer && object.lazerType == "ULDR" && !object.isZombie) {
            if (object.lazerUp) { dy += 1; firing = true; }
            if (object.lazerDown) { dy -= 1; firing = true; }
            if (object.lazerLeft) { dx -= 1; firing = true; }
            if (object.lazerRight) { dx += 1; firing = true; }
            if (!firing && EnterPressed) {
                var rad = Math.radians(object.degree);
                dx = Math.sin(rad);
                dy = Math.cos(rad);
                firing = true;
            }
        } else if (object.shootPressed) {
            var rad = Math.radians(object.degree);
            dx = Math.sin(rad);
            dy = Math.cos(rad);
            firing = true;
        }

        if (firing && object.lazerCooldown <= 0 && (dx != 0 || dy != 0)) {
            var len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;

            var isRapid = object.powerType == "RAPID" || (!object.isZombie && godMode);
            if (object.isZombie) {
                object.lazerCooldown = (object.zombiePower == "ARCHER") ? 48 : (object.zombiePower == "MAGE" ? 68 : (object.zombiePower == "BOSS_KING" ? 52 : 58));
            } else {
                object.lazerCooldown = godMode ? 3 : (isRapid ? 4 : lazerCooldownMax);
            }

            var angles = [0];
            if (!object.isZombie) {
                angles = godMode ? [-18, -9, 0, 9, 18] : (isRapid ? [-10, 0, 10] : [0]);
            } else if (object.zombiePower == "MAGE") {
                angles = [-16, 0, 16];
            } else if (object.zombiePower == "BOSS_KING") {
                angles = [-24, -12, 0, 12, 24];
            }

            var baseAngle = Math.atan2(dy, dx);
            var projSpeed = lazerSpeed;
            var projColor = isRapid ? "#ffdd44" : lazerColor;
            var projW = lazerW, projH = lazerH;
            var projDmg = Math.round(lazerDamage * rpgDamageMult * (godMode ? 2 : 1));

            if (object.isZombie) {
                if (object.zombiePower == "ARCHER") {
                    projSpeed = lazerSpeed * 0.88;
                    projColor = "#e0fbfc";
                    projW = 18;
                    projH = 8;
                    projDmg = -12;
                } else if (object.zombiePower == "MAGE") {
                    projSpeed = lazerSpeed * 0.55;
                    projColor = "#c77dff";
                    projW = 16;
                    projH = 16;
                    projDmg = -14;
                } else if (object.zombiePower == "BOSS_KING") {
                    projSpeed = lazerSpeed * 0.72;
                    projColor = "#ffbe0b";
                    projW = 20;
                    projH = 20;
                    projDmg = -18;
                } else {
                    projSpeed = lazerSpeed * 0.65;
                    projColor = "#33ff55";
                    projDmg = -9;
                }
            }

            for (var a = 0; a < angles.length; a++) {
                var ang = baseAngle + Math.radians(angles[a]);
                var vx = Math.cos(ang) * projSpeed;
                var vy = Math.sin(ang) * projSpeed;

                if (lazers.length >= 45) lazers.shift();
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
                    fromZombie: object.isZombie,
                    damage: projDmg,
                    life: 90
                });
            }
        }
    }

    static updateLazers() {
        for (let i = lazers.length - 1; i >= 0; i--) {
            var l = lazers[i];
            l.x += l.xspeed;
            l.y += l.yspeed;
            l.life--;

            Polygon.create(l.poly, l.color, l);

            var removeLazer = (l.life <= 0);

            if (!removeLazer && CollisionDetector.collision(l, [0, 0], allObjects)) {
                var hit = l.collidedWith;
                if (hit != l.owner) {
                    if (hit instanceof Character) {
                        if (hit.isZombie != l.fromZombie) {
                            hit.takeDamage(l.damage, l.xspeed * 0.35, l.yspeed * 0.2 + 2.5);
                            Components.spawnSparks(l.x, l.y, l.color, 5);
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

            // Magnetize toward nearest living player
            if (redGuy && !redGuy.isZombie) {
                var d = Math.hypot(redGuy.x - c.x, redGuy.y - c.y);
                if (d < (godMode ? 600 : 220) && d > 1) {
                    c.xspeed += ((redGuy.x - c.x) / d) * 1.4;
                    c.yspeed += ((redGuy.y - c.y) / d) * 1.4;
                }
            }

            if (CollisionDetector.collision(c, [0, c.yspeed], staticObjects)) {
                c.y += c.yspeed + c.yOver;
                c.yspeed *= -0.55;
                c.xspeed *= 0.85;
            } else {
                c.y += c.yspeed;
            }
            c.x += c.xspeed;

            // Draw Mario-style spinning gold coin
            var sx = c.x * cameraScaleX + xc;
            var sy = -c.y * cameraScaleY + yc;
            var radX = Math.max(3, Math.abs(Math.cos(c.life * 0.12)) * 11 * cameraScaleX);
            var radY = 11 * cameraScaleY;
            ctx.save();
            ctx.fillStyle = "#ffdd00";
            ctx.strokeStyle = "#b5651d";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(sx, sy, radX, radY, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            var picked = false;
            for (let p = 0; p < characters.length; p++) {
                var ch = characters[p];
                if (!ch.isZombie && Math.hypot(ch.x - c.x, ch.y - c.y) < ch.s1 * 0.75) {
                    picked = true;
                    coins++;
                    heroXP += 25;
                    score += 50;
                    if (heroXP >= heroXPNext) {
                        heroXP -= heroXPNext;
                        heroLevel++;
                        heroXPNext = Math.round(heroXPNext * 1.35);
                        rpgDamageMult = 1 + (heroLevel - 1) * 0.18;
                        ch.maxHealth += 20;
                        ch.health = ch.maxHealth;
                        ch.jetpackMaxFuel += 15;
                        ch.jetpackFuel = ch.jetpackMaxFuel;
                        Components.addFloatingText("RPG LEVEL UP! LVL " + heroLevel + "!", ch.x, ch.y + 85, "#00f5d4", 24);
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
            life: 45,
            maxLife: 45
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
            ctx.globalAlpha = alpha;
            ctx.font = "bold " + Math.round(ft.size * cameraScaleX) + "px monospace";
            ctx.textAlign = "center";
            ctx.fillStyle = "#000000";
            ctx.fillText(ft.text, sx + 2, sy + 2);
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
        screenShake = Math.min(18, screenShake + 10);

        for (let i = 0; i < count; i++) {
            if (particles.length >= 60) particles.shift();
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
                    if (!source || obj.isZombie != source.isZombie) {
                        obj.takeDamage(damage * (1 - dist / radius * 0.5), nx * force, ny * force + 6);
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

        var target = null;
        var bestDist = Infinity;
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (!c.isZombie && !c.death) {
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
