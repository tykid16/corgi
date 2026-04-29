// corgi.js: A corgi that follows your mouse cursor
// Based on oneko.js by adryd (https://github.com/adryd325/oneko.js)
// Licensed under MIT License

(function corgi() {
  const isReducedMotion =
    window.matchMedia(`(prefers-reduced-motion: reduce)`) === true ||
    window.matchMedia(`(prefers-reduced-motion: reduce)`).matches === true;

  if (isReducedMotion) return;

  const corgiEl = document.createElement("div");
  let persistPosition = true;

  let corgiPosX = 32;
  let corgiPosY = 32;

  let mousePosX = 0;
  let mousePosY = 0;

  let frameCount = 0;
  let idleTime = 0;
  let idleAnimation = null;
  let idleAnimationFrame = 0;

  const corgiSpeed = 10;

  // Sprite sheet layout: 8 columns x 5 rows, each frame 32x32px
  //
  //         Col0    Col1    Col2    Col3    Col4    Col5    Col6    Col7
  // Row0:   NW-1    NW-2    sleep1  sleep2  scrW-1  scrW-2  scrSf1  scrSf2
  // Row1:   scrN-1  scrN-2  bark-1  scrS-1  bark-2  SE-1    SE-2    scrS-2
  // Row2:   N-1     N-2     scrE-1  scrE-2  W-1     W-2     tired   idle
  // Row3:   NE-1    NE-2    wag-1   wag-2   beg-1   SW-1    S-1     alert
  // Row4:   (empty) (empty) wag-3   beg-2   scrSf3  SW-2    S-2     (empty)
  //
  // Coordinates are [col, row] where negative = offset from origin.
  // Actual background-position = [col * 32, row * 32]

  const spriteSets = {
    idle: [[-3, -2]],
    alert: [[-7, -3]],
    tired: [[-6, -2]],
    sleeping: [
      [-2, 0],
      [-2, -1],
    ],
    scratchSelf: [
      [-6, 0],
      [-7, 0],
      [-4, -4],
    ],
    scratchWallN: [
      [0, -1],
      [-1, -1],
    ],
    scratchWallS: [
      [-3, -1],
      [-7, -1],
    ],
    scratchWallE: [
      [-2, -2],
      [-3, -2],
    ],
    scratchWallW: [
      [-4, 0],
      [-5, 0],
    ],
    // 8-direction movement (2 frames each)
    N: [
      [0, -2],
      [-1, -2],
    ],
    NE: [
      [0, -3],
      [-1, -3],
    ],
    E: [
      [-3, 0],
      [-3, -1],
    ],
    SE: [
      [-5, -1],
      [-6, -1],
    ],
    S: [
      [-6, -3],
      [-6, -4],
    ],
    SW: [
      [-5, -3],
      [-5, -4],
    ],
    W: [
      [-4, -2],
      [-5, -2],
    ],
    NW: [
      [0, 0],
      [-1, 0],
    ],
    // Corgi-specific animations
    wagTail: [
      [-2, -3],
      [-3, -3],
      [-2, -4],
    ],
    beg: [
      [-4, -3],
      [-3, -4],
    ],
    bark: [
      [-2, -1],
      [-4, -1],
    ],
  };

  function init() {
    let corgiFile = "./corgi.png";
    const curScript = document.currentScript;
    if (curScript && curScript.dataset.corgi) {
      corgiFile = curScript.dataset.corgi;
    }
    if (curScript && curScript.dataset.persistPosition) {
      if (curScript.dataset.persistPosition === "") {
        persistPosition = true;
      } else {
        persistPosition = JSON.parse(
          curScript.dataset.persistPosition.toLowerCase()
        );
      }
    }

    if (persistPosition) {
      let stored = JSON.parse(window.localStorage.getItem("corgi"));
      if (stored !== null) {
        corgiPosX = stored.corgiPosX;
        corgiPosY = stored.corgiPosY;
        mousePosX = stored.mousePosX;
        mousePosY = stored.mousePosY;
        frameCount = stored.frameCount;
        idleTime = stored.idleTime;
        idleAnimation = stored.idleAnimation;
        idleAnimationFrame = stored.idleAnimationFrame;
        corgiEl.style.backgroundPosition = stored.bgPos;
      }
    }

    corgiEl.id = "corgi";
    corgiEl.ariaHidden = true;
    corgiEl.style.width = "32px";
    corgiEl.style.height = "32px";
    corgiEl.style.position = "fixed";
    corgiEl.style.pointerEvents = "none";
    corgiEl.style.imageRendering = "pixelated";
    corgiEl.style.left = `${corgiPosX - 16}px`;
    corgiEl.style.top = `${corgiPosY - 16}px`;
    corgiEl.style.zIndex = 2147483647;
    corgiEl.style.backgroundImage = `url(${corgiFile})`;

    document.body.appendChild(corgiEl);

    document.addEventListener("mousemove", function (event) {
      mousePosX = event.clientX;
      mousePosY = event.clientY;
    });

    if (persistPosition) {
      window.addEventListener("beforeunload", function () {
        window.localStorage.setItem(
          "corgi",
          JSON.stringify({
            corgiPosX: corgiPosX,
            corgiPosY: corgiPosY,
            mousePosX: mousePosX,
            mousePosY: mousePosY,
            frameCount: frameCount,
            idleTime: idleTime,
            idleAnimation: idleAnimation,
            idleAnimationFrame: idleAnimationFrame,
            bgPos: corgiEl.style.backgroundPosition,
          })
        );
      });
    }

    window.requestAnimationFrame(onAnimationFrame);
  }

  let lastFrameTimestamp;

  function onAnimationFrame(timestamp) {
    if (!corgiEl.isConnected) {
      return;
    }
    if (!lastFrameTimestamp) {
      lastFrameTimestamp = timestamp;
    }
    if (timestamp - lastFrameTimestamp > 100) {
      lastFrameTimestamp = timestamp;
      frame();
    }
    window.requestAnimationFrame(onAnimationFrame);
  }

  function setSprite(name, frame) {
    const sprite = spriteSets[name][frame % spriteSets[name].length];
    corgiEl.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`;
  }

  function resetIdleAnimation() {
    idleAnimation = null;
    idleAnimationFrame = 0;
  }

  function idle() {
    idleTime += 1;

    // Start a random idle animation after being idle for a while
    if (
      idleTime > 10 &&
      Math.floor(Math.random() * 200) === 0 &&
      idleAnimation === null
    ) {
      // Corgi-specific: wagTail, beg, bark are available anywhere
      let availableIdleAnimations = [
        "sleeping",
        "scratchSelf",
        "wagTail",
        "beg",
        "bark",
      ];
      // Wall scratching only near edges
      if (corgiPosX < 32) {
        availableIdleAnimations.push("scratchWallW");
      }
      if (corgiPosY < 32) {
        availableIdleAnimations.push("scratchWallN");
      }
      if (corgiPosX > window.innerWidth - 32) {
        availableIdleAnimations.push("scratchWallE");
      }
      if (corgiPosY > window.innerHeight - 32) {
        availableIdleAnimations.push("scratchWallS");
      }
      idleAnimation =
        availableIdleAnimations[
          Math.floor(Math.random() * availableIdleAnimations.length)
        ];
    }

    switch (idleAnimation) {
      case "sleeping":
        if (idleAnimationFrame < 8) {
          setSprite("tired", 0);
          break;
        }
        setSprite("sleeping", Math.floor(idleAnimationFrame / 4));
        if (idleAnimationFrame > 192) {
          resetIdleAnimation();
        }
        break;
      case "scratchWallN":
      case "scratchWallS":
      case "scratchWallE":
      case "scratchWallW":
      case "scratchSelf":
        setSprite(idleAnimation, idleAnimationFrame);
        if (idleAnimationFrame > 9) {
          resetIdleAnimation();
        }
        break;
      // Corgi-specific idle animations
      case "wagTail":
        setSprite("wagTail", idleAnimationFrame);
        if (idleAnimationFrame > 12) {
          resetIdleAnimation();
        }
        break;
      case "beg":
        setSprite("beg", idleAnimationFrame);
        if (idleAnimationFrame > 10) {
          resetIdleAnimation();
        }
        break;
      case "bark":
        setSprite("bark", idleAnimationFrame);
        if (idleAnimationFrame > 6) {
          resetIdleAnimation();
        }
        break;
      default:
        setSprite("idle", 0);
        return;
    }
    idleAnimationFrame += 1;
  }

  function frame() {
    frameCount += 1;
    const diffX = corgiPosX - mousePosX;
    const diffY = corgiPosY - mousePosY;
    const distance = Math.sqrt(diffX ** 2 + diffY ** 2);

    if (distance < corgiSpeed || distance < 48) {
      idle();
      return;
    }

    idleAnimation = null;
    idleAnimationFrame = 0;

    if (idleTime > 1) {
      setSprite("alert", 0);
      idleTime = Math.min(idleTime, 7);
      idleTime -= 1;
      return;
    }

    let direction;
    direction = diffY / distance > 0.5 ? "N" : "";
    direction += diffY / distance < -0.5 ? "S" : "";
    direction += diffX / distance > 0.5 ? "W" : "";
    direction += diffX / distance < -0.5 ? "E" : "";
    setSprite(direction, frameCount);

    corgiPosX -= (diffX / distance) * corgiSpeed;
    corgiPosY -= (diffY / distance) * corgiSpeed;

    corgiPosX = Math.min(Math.max(16, corgiPosX), window.innerWidth - 16);
    corgiPosY = Math.min(Math.max(16, corgiPosY), window.innerHeight - 16);

    corgiEl.style.left = `${corgiPosX - 16}px`;
    corgiEl.style.top = `${corgiPosY - 16}px`;
  }

  init();
})();
