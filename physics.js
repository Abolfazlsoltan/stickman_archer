(function (global) {
  'use strict';

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  function createState() {
    return {
      x: 0,
      height: 0,
      vy: 0,
      vx: 0,
      onGround: true,
      time: 0,
      gaitDistance: 0,
      feet: [
        { plantX: null, swing: false, swingStart: 0, swingEnd: 0, lastU: 0, x: -14, y: 0 },
        { plantX: null, swing: false, swingStart: 0, swingEnd: 0, lastU: 0, x: 14, y: 0 }
      ],
      lastMotion: 'idle',
      landedAt: -1
    };
  }

  function jump(state, impulse) {
    if (!state.onGround) return false;
    state.vy = -Math.max(120, impulse);
    state.onGround = false;
    state.feet.forEach((foot, i) => {
      foot.swing = false;
      foot.plantX = state.x + (i === 0 ? -13 : 13);
      foot.x = foot.plantX;
    });
    return true;
  }

  function resetFeet(state, stanceWidth) {
    state.feet.forEach((foot, i) => {
      foot.swing = false;
      foot.plantX = state.x + (i === 0 ? -stanceWidth : stanceWidth);
      foot.swingStart = foot.plantX;
      foot.swingEnd = foot.plantX;
      foot.x = foot.plantX;
      foot.y = 0;
      foot.lastU = 0;
    });
    state.gaitDistance = 0;
  }

  function updateFeet(state, motion, dt, cfg) {
    const stride = cfg.stride;
    const stance = cfg.stance;
    if (!state.onGround) {
      state.feet.forEach((foot, i) => {
        foot.x = state.x + (i === 0 ? -13 : 13);
        foot.y = state.height - 25 - Math.max(0, -state.vy * 0.018);
      });
      return;
    }

    if (motion !== 'walk' && motion !== 'run') {
      if (state.lastMotion === 'walk' || state.lastMotion === 'run') resetFeet(state, stance);
      state.feet.forEach((foot, i) => {
        foot.x = state.x + (i === 0 ? -stance : stance);
        foot.y = 0;
        foot.plantX = foot.x;
        foot.swing = false;
        foot.lastU = 0;
      });
      state.gaitDistance = 0;
      return;
    }

    state.gaitDistance += Math.abs(state.vx) * dt;
    const cycle = state.gaitDistance / stride;
    state.feet.forEach((foot, i) => {
      const u = (cycle + i * 0.5) % 1;
      const wasSwing = foot.swing;
      if (foot.plantX === null) {
        foot.plantX = state.x + stride * 0.38;
        foot.lastU = u;
      }
      if (u >= 0.62 && foot.lastU < 0.62) {
        foot.swing = true;
        foot.swingStart = foot.plantX;
        foot.swingEnd = state.x + stride * 0.62;
      }
      if (u < foot.lastU && wasSwing) {
        foot.swing = false;
        foot.plantX = foot.swingEnd;
      }
      if (foot.swing) {
        const p = clamp((u - 0.62) / 0.38, 0, 1);
        foot.x = lerp(foot.swingStart, foot.swingEnd, smooth(p));
        foot.y = -Math.sin(Math.PI * p) * cfg.swingHeight;
      } else {
        foot.x = foot.plantX;
        foot.y = 0;
      }
      foot.lastU = u;
    });
  }

  function step(state, dt, motion, cfg) {
    dt = clamp(dt, 0, 1 / 30);
    state.time += dt;
    const targetSpeed = motion === 'walk' ? cfg.walkSpeed : motion === 'run' ? cfg.runSpeed : 0;
    const accel = state.onGround ? 8.5 : 2.3;
    state.vx += (targetSpeed - state.vx) * (1 - Math.exp(-accel * dt));
    state.x += state.vx * dt;

    if (!state.onGround) {
      state.vy += cfg.gravity * dt;
      state.height += state.vy * dt;
      if (state.height >= 0) {
        state.height = 0;
        state.vy = 0;
        state.onGround = true;
        state.landedAt = state.time;
        resetFeet(state, cfg.stance);
      }
    } else {
      state.height = 0;
      state.vy = 0;
    }

    updateFeet(state, motion, dt, cfg);
    state.lastMotion = motion;
  }

  function setMotion(state, motion, cfg) {
    if ((motion === 'walk' || motion === 'run') && state.lastMotion !== 'walk' && state.lastMotion !== 'run') {
      resetFeet(state, cfg.stance);
      state.gaitDistance = 0;
      // شروع چرخه با یک پای جلو و پای دیگر نزدیک انتهای فاز اتکا.
      state.feet[0].plantX = state.x + cfg.stride * 0.38;
      state.feet[1].plantX = state.x - cfg.stride * 0.12;
      state.feet[0].x = state.feet[0].plantX;
      state.feet[1].x = state.feet[1].plantX;
      state.feet[0].lastU = 0;
      state.feet[1].lastU = 0.5;
    }
    if (motion !== 'walk' && motion !== 'run' && (state.lastMotion === 'walk' || state.lastMotion === 'run')) {
      resetFeet(state, cfg.stance);
    }
    state.lastMotion = motion;
  }

  global.StickmanPhysics = { createState, jump, step, setMotion, resetFeet };
})(window);
