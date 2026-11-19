'use strict';
const assert = require('node:assert/strict');
global.window = global;
require('../physics.js');
require('../rig.js');

const dims = {
  spine: 57, neck: 13, headOffset: 20, headRadius: 17, shoulderWidth: 37,
  hipWidth: 20, upperArm: 42, forearm: 36, hand: 9, thigh: 73,
  shin: 70, footLength: 24, armWidth: 12, legWidth: 14, bodyWidth: 27
};

// Two-bone IK must preserve the lengths of both bones.
{
  const root = { x: 2, y: -130 };
  const target = { x: 35, y: -5 };
  const solved = StickmanRig.solveTwoBone(root, target, 73, 70, 1);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(Math.abs(distance(root, solved.knee) - 73) < 1e-6);
  assert.ok(Math.abs(distance(solved.knee, solved.end) - 70) < 1e-6);
}

// The planted foot remains at the same world coordinate during stance.
{
  const state = StickmanPhysics.createState();
  const cfg = { gravity: 980, walkSpeed: 112, runSpeed: 218, stride: 72, swingHeight: 27, stance: 14 };
  StickmanPhysics.setMotion(state, 'walk', cfg);
  const planted = state.feet[0].plantX;
  for (let i = 0; i < 20; i++) StickmanPhysics.step(state, 1 / 60, 'walk', cfg);
  assert.equal(state.feet[0].swing, false);
  assert.equal(state.feet[0].plantX, planted);
  assert.equal(state.feet[0].x, planted);
}

// Gravity pulls the body down after take-off and the ground catches it.
{
  const state = StickmanPhysics.createState();
  const cfg = { gravity: 980, walkSpeed: 112, runSpeed: 218, stride: 72, swingHeight: 27, stance: 14 };
  assert.equal(StickmanPhysics.jump(state, 520), true);
  StickmanPhysics.step(state, 0.1, 'idle', cfg);
  assert.ok(state.height < 0);
  for (let i = 0; i < 180; i++) StickmanPhysics.step(state, 1 / 60, 'idle', cfg);
  assert.equal(state.onGround, true);
  assert.equal(state.height, 0);
  assert.equal(state.vy, 0);
}

// A complete skeleton returns connected shoulders, elbows, wrists, hips and ankles.
{
  const feet = [{ x: -14, y: -7 }, { x: 14, y: -7 }];
  const sk = StickmanRig.build({ x: 0, y: -136 }, feet, dims, {}, 1);
  for (const key of ['pelvis', 'chest', 'neck', 'head']) assert.ok(Number.isFinite(sk[key].x) && Number.isFinite(sk[key].y));
  for (const side of ['left', 'right']) {
    assert.ok(Number.isFinite(sk.arms[side].elbow.x));
    assert.ok(Number.isFinite(sk.legs[side].knee.x));
    assert.ok(Number.isFinite(sk.legs[side].ankle.y));
  }
}

console.log('Rig and physics tests passed.');
