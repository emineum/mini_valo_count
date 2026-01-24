
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';


interface Enemy {
    group: THREE.Group;
    body: THREE.Mesh;
    head: THREE.Mesh;
    healthBarFill: THREE.Mesh;
    id: number;
    health: number;
    lastAttackTime: number;
    isDying?: boolean;
    deathTime?: number;
}

interface Bullet {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    prevPosition: THREE.Vector3;
}

interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number; // 0 to 1
    type: 'blood' | 'fire';
}

const App: React.FC = () => {
    const MAP_SIZE = 25;
    const ENEMY_SPEED = 2.0;
    const PLAYER_MAX_HP = 201;
    const FIRE_RATE = 110;

    const playerHP = useRef(PLAYER_MAX_HP);
    const lastHitTime = useRef(0);
    const INVINCIBILITY_PERIOD = 1000;
    const isDead = useRef(false);
    const isSpawnInvincible = useRef(false);

    const currentWeapon = useRef<'gun' | 'knife'>('gun');
    const weaponGroup = useRef<THREE.Group>(new THREE.Group());
    const isAttacking = useRef(false);
    const isFiring = useRef(false);
    const lastFireTime = useRef(0);

    const mouseShake = useRef(0);
    const score = useRef(0);
    const enemies = useRef<Enemy[]>([]);
    const particles = useRef<Particle[]>([]);

    // Recoil state
    const weaponRecoilZ = useRef(0);
    const weaponRecoilRot = useRef(0);
    const weaponShakeX = useRef(0);
    const weaponShakeY = useRef(0);

    useEffect(() => {
        // --- 1. Scene Setup ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffa577);
        scene.fog = new THREE.Fog(0xffa577, 20, 100);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(renderer.domElement);

        // --- 2. Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffe0bd, 0.6);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffd5a1, 1.8);
        sunLight.position.set(-80, 40, -50);
        sunLight.castShadow = true;
        scene.add(sunLight);

        // --- 3. Viewmodel ---
        camera.add(weaponGroup.current);
        scene.add(camera);

        const gunMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.15, 0.6),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 })
        );
        gunMesh.position.set(0.35, -0.3, -0.6);

        const knifeGroup = new THREE.Group();
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0, 0);
        bladeShape.lineTo(0.06, 0.04);
        bladeShape.lineTo(0.06, 0.35);
        bladeShape.lineTo(0.02, 0.45);
        bladeShape.lineTo(-0.02, 0.35);
        bladeShape.lineTo(-0.02, 0);
        bladeShape.lineTo(0, 0);

        const extrudeSettings = { depth: 0.01, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01 };
        const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1.0, roughness: 0.1 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.rotation.x = -Math.PI / 2;
        blade.position.y = 0.05;

        const handleGeo = new THREE.CylinderGeometry(0.025, 0.02, 0.18, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.z = 0.15;
        handle.rotation.x = -Math.PI / 2;

        const guardGeo = new THREE.BoxGeometry(0.08, 0.02, 0.04);
        const guard = new THREE.Mesh(guardGeo, handleMat);
        guard.position.z = 0.05;
        guard.rotation.x = -Math.PI / 2;

        knifeGroup.add(blade, handle, guard);
        knifeGroup.position.set(0.4, -0.4, -0.5);
        knifeGroup.rotation.x = Math.PI / 6;
        knifeGroup.rotation.y = -Math.PI / 12;

        const updateWeaponModel = () => {
            weaponGroup.current.clear();
            if (currentWeapon.current === 'gun') {
                weaponGroup.current.add(gunMesh);
            } else {
                weaponGroup.current.add(knifeGroup);
            }
            const weaponTypeUI = document.getElementById('weapon-type');
            if (weaponTypeUI) {
                weaponTypeUI.innerText = currentWeapon.current.toUpperCase();
                weaponTypeUI.style.color = currentWeapon.current === 'knife' ? '#00ffff' : '#ffffff';
            }
        };
        updateWeaponModel();

        // --- 4. Environment ---
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const grid = new THREE.GridHelper(MAP_SIZE * 2, 25, 0x444444, 0x222222);
        scene.add(grid);

        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x111111, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.5
        });
        const wallHeight = 25;
        const createWall = (w: number, h: number, d: number, x: number, y: number, z: number) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            m.position.set(x, y, z);
            scene.add(m);
        };
        createWall(MAP_SIZE * 2, wallHeight, 1, 0, wallHeight / 2, -MAP_SIZE);
        createWall(MAP_SIZE * 2, wallHeight, 1, 0, wallHeight / 2, MAP_SIZE);
        createWall(1, wallHeight, MAP_SIZE * 2, MAP_SIZE, wallHeight / 2, 0);
        createWall(1, wallHeight, MAP_SIZE * 2, -MAP_SIZE, wallHeight / 2, 0);

        const createEnemyObj = (): Enemy => {
            const group = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 1.8, 0.4),
                new THREE.MeshStandardMaterial({ color: 0x882222, metalness: 0.5, transparent: true, emissive: 0x000000 })
            );
            body.position.y = 0.9;
            const head = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.5, 0.5),
                new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5, transparent: true })
            );
            head.position.y = 2.05;

            const healthBarGroup = new THREE.Group();
            healthBarGroup.position.y = 2.6;
            const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
            const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.08), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
            fill.position.z = 0.01;
            healthBarGroup.add(bg, fill);

            group.add(body, head, healthBarGroup);
            const angle = Math.random() * Math.PI * 2;
            const radius = 20 + Math.random() * 5;
            group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

            return { group, body, head, healthBarFill: fill, health: 150, id: Date.now() + Math.random(), lastAttackTime: 0 };
        };

        const spawnEnemies = (count: number) => {
            for (let i = 0; i < count; i++) {
                const enemy = createEnemyObj();
                enemies.current.push(enemy);
                scene.add(enemy.group);
            }
        };
        spawnEnemies(5);

        const emitParticles = (position: THREE.Vector3, type: 'blood' | 'fire', count: number = 1, intensity: number = 1) => {
            for (let i = 0; i < count; i++) {
                if (Math.random() > intensity) continue;
                const size = type === 'fire' ? 0.05 + Math.random() * 0.15 : 0.1 + Math.random() * 0.2;
                const color = type === 'fire' ? (Math.random() > 0.5 ? 0xff4400 : 0xffaa00) : 0x882222;
                const mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(size, size, size),
                    new THREE.MeshStandardMaterial({
                        color: color,
                        transparent: true,
                        emissive: type === 'fire' ? color : 0x000000,
                        emissiveIntensity: type === 'fire' ? 2 : 0
                    })
                );
                mesh.position.copy(position);
                if (type === 'fire') {
                    mesh.position.y += Math.random() * 2;
                    mesh.position.x += (Math.random() - 0.5) * 0.6;
                    mesh.position.z += (Math.random() - 0.5) * 0.3;
                } else {
                    mesh.position.y += 1.0;
                }
                const velocity = type === 'fire' ?
                    new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.05 + Math.random() * 0.05, (Math.random() - 0.5) * 0.02) :
                    new THREE.Vector3((Math.random() - 0.5) * 0.2, Math.random() * 0.2, (Math.random() - 0.5) * 0.2);
                particles.current.push({ mesh, velocity, life: 1.0, type });
                scene.add(mesh);
            }
        };

        const updatePlayerHPUI = () => {
            const hpBar = document.getElementById('hp-bar');
            const hpText = document.getElementById('hp-text');
            if (hpBar) hpBar.style.width = `${(playerHP.current / PLAYER_MAX_HP) * 100}%`;
            if (hpText) hpText.innerText = `${Math.max(0, playerHP.current)} / ${PLAYER_MAX_HP}`;
        };

        const velocity = new THREE.Vector3(0, 0, 0);

        const respawnPlayer = () => {
            isDead.current = false;
            isSpawnInvincible.current = true;
            playerHP.current = PLAYER_MAX_HP;
            camera.position.set(0, 1.6, 5);
            velocity.set(0, 0, 0);
            updatePlayerHPUI();
            const deathScreen = document.getElementById('death-screen');
            if (deathScreen) deathScreen.style.display = 'none';
            const protectionUI = document.getElementById('protection-indicator');
            if (protectionUI) protectionUI.style.opacity = '1';
            setTimeout(() => {
                isSpawnInvincible.current = false;
                if (protectionUI) protectionUI.style.opacity = '0';
            }, 2000);
        };

        const damagePlayer = (amount: number) => {
            if (isDead.current || isSpawnInvincible.current) return;
            const now = performance.now();
            if (now - lastHitTime.current < INVINCIBILITY_PERIOD) return;
            playerHP.current -= amount;
            lastHitTime.current = now;
            updatePlayerHPUI();
            const flash = document.getElementById('damage-flash');
            if (flash) {
                flash.style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
                setTimeout(() => { flash.style.backgroundColor = 'rgba(255, 0, 0, 0)'; }, 100);
            }
            if (playerHP.current <= 0) {
                isDead.current = true;
                const deathScreen = document.getElementById('death-screen');
                if (deathScreen) deathScreen.style.display = 'flex';
                setTimeout(respawnPlayer, 3000);
            }
        };

        const onEnemyDeath = (enemy: Enemy) => {
            if (enemy.isDying) return;
            enemy.isDying = true;
            enemy.deathTime = performance.now();
            const barGroup = enemy.group.children.find(c => c instanceof THREE.Group);
            if (barGroup) barGroup.visible = false;
            score.current++;
            const scoreEl = document.getElementById('kill-count');
            if (scoreEl) scoreEl.innerText = score.current.toString();
            setTimeout(() => {
                const newEnemy = createEnemyObj();
                enemies.current.push(newEnemy);
                scene.add(newEnemy.group);
            }, 3500);
        };

        const applyDamage = (enemy: Enemy, damage: number) => {
            if (enemy.isDying) return;
            enemy.health -= damage;
            if (enemy.health < 0) enemy.health = 0;
            const healthPercent = enemy.health / 150;
            enemy.healthBarFill.scale.setX(healthPercent);
            enemy.healthBarFill.position.x = -0.55 * (1 - healthPercent);
            if (enemy.health <= 0) onEnemyDeath(enemy);
        };

        const bullets: Bullet[] = [];
        const bulletPathLine = new THREE.Line3();

        const shoot = (isHeavy: boolean = false) => {
            const now = performance.now();
            if (isAttacking.current || !isLocked || isDead.current || isSpawnInvincible.current) return;

            if (currentWeapon.current === 'gun') {
                if (now - lastFireTime.current < FIRE_RATE) return;
                lastFireTime.current = now;

                const mesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.08, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0xffff00 })
                );
                const direction = new THREE.Vector3();
                camera.getWorldDirection(direction);
                mesh.position.copy(camera.position);
                bullets.push({
                    mesh,
                    velocity: direction.clone().multiplyScalar(3.0),
                    prevPosition: mesh.position.clone()
                });
                scene.add(mesh);

                // --- AKM Style Stable Recoil (Instant Kick) ---
                camera.rotation.x += 0.05 + Math.random() * 0.02;
                camera.rotation.y += (Math.random() - 0.5) * 0.03;

                weaponRecoilZ.current += 0.22;
                weaponRecoilRot.current += 0.25;
                weaponShakeX.current = (Math.random() - 0.5) * 0.06;
                weaponShakeY.current = (Math.random() - 0.5) * 0.06;

            } else {
                isAttacking.current = true;
                let t = 0;
                // Heavy attack is slightly slower to feel more impactful
                const swingSpeed = isHeavy ? 0.1 : 0.15;
                const swing = () => {
                    t += swingSpeed;
                    weaponGroup.current.rotation.x = (Math.PI / 6) + Math.sin(t * Math.PI) * -1.5;
                    weaponGroup.current.rotation.y = (Math.PI / -12) + Math.sin(t * Math.PI) * 0.8;
                    if (t >= 0.4 && t <= 0.6) {
                        enemies.current.forEach(enemy => {
                            if (!enemy.isDying && camera.position.distanceTo(enemy.group.position) < 4.5) {
                                const lookDir = new THREE.Vector3();
                                camera.getWorldDirection(lookDir);
                                const toEnemy = new THREE.Vector3().subVectors(enemy.group.position, camera.position).normalize();
                                // Left Click: 50 Damage, Right Click: 150 Damage
                                if (toEnemy.dot(lookDir) > 0.5) applyDamage(enemy, isHeavy ? 150 : 50);
                            }
                        });
                    }
                    if (t < 1) requestAnimationFrame(swing);
                    else {
                        weaponGroup.current.rotation.set(Math.PI / 6, -Math.PI / 12, 0);
                        isAttacking.current = false;
                    }
                };
                swing();
            }
        };

        const moveState = { forward: false, backward: false, left: false, right: false, canJump: true, isAirborne: false };
        const direction = new THREE.Vector3();
        let isLocked = false;

        const onKeyDown = (e: KeyboardEvent) => {
            if (isDead.current) return;
            if (e.code === 'KeyW') moveState.forward = true;
            if (e.code === 'KeyS') moveState.backward = true;
            if (e.code === 'KeyA') moveState.left = true;
            if (e.code === 'KeyD') moveState.right = true;
            if (e.code === 'Digit1') { currentWeapon.current = 'gun'; updateWeaponModel(); }
            if (e.code === 'Digit2') { currentWeapon.current = 'knife'; updateWeaponModel(); }
            if (e.code === 'Space' && moveState.canJump) { velocity.y += 10; moveState.canJump = false; moveState.isAirborne = true; }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'KeyW') moveState.forward = false;
            if (e.code === 'KeyS') moveState.backward = false;
            if (e.code === 'KeyA') moveState.left = false;
            if (e.code === 'KeyD') moveState.right = false;
        };
        const onWheel = (e: WheelEvent) => {
            if (!isLocked || isDead.current || isSpawnInvincible.current) return;
            currentWeapon.current = e.deltaY > 0 ? 'knife' : 'gun';
            updateWeaponModel();
        };

        const onMouseDown = (e: MouseEvent) => {
            if (isLocked) {
                if (e.button === 0) { // Left Click
                    isFiring.current = true;
                    if (currentWeapon.current === 'knife') shoot(false);
                } else if (e.button === 2) { // Right Click
                    if (currentWeapon.current === 'knife') shoot(true);
                }
            }
        };
        const onMouseUp = (e: MouseEvent) => {
            isFiring.current = false;
        };
        const onContextMenu = (e: MouseEvent) => {
            e.preventDefault(); // Prevent right-click menu during gameplay
        };

        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('contextmenu', onContextMenu);

        document.addEventListener('mousemove', (e) => {
            if (!isLocked || isDead.current) return;
            camera.rotation.y -= e.movementX * 0.002;
            camera.rotation.x -= e.movementY * 0.002;

            // Accumulate shake for speed boost
            const moveDelta = Math.abs(e.movementX) + Math.abs(e.movementY);
            mouseShake.current = Math.min(100, mouseShake.current + moveDelta * 0.25);

            weaponGroup.current.position.x = THREE.MathUtils.lerp(weaponGroup.current.position.x, -e.movementX * 0.0004, 0.1);
            weaponGroup.current.position.y = THREE.MathUtils.lerp(weaponGroup.current.position.y, e.movementY * 0.0004, 0.1);
        });

        const instructions = document.getElementById('instructions');
        instructions?.addEventListener('click', () => document.body.requestPointerLock());
        document.addEventListener('pointerlockchange', () => {
            isLocked = document.pointerLockElement === document.body;
            if (instructions) instructions.style.display = isLocked ? 'none' : 'block';
            if (!isLocked) isFiring.current = false;
        });

        camera.rotation.order = 'YXZ';
        camera.position.set(0, 1.6, 5);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('wheel', onWheel);

        let prevTime = performance.now();
        const animate = () => {
            requestAnimationFrame(animate);
            const time = performance.now();
            const delta = (time - prevTime) / 1000;

            if (isLocked) {
                if (isFiring.current && currentWeapon.current === 'gun' && !isDead.current) {
                    shoot(false);
                }

                camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

                if (!isDead.current) {
                    // Decay shake value over time
                    mouseShake.current *= 0.94;

                    velocity.x -= velocity.x * 10.0 * delta;
                    velocity.z -= velocity.z * 10.0 * delta;
                    velocity.y -= 9.8 * 3.0 * delta;

                    direction.z = Number(moveState.forward) - Number(moveState.backward);
                    direction.x = Number(moveState.right) - Number(moveState.left);
                    if (direction.x !== 0 || direction.z !== 0) direction.normalize();

                    // --- Integrated Multiplier Logic ---
                    let multiplier = currentWeapon.current === 'knife' ? 1.5 : 1.0;

                    // Check for Boost: Either high mouse shake or airborne shake
                    const isMouseBoosting = mouseShake.current > 20;
                    const isAirborneBoosting = moveState.isAirborne && mouseShake.current > 15;

                    if (isMouseBoosting || isAirborneBoosting) {
                        multiplier = 1.7;
                    }

                    const boostInd = document.getElementById('boost-indicator');
                    if (boostInd) boostInd.style.opacity = (isMouseBoosting || isAirborneBoosting) ? '1' : '0';

                    const moveSpeed = 80.0 * multiplier;
                    if (moveState.forward || moveState.backward) velocity.z -= direction.z * moveSpeed * delta;
                    if (moveState.left || moveState.right) velocity.x -= direction.x * moveSpeed * delta;

                    const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                    camDir.y = 0; camDir.normalize();
                    const camSide = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
                    camSide.y = 0; camSide.normalize();

                    camera.position.add(camDir.multiplyScalar(-velocity.z * delta));
                    camera.position.add(camSide.multiplyScalar(-velocity.x * delta));
                    camera.position.y += velocity.y * delta;

                    const playerPadding = 0.8;
                    if (camera.position.x > MAP_SIZE - playerPadding) camera.position.x = MAP_SIZE - playerPadding;
                    if (camera.position.x < -MAP_SIZE + playerPadding) camera.position.x = -MAP_SIZE + playerPadding;
                    if (camera.position.z > MAP_SIZE - playerPadding) camera.position.z = MAP_SIZE - playerPadding;
                    if (camera.position.z < -MAP_SIZE + playerPadding) camera.position.z = -MAP_SIZE + playerPadding;

                    if (camera.position.y < 1.6) {
                        velocity.y = 0; camera.position.y = 1.6; moveState.canJump = true; moveState.isAirborne = false;
                    }
                }

                // Enemy AI
                for (let i = enemies.current.length - 1; i >= 0; i--) {
                    const enemy = enemies.current[i];
                    if (enemy.isDying && enemy.deathTime) {
                        const elapsed = time - enemy.deathTime;
                        const bodyMat = enemy.body.material as any;
                        const headMat = enemy.head.material as any;
                        if (elapsed < 2000) {
                            emitParticles(enemy.group.position, 'fire', 3, 1.0);
                            bodyMat.emissive.setHex(0xff3300);
                            bodyMat.emissiveIntensity = 2.0 + Math.sin(time * 0.05) * 1.0;
                            headMat.emissive.setHex(0xff3300);
                            headMat.emissiveIntensity = 2.0 + Math.cos(time * 0.05) * 1.0;
                            bodyMat.color.lerp(new THREE.Color(0x050505), delta * 2);
                            headMat.color.lerp(new THREE.Color(0x050505), delta * 2);
                        } else {
                            const fadeElapsed = elapsed - 2000;
                            const fadeFactor = Math.max(0, 1 - (fadeElapsed / 1000));
                            if (fadeFactor > 0) {
                                emitParticles(enemy.group.position, 'fire', 2, fadeFactor);
                                bodyMat.emissiveIntensity = 2.0 * fadeFactor;
                                headMat.emissiveIntensity = 2.0 * fadeFactor;
                            } else {
                                bodyMat.emissiveIntensity = 0;
                                headMat.emissiveIntensity = 0;
                            }
                            const bodyFadeT = Math.max(0, 1 - (fadeElapsed / 1500));
                            bodyMat.opacity = bodyFadeT;
                            headMat.opacity = bodyFadeT;
                            if (bodyFadeT <= 0) {
                                scene.remove(enemy.group);
                                enemies.current.splice(i, 1);
                                continue;
                            }
                        }
                    } else {
                        const toPlayer = new THREE.Vector3().subVectors(camera.position, enemy.group.position);
                        toPlayer.y = 0;
                        const distance = toPlayer.length();
                        if (distance > 1.2) {
                            if (!isDead.current) {
                                toPlayer.normalize();
                                enemy.group.position.add(toPlayer.multiplyScalar(ENEMY_SPEED * delta));
                            }
                        } else if (!isDead.current) {
                            damagePlayer(100);
                        }
                        enemy.group.lookAt(camera.position.x, 0, camera.position.z);
                        const barGroup = enemy.group.children.find(c => c instanceof THREE.Group);
                        if (barGroup) barGroup.lookAt(camera.position);
                    }
                }

                // Bullets
                for (let i = bullets.length - 1; i >= 0; i--) {
                    const b = bullets[i];
                    b.prevPosition.copy(b.mesh.position);
                    b.mesh.position.add(b.velocity);
                    bulletPathLine.set(b.prevPosition, b.mesh.position);
                    let hit = false;
                    for (let j = enemies.current.length - 1; j >= 0; j--) {
                        const enemy = enemies.current[j];
                        if (enemy.isDying) continue;
                        const headPos = new THREE.Vector3();
                        enemy.head.getWorldPosition(headPos);
                        const bodyPos = new THREE.Vector3();
                        enemy.body.getWorldPosition(bodyPos);
                        const closestHead = new THREE.Vector3();
                        bulletPathLine.closestPointToPoint(headPos, true, closestHead);
                        if (closestHead.distanceTo(headPos) < 0.8) {
                            applyDamage(enemy, 150); hit = true; break;
                        }
                        const closestBody = new THREE.Vector3();
                        bulletPathLine.closestPointToPoint(bodyPos, true, closestBody);
                        if (closestBody.distanceTo(bodyPos) < 1.4) {
                            applyDamage(enemy, 74); hit = true; break;
                        }
                    }
                    if (hit || b.mesh.position.length() > 300) {
                        scene.remove(b.mesh);
                        bullets.splice(i, 1);
                    }
                }

                // Particles
                for (let i = particles.current.length - 1; i >= 0; i--) {
                    const p = particles.current[i];
                    p.mesh.position.add(p.velocity);
                    if (p.type === 'blood') p.velocity.y -= 0.005;
                    else {
                        p.velocity.y += 0.001;
                        p.velocity.x += (Math.random() - 0.5) * 0.005;
                        p.velocity.z += (Math.random() - 0.5) * 0.005;
                    }
                    p.life -= p.type === 'fire' ? 0.02 : 0.015;
                    p.mesh.scale.setScalar(p.life);
                    (p.mesh.material as any).opacity = p.life;
                    if (p.life <= 0) {
                        scene.remove(p.mesh);
                        particles.current.splice(i, 1);
                    }
                }

                if (!isDead.current) {
                    const opacity = isSpawnInvincible.current ? 0.3 : 1.0;
                    weaponGroup.current.traverse((child: any) => {
                        if (child.isMesh && child.material) {
                            child.material.transparent = true;
                            child.material.opacity = opacity;
                        }
                    });

                    weaponRecoilZ.current = THREE.MathUtils.lerp(weaponRecoilZ.current, 0, 0.12);
                    weaponRecoilRot.current = THREE.MathUtils.lerp(weaponRecoilRot.current, 0, 0.12);
                    weaponShakeX.current = THREE.MathUtils.lerp(weaponShakeX.current, 0, 0.1);
                    weaponShakeY.current = THREE.MathUtils.lerp(weaponShakeY.current, 0, 0.1);

                    weaponGroup.current.position.set(
                        THREE.MathUtils.lerp(weaponGroup.current.position.x, weaponShakeX.current, 0.1),
                        THREE.MathUtils.lerp(weaponGroup.current.position.y, weaponShakeY.current, 0.1),
                        THREE.MathUtils.lerp(weaponGroup.current.position.z, weaponRecoilZ.current, 0.5)
                    );
                    weaponGroup.current.rotation.x = weaponRecoilRot.current;
                } else {
                    weaponGroup.current.position.y = THREE.MathUtils.lerp(weaponGroup.current.position.y, -1, 0.1);
                }

                // FOV dynamic zoom effect during boost
                const targetFOV = (mouseShake.current > 20 && !isDead.current) ? 82 : 75;
                camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 0.1);
                camera.updateProjectionMatrix();
            }

            renderer.render(scene, camera);
            prevTime = time;
        };
        animate();
        updatePlayerHPUI();
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('wheel', onWheel);
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('contextmenu', onContextMenu);
            if (renderer.domElement.parentNode) document.body.removeChild(renderer.domElement);
        };
    }, []);

    return null;
};

export default App;
