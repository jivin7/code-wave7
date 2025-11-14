// Global variables
let scene, camera, renderer, playerCar;
let obstacles = [];
let coins = [];
let gameActive = true;
let racingScene, gameOverScreen;
let gameStats;
let coinsCollected = 0;
let score = 0;
let gameStartTime = 0;
let scoreInterval = null;

// Button setup
document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  racingScene = document.getElementById('racingScene');
  const instructions = document.getElementById('instructions');
  gameOverScreen = document.getElementById('gameOverScreen');
  const restartBtn = document.getElementById('restartBtn');

  // Hide initially
  racingScene.style.display = 'none';
  instructions.style.display = 'none';
  gameOverScreen.style.display = 'none';
  gameStats = document.getElementById('gameStats');
  gameStats.style.display = 'none';
  
  // Load high score from localStorage
  let highScore = parseInt(localStorage.getItem('racingHighScore') || '0');
  document.getElementById('highScoreCount').textContent = highScore;

  // Start button
  startBtn.addEventListener('click', function() {
    if (typeof THREE === 'undefined') {
      alert('Three.js not loaded! Check internet connection.');
      return;
    }
    startBtn.style.display = 'none';
    racingScene.style.display = 'block';
    instructions.style.display = 'block';
    initGame();



  });

  // Restart button
  restartBtn.addEventListener('click', function() {
    gameOverScreen.style.display = 'none';
    gameActive = true;
    while(racingScene.firstChild) {
      racingScene.removeChild(racingScene.firstChild);
    }
    initGame();
  });
});

function initGame() {
  gameActive = true;
  obstacles = [];
  coins = [];
  coinsCollected = 0;
  score = 0;
  gameStartTime = Date.now();
  
  // Show stats
  gameStats.style.display = 'block';
  document.getElementById('coinCount').textContent = '0';
  document.getElementById('scoreCount').textContent = '0';
  
  // Start score counter (1 point per second)
  if (scoreInterval) clearInterval(scoreInterval);
  scoreInterval = setInterval(() => {
    if (gameActive) {
      score++;
      document.getElementById('scoreCount').textContent = score;
    }
  }, 1000);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 50, 500);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 8, 15);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  racingScene.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // Ground - bigger
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0x90EE90 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Water - bigger
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ 
      color: 0x006994,
      transparent: true,
      opacity: 0.7
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.5;
  scene.add(water);

  // Create track - WAY BIGGER
  const trackPoints = [];
  const trackWidth = 40; // Much wider track
  const radiusX = 150; // Much bigger
  const radiusZ = 100; // Much bigger
  const trackHeight = 1.0; // Taller track
  
  for (let i = 0; i <= 120; i++) {
    const angle = (i / 120) * Math.PI * 2;
    trackPoints.push(new THREE.Vector3(
      Math.cos(angle) * radiusX,
      trackHeight, // Taller track
      Math.sin(angle) * radiusZ
    ));
  }

  // Track surface - taller
  const trackMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2a2a2a,
    roughness: 0.9
  });

  for (let i = 0; i < trackPoints.length - 1; i++) {
    const p1 = trackPoints[i];
    const p2 = trackPoints[i + 1];
    const distance = p1.distanceTo(p2);
    
    const segment = new THREE.Mesh(
      new THREE.PlaneGeometry(trackWidth, distance),
      trackMaterial
    );
    const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    segment.position.copy(midPoint);
    segment.lookAt(p2);
    segment.rotateX(-Math.PI / 2);
    segment.receiveShadow = true;
    scene.add(segment);

    // Center line - bigger
    if (i % 6 === 0) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(1, distance * 0.8),
        new THREE.MeshStandardMaterial({ color: 0xffff00 })
      );
      line.position.copy(midPoint);
      line.position.y += 0.01;
      line.lookAt(p2);
      line.rotateX(-Math.PI / 2);
      scene.add(line);
    }

    // Add walls on both sides of track
    if (i % 2 === 0) {
      const nextPoint = trackPoints[(i + 1) % trackPoints.length];
      const direction = new THREE.Vector3().subVectors(nextPoint, p1).normalize();
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
      
      // Left wall
      const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, distance),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      leftWall.position.copy(midPoint);
      leftWall.position.add(perpendicular.multiplyScalar(-trackWidth / 2 - 0.5));
      leftWall.position.y = trackHeight + 1;
      leftWall.lookAt(p2);
      leftWall.rotateY(Math.PI / 2);
      leftWall.castShadow = true;
      scene.add(leftWall);
      
      // Right wall
      const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, distance),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      rightWall.position.copy(midPoint);
      rightWall.position.add(perpendicular.multiplyScalar(trackWidth / 2 + 0.5));
      rightWall.position.y = trackHeight + 1;
      rightWall.lookAt(p2);
      rightWall.rotateY(Math.PI / 2);
      rightWall.castShadow = true;
      scene.add(rightWall);
    }
  }

  // Create obstacles - SKIP spawn area for safe start
  const spawnSafeZone = 40; // Don't place obstacles in first 40 track points
  for (let i = spawnSafeZone; i < trackPoints.length; i += 15) {
    const point = trackPoints[i];
    const nextPoint = trackPoints[(i + 1) % trackPoints.length];
    const direction = new THREE.Vector3().subVectors(nextPoint, point).normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
    const offset = (Math.random() - 0.5) * 8;
    
    const obstaclePos = new THREE.Vector3(
      point.x + perpendicular.x * offset,
      trackHeight,
      point.z + perpendicular.z * offset
    );

    // BIG obstacles
    let obstacle;
    if (i % 3 === 0) {
      obstacle = new THREE.Mesh(
        new THREE.BoxGeometry(5, 5, 5), // Much bigger box
        new THREE.MeshStandardMaterial({ color: 0xff6600 })
      );
    } else if (i % 3 === 1) {
      obstacle = new THREE.Mesh(
        new THREE.ConeGeometry(3, 5, 8), // Much bigger cone
        new THREE.MeshStandardMaterial({ color: 0xffaa00 })
      );
    } else {
      obstacle = new THREE.Mesh(
        new THREE.CylinderGeometry(3, 3, 5, 8), // Much bigger cylinder
        new THREE.MeshStandardMaterial({ color: 0xcc0000 })
      );
    }
    
    obstacle.position.copy(obstaclePos);
    obstacle.position.y = trackHeight + 2.5; // On track level
    obstacle.castShadow = true;
    scene.add(obstacle);
    
    obstacles.push({
      position: obstaclePos,
      radius: 4 // Bigger collision radius
    });
  }

  // Create coins on track
  const coinSafeZone = 50; // Start coins after safe spawn zone
  for (let i = coinSafeZone; i < trackPoints.length; i += 8) {
    const point = trackPoints[i];
    const nextPoint = trackPoints[(i + 1) % trackPoints.length];
    const direction = new THREE.Vector3().subVectors(nextPoint, point).normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
    const offset = (Math.random() - 0.5) * 6;
    
    const coinPos = new THREE.Vector3(
      point.x + perpendicular.x * offset,
      trackHeight,
      point.z + perpendicular.z * offset
    );

    // Create BIG spinning coin
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 0.3, 16), // Much bigger coin
      new THREE.MeshStandardMaterial({ 
        color: 0xffd700,
        metalness: 0.8,
        roughness: 0.2
      })
    );
    coin.rotation.x = Math.PI / 2;
    coin.position.copy(coinPos);
    coin.position.y = trackHeight + 1; // On track level
    coin.castShadow = true;
    scene.add(coin);
    
    coins.push({
      mesh: coin,
      position: coinPos,
      radius: 2.5, // Bigger collection radius
      collected: false,
      rotation: 0
    });
  }

  // Create car
  function createCar(color) {
    const car = new THREE.Group();
    
    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.8, 4),
      new THREE.MeshStandardMaterial({ color: color })
    );
    body.position.y = 0.4;
    body.castShadow = true;
    car.add(body);
    
    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.8, 2),
      new THREE.MeshStandardMaterial({ color: color })
    );
    roof.position.set(0, 1.2, -0.3);
    roof.castShadow = true;
    car.add(roof);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    [[1.2, 1.5], [-1.2, 1.5], [1.2, -1.5], [-1.2, -1.5]].forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], 0.4, pos[1]);
      wheel.castShadow = true;
      car.add(wheel);
    });
    
    return car;
  }

  // Player car - spawn at safe starting point on track
  playerCar = createCar(0x00ff00);
  // Use a point in the safe zone, facing forward on the track
  const spawnIndex = 10; // Safe spawn point (well before obstacles start)
  playerCar.position.set(trackPoints[spawnIndex].x, trackHeight, trackPoints[spawnIndex].z);
  // Face the direction of travel
  const spawnDirection = new THREE.Vector3().subVectors(
    trackPoints[spawnIndex + 5],
    trackPoints[spawnIndex]
  ).normalize();
  playerCar.rotation.y = Math.atan2(spawnDirection.x, spawnDirection.z);
  scene.add(playerCar);

  // AI cars - on track level
  const aiCars = [];
  const aiColors = [0xff0000, 0x0000ff, 0xffff00, 0xff00ff];
  for (let i = 0; i < 4; i++) {
    const aiCar = createCar(aiColors[i]);
    const startIndex = Math.floor(trackPoints.length / 4) * i;
    aiCar.position.set(trackPoints[startIndex].x, trackHeight, trackPoints[startIndex].z);
    scene.add(aiCar);
    aiCars.push({
      car: aiCar,
      trackIndex: startIndex,
      speed: 0.15 + Math.random() * 0.1
    });
  }

  // Player state - initialize rotation to match car's starting direction
  const playerState = {
    speed: 0,
    maxSpeed: 0.5,
    acceleration: 0.01,
    deceleration: 0.02,
    turnSpeed: 0.03,
    rotation: playerCar.rotation.y // Start facing the same direction as car
  };

  // Camera state
  const cameraState = {
    angleX: 0,
    angleY: Math.PI / 6,
    distance: 15,
    height: 8
  };

  // Keyboard controls
  const keys = {
    w: false, s: false, a: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
  };

  window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
      keys[e.key] = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
      keys[e.key] = false;
    }
  });

  // Update player car
  function updatePlayer() {
    if (!gameActive) return;

    // Movement (WASD)
    if (keys.w) {
      playerState.speed = Math.min(playerState.speed + playerState.acceleration, playerState.maxSpeed);
    } else if (keys.s) {
      playerState.speed = Math.max(playerState.speed - playerState.acceleration, -playerState.maxSpeed * 0.5);
    } else {
      if (playerState.speed > 0) {
        playerState.speed = Math.max(playerState.speed - playerState.deceleration, 0);
      } else if (playerState.speed < 0) {
        playerState.speed = Math.min(playerState.speed + playerState.deceleration, 0);
      }
    }

    // Turning (WASD)
    if (keys.a) {
      playerState.rotation += playerState.turnSpeed * (playerState.speed > 0 ? 1 : -1);
    }
    if (keys.d) {
      playerState.rotation -= playerState.turnSpeed * (playerState.speed > 0 ? 1 : -1);
    }

    playerCar.rotation.y = playerState.rotation;

    // Move
    const moveX = Math.sin(playerState.rotation) * playerState.speed;
    const moveZ = Math.cos(playerState.rotation) * playerState.speed;
    playerCar.position.x += moveX;
    playerCar.position.z += moveZ;
    playerCar.position.y = trackHeight; // Keep on track level

    // Keep on track
    const angle = Math.atan2(playerCar.position.z / radiusZ, playerCar.position.x / radiusX);
    const distanceFromCenter = Math.sqrt(
      (playerCar.position.x / radiusX) ** 2 + (playerCar.position.z / radiusZ) ** 2
    );
    
    if (distanceFromCenter > 1.4 || distanceFromCenter < 0.6) {
      const normalX = Math.cos(angle) * radiusX;
      const normalZ = Math.sin(angle) * radiusZ;
      const length = Math.sqrt(normalX ** 2 + normalZ ** 2);
      playerCar.position.x = (normalX / length) * radiusX * (distanceFromCenter > 1.4 ? 1.3 : 0.7);
      playerCar.position.z = (normalZ / length) * radiusZ * (distanceFromCenter > 1.4 ? 1.3 : 0.7);
      playerState.speed *= 0.5;
    }

    // Check coin collection
    coins.forEach(coin => {
      if (!coin.collected) {
        const distance = Math.sqrt(
          (playerCar.position.x - coin.position.x) ** 2 +
          (playerCar.position.z - coin.position.z) ** 2
        );
        if (distance < coin.radius + 2) {
          // Collect coin
          coin.collected = true;
          scene.remove(coin.mesh);
          coinsCollected++;
          document.getElementById('coinCount').textContent = coinsCollected;
        }
      }
    });

    // Check obstacle collision - RESTART IF HIT
    obstacles.forEach(obstacle => {
      const distance = Math.sqrt(
        (playerCar.position.x - obstacle.position.x) ** 2 +
        (playerCar.position.z - obstacle.position.z) ** 2
      );
      if (distance < obstacle.radius + 1.5) {
        // Hit obstacle - restart game
        if (gameActive) {
          gameActive = false;
          playerState.speed = 0;
          if (scoreInterval) clearInterval(scoreInterval);
          
          // Update high score
          let highScore = parseInt(localStorage.getItem('racingHighScore') || '0');
          if (score > highScore) {
            highScore = score;
            localStorage.setItem('racingHighScore', highScore.toString());
          }
          
          // Show game over screen with stats
          setTimeout(() => {
            document.getElementById('finalCoins').textContent = coinsCollected;
            document.getElementById('finalScore').textContent = score;
            document.getElementById('finalHighScore').textContent = highScore;
            document.getElementById('highScoreCount').textContent = highScore;
            gameOverScreen.style.display = 'flex';
          }, 300);
        }
      }
    });

    // Check water
    if (distanceFromCenter > 1.6 || distanceFromCenter < 0.4) {
      if (gameActive) {
        gameActive = false;
        playerState.speed = 0;
        if (scoreInterval) clearInterval(scoreInterval);
        
        // Update high score
        let highScore = parseInt(localStorage.getItem('racingHighScore') || '0');
        if (score > highScore) {
          highScore = score;
          localStorage.setItem('racingHighScore', highScore.toString());
        }
        
        // Show game over screen with stats
        setTimeout(() => {
          document.getElementById('finalCoins').textContent = coinsCollected;
          document.getElementById('finalScore').textContent = score;
          document.getElementById('finalHighScore').textContent = highScore;
          document.getElementById('highScoreCount').textContent = highScore;
          gameOverScreen.style.display = 'flex';
        }, 300);
      }
    }
  }

  // Update AI cars
  function updateAI() {
    aiCars.forEach(ai => {
      ai.trackIndex += ai.speed;
      if (ai.trackIndex >= trackPoints.length) {
        ai.trackIndex = 0;
      }
      
      const currentPoint = trackPoints[Math.floor(ai.trackIndex)];
      const nextPoint = trackPoints[Math.floor(ai.trackIndex + 1) % trackPoints.length];
      const t = ai.trackIndex - Math.floor(ai.trackIndex);
      ai.car.position.lerpVectors(currentPoint, nextPoint, t);
      ai.car.position.y = trackHeight; // Keep on track level
      
      const direction = new THREE.Vector3().subVectors(nextPoint, currentPoint).normalize();
      ai.car.rotation.y = Math.atan2(direction.x, direction.z);
    });
  }

  // Update coins (spin animation)
  function updateCoins() {
    coins.forEach(coin => {
      if (!coin.collected) {
        coin.rotation += 0.1;
        coin.mesh.rotation.z = coin.rotation;
        // Bob up and down
        coin.mesh.position.y = trackHeight + 1 + Math.sin(coin.rotation * 2) * 0.3;
      }
    });
  }

  // Update camera (Arrow keys)
  function updateCamera() {
    const cameraRotSpeed = 0.03;
    
    if (keys.ArrowLeft) {
      cameraState.angleX += cameraRotSpeed;
    }
    if (keys.ArrowRight) {
      cameraState.angleX -= cameraRotSpeed;
    }
    if (keys.ArrowUp) {
      cameraState.angleY = Math.max(0.1, Math.min(Math.PI / 2.5, cameraState.angleY + cameraRotSpeed));
    }
    if (keys.ArrowDown) {
      cameraState.angleY = Math.max(0.1, Math.min(Math.PI / 2.5, cameraState.angleY - cameraRotSpeed));
    }
    
    const cameraX = playerCar.position.x + Math.sin(cameraState.angleX) * Math.cos(cameraState.angleY) * cameraState.distance;
    const cameraY = playerCar.position.y + Math.sin(cameraState.angleY) * cameraState.distance + cameraState.height;
    const cameraZ = playerCar.position.z + Math.cos(cameraState.angleX) * Math.cos(cameraState.angleY) * cameraState.distance;
    
    camera.position.lerp(new THREE.Vector3(cameraX, cameraY, cameraZ), 0.1);
    
    const lookAtTarget = new THREE.Vector3(
      playerCar.position.x + Math.sin(playerState.rotation) * 3,
      playerCar.position.y + 1,
      playerCar.position.z + Math.cos(playerState.rotation) * 3
    );
    camera.lookAt(lookAtTarget);
  }

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    
    if (gameActive) {
      updatePlayer();
      updateAI();
    }
    updateCoins();
    updateCamera();
    
    renderer.render(scene, camera);
  }

  // Window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

let speed = 5;               // start speed
let speedIncrease = 2;       // how much to increase every 5 seconds
let keyHeldTime = 0;         // how long W has been held (ms)
let holding = false;         // is key currently held?

document.addEventListener("keydown", (e) => {
    if (e.key === "w" || e.key === "ArrowUp") {
        if (!holding) {
            holding = true;
            keyHeldTime = 0; // reset timer when you start holding
        }
    }
});1
// --- HOLD W / UP TO INCREASE SPEED EVERY 5 SECONDS ---
if (keys.w || keys.ArrowUp) {
    if (!holding) {
        holding = true;
        keyHeldTime = 0;   // reset timer
    } else {
        keyHeldTime += 16; // approx per frame
    }

    // Every 5 seconds increase max speed
    if (keyHeldTime >= 5000) {
        playerState.maxSpeed += 0.2;  // faster top speed
        keyHeldTime = 0;              // reset for next 5 seconds
    }
} else {
    holding = false;
    keyHeldTime = 0;
    playerState.maxSpeed = 0.5; // reset max speed when key released
}
// ------------------------------------------------------
