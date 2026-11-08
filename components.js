class Components {

    static directionArrow(object) {
        var hasInput = false;
        if (object.upPressed && object.rightPressed) {
            object.degreeToGoCW = 45;
            hasInput = true;
        } else if (object.downPressed && object.rightPressed) {
            object.degreeToGoCW = 135;
            hasInput = true;
        } else if (object.downPressed && object.leftPressed) {
            object.degreeToGoCW = 225;
            hasInput = true;
        } else if (object.upPressed && object.leftPressed) {
            object.degreeToGoCW = 315;
            hasInput = true;
        } else if (object.upPressed) {
            object.degreeToGoCW = 0;
            hasInput = true;
        } else if (object.rightPressed) {
            object.degreeToGoCW = 90;
            hasInput = true;
        } else if (object.downPressed) {
            object.degreeToGoCW = 180;
            hasInput = true;
        } else if (object.leftPressed) {
            object.degreeToGoCW = 270;
            hasInput = true;
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

        // Cap angular speed
        var maxDegSpeed = degreeSpeed * 5;
        if (object.degreeSpeedX > maxDegSpeed) object.degreeSpeedX = maxDegSpeed;
        if (object.degreeSpeedX < -maxDegSpeed) object.degreeSpeedX = -maxDegSpeed;

        object.degree = (object.degree + object.degreeSpeedX + 360) % 360;

        var indicatorColor = object.isZombie ? "#4e9a36" : (object.powerType ? "#ffdd44" : speedIndicatorColor);
        object.arrow = Polygon.rotate(arrow, [0, -55], object.degree);
        Polygon.create(object.arrow, indicatorColor, object);
    }

    static moveTypeFinder(object) {
        object.shootPressed = false;
        object.abilityPressed = false;

        if (object.moveType == "WASD") {
            object.upPressed = WASDupPressed || (!multiplayer && SpacePressed);
            object.downPressed = WASDdownPressed;
            object.leftPressed = WASDleftPressed;
            object.rightPressed = WASDrightPressed;
            object.abilityPressed = EPressed;
            if (multiplayer) {
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

        // Lazer controls
        object.lazerUp = false;
        object.lazerDown = false;
        object.lazerLeft = false;
        object.lazerRight = false;

        if (!multiplayer && object.lazerType == "ULDR" && !object.isZombie) {
            object.lazerUp = ULDRupPressed;
            object.lazerDown = ULDRdownPressed;
            object.lazerLeft = ULDRleftPressed;
            object.lazerRight = ULDRrightPressed;
        } else if (object.shootPressed) {
            // Shoot in the direction of the character's arrow
            var rad = Math.radians(object.degree);
            object.lazerDirX = Math.sin(rad);
            object.lazerDirY = Math.cos(rad);
        }

        Components.directionArrow(object);
    }

    static healthBar(object) {
        var barW = healthBarW * (object.sizeScale || 1);
        var barH = healthBarH;
        var yOff = (object.s2 / 2) + 22;

        var screenX = (object.x - barW / 2) * cameraScaleX + xc;
        var screenY = (-object.y - yOff) * cameraScaleY + yc;
        var scaledW = barW * cameraScaleX;
        var scaledH = barH * cameraScaleY;

        // Background (Damage / Red)
        ctx.fillStyle = healthBarDColor;
        ctx.fillRect(screenX, screenY, scaledW, scaledH);

        // Foreground (Health / Green)
        var pct = Math.max(0, Math.min(1, object.health / object.maxHealth));
        ctx.fillStyle = object.isZombie ? "#9be564" : healthBarHColor;
        ctx.fillRect(screenX, screenY, scaledW * pct, scaledH);

        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(screenX, screenY, scaledW, scaledH);

        // Active Power timer bar
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

        // Player ability: Blow up shockwave when pressing E (or Shift for P2)
        if (object.abilityCooldown > 0) {
            object.abilityCooldown--;
        }
        if (object.abilityPressed && object.abilityCooldown == 0 && !object.isZombie) {
            Components.blowUp(object.x, object.y, "#ff9922", 18, 260, -35, object);
            object.abilityCooldown = 180; // 3 seconds cooldown
        }

        // Zombies with Spitter power can shoot acid lazers
        if (object.isZombie && object.zombiePower != "SPITTER" && object.moveType == "ZOMBIE") {
            return;
        }

        var dx = 0;
        var dy = 0;
        var firing = false;

        if (!multiplayer && object.lazerType == "ULDR" && !object.isZombie) {
            if (object.lazerUp) { dy += 1; firing = true; }
            if (object.lazerDown) { dy -= 1; firing = true; }
            if (object.lazerLeft) { dx -= 1; firing = true; }
            if (object.lazerRight) { dx += 1; firing = true; }
            // Also allow Space/Enter/F to shoot in facing direction
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

            var isRapid = object.powerType == "RAPID";
            object.lazerCooldown = object.isZombie ? 55 : (isRapid ? 5 : lazerCooldownMax);

            var angles = isRapid ? [-12, 0, 12] : [0];
            var baseAngle = Math.atan2(dy, dx);

            for (var a = 0; a < angles.length; a++) {
                var ang = baseAngle + Math.radians(angles[a]);
                var vx = Math.cos(ang) * (object.isZombie ? lazerSpeed * 0.65 : lazerSpeed);
                var vy = Math.sin(ang) * (object.isZombie ? lazerSpeed * 0.65 : lazerSpeed);

                lazers.push({
                    x: object.x + Math.cos(ang) * (object.s1 * 0.6),
                    y: object.y + Math.sin(ang) * (object.s2 * 0.6),
                    xspeed: vx,
                    yspeed: vy,
                    hitbox: Math.makeHitbox(lazerW, lazerH),
                    poly: Math.makeHitbox(lazerW, lazerH),
                    color: object.isZombie ? "#33ff55" : (isRapid ? "#ffdd44" : lazerColor),
                    owner: object,
                    fromZombie: object.isZombie,
                    damage: object.isZombie ? -8 : lazerDamage,
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

            // Check collision with allObjects
            if (!removeLazer && CollisionDetector.collision(l, [0, 0], allObjects)) {
                var hit = l.collidedWith;
                if (hit != l.owner) {
                    // Ignore same-team hits unless it's a physics object
                    if (hit instanceof Character) {
                        if (hit.isZombie != l.fromZombie) {
                            hit.takeDamage(l.damage, l.xspeed * 0.35, l.yspeed * 0.25 + 3);
                            Components.spawnSparks(l.x, l.y, l.color, 4);
                            removeLazer = true;
                        }
                    } else {
                        // Hit a static or moving object
                        if (hit.movable) {
                            hit.xspeed += l.xspeed * 0.25;
                            hit.yspeed += l.yspeed * 0.15 + 2;
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

    static spawnSparks(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            var sz = 6 + Math.random() * 6;
            particles.push({
                x: x,
                y: y,
                xspeed: (Math.random() - 0.5) * 10,
                yspeed: (Math.random() - 0.2) * 10,
                poly: Math.makeHitbox(sz, sz),
                color: color,
                life: 15 + Math.floor(Math.random() * 15)
            });
        }
    }

    static blowUp(x, y, color, count = 16, radius = 220, damage = -30, source = null) {
        // Spawn flying debris polygons
        for (let i = 0; i < count; i++) {
            var sz = 10 + Math.random() * 16;
            var angle = Math.random() * Math.PI * 2;
            var spd = 4 + Math.random() * 14;
            particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                xspeed: Math.cos(angle) * spd,
                yspeed: Math.sin(angle) * spd + 4,
                poly: Math.makeHitbox(sz, sz),
                color: i % 2 == 0 ? color : "#ffcc33",
                life: 25 + Math.floor(Math.random() * 25)
            });
        }

        // Apply blast wave to nearby objects and characters
        for (let i = 0; i < allObjects.length; i++) {
            var obj = allObjects[i];
            if (obj == source || obj.dead) continue;
            var dx = obj.x - x;
            var dy = obj.y - y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius && dist > 0.1) {
                var force = (1 - dist / radius) * 18;
                var nx = dx / dist;
                var ny = dy / dist;
                if (obj instanceof Character) {
                    if (!source || obj.isZombie != source.isZombie) {
                        obj.takeDamage(damage * (1 - dist / radius * 0.5), nx * force, ny * force + 6);
                    }
                } else if (obj.movable) {
                    obj.xspeed += nx * force;
                    obj.yspeed += ny * force + 6;
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

    static zombieAI(zombie) {
        zombie.upPressed = false;
        zombie.downPressed = false;
        zombie.leftPressed = false;
        zombie.rightPressed = false;
        zombie.shootPressed = false;

        // Find closest living non-zombie character
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
            // Wander slowly if all players are zombies
            if (Math.random() < 0.02) zombie.aiDir = (Math.random() < 0.5 ? -1 : 1);
            if (zombie.aiDir < 0) zombie.leftPressed = true;
            if (zombie.aiDir > 0) zombie.rightPressed = true;
            return;
        }

        var dx = target.x - zombie.x;
        var dy = target.y - zombie.y;

        if (dx > 15) {
            zombie.rightPressed = true;
        } else if (dx < -15) {
            zombie.leftPressed = true;
        }

        // Jump if target is above or if blocked horizontally
        var blockedX = CollisionDetector.collision(zombie, [zombie.rightPressed ? 8 : -8, 0], allObjects);
        if ((dy > 45 && Math.abs(dx) < 350) || blockedX) {
            zombie.upPressed = true;
        }

        // Zombie Powers
        if (zombie.zombiePower == "LEAPER" && zombie.onGround && Math.abs(dx) < 280 && dy > 20) {
            zombie.upPressed = true;
        }
        if (zombie.zombiePower == "SPITTER" && bestDist < 650) {
            zombie.degree = (Math.degrees(Math.atan2(dx, dy)) + 360) % 360;
            zombie.shootPressed = true;
        }
        if (zombie.zombiePower == "EXPLODER" && bestDist < 85) {
            // Exploder blows up when right next to player!
            zombie.takeDamage(-999, 0, 0);
        }
    }
}
