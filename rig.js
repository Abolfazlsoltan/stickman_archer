(function (global) {
  'use strict';

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (a, n) => ({ x: a.x * n, y: a.y * n });
  const len = a => Math.hypot(a.x, a.y);
  const unit = a => { const d = len(a) || 1; return { x: a.x / d, y: a.y / d }; };
  const fromDown = (angle, length, side) => ({ x: Math.sin(angle) * length * side, y: Math.cos(angle) * length });

  function solveTwoBone(root, target, upper, lower, bendDirection) {
    const delta = sub(target, root);
    const rawDistance = len(delta);
    const minDistance = Math.abs(upper - lower) + 0.5;
    const maxDistance = upper + lower - 0.5;
    const distance = clamp(rawDistance, minDistance, maxDistance);
    const direction = rawDistance > 0.001 ? unit(delta) : { x: 0, y: 1 };
    const end = add(root, mul(direction, distance));
    const lineAngle = Math.atan2(direction.y, direction.x);
    const cosA = clamp((upper * upper + distance * distance - lower * lower) / (2 * upper * distance), -1, 1);
    const offset = Math.acos(cosA) * (bendDirection >= 0 ? 1 : -1);
    const upperAngle = lineAngle - offset;
    const knee = add(root, { x: Math.cos(upperAngle) * upper, y: Math.sin(upperAngle) * upper });
    const lowerAngle = Math.atan2(end.y - knee.y, end.x - knee.x);
    return { root, knee, end, upperAngle, lowerAngle, distance, reachable: rawDistance <= maxDistance + 0.01 };
  }

  function build(root, feet, dims, pose, facing) {
    const p = pose || {};
    const side = facing >= 0 ? 1 : -1;
    const pelvis = { x: root.x, y: root.y };
    const torsoAngle = p.torso || 0;
    const chest = add(pelvis, { x: Math.sin(torsoAngle) * dims.spine, y: -Math.cos(torsoAngle) * dims.spine });
    const neck = add(chest, { x: Math.sin(torsoAngle + (p.head || 0) * 0.18) * dims.neck, y: -Math.cos(torsoAngle + (p.head || 0) * 0.18) * dims.neck });
    const headAngle = torsoAngle + (p.head || 0);
    const head = add(neck, { x: Math.sin(headAngle) * dims.headOffset, y: -Math.cos(headAngle) * dims.headOffset });
    const shoulderHalf = dims.shoulderWidth / 2;
    const shoulders = {
      left: add(chest, { x: -shoulderHalf, y: 3 }),
      right: add(chest, { x: shoulderHalf, y: 3 })
    };

    const arms = {};
    ['left', 'right'].forEach(which => {
      const sign = which === 'left' ? -1 : 1;
      const shoulder = shoulders[which];
      const armAngle = p[which + 'Arm'] == null ? sign * 0.08 : p[which + 'Arm'];
      const elbowBend = p[which + 'Elbow'] == null ? 0 : p[which + 'Elbow'];
      const elbow = add(shoulder, fromDown(armAngle, dims.upperArm, 1));
      const foreAngle = armAngle + sign * elbowBend;
      const wrist = add(elbow, fromDown(foreAngle, dims.forearm, 1));
      const hand = add(wrist, fromDown(foreAngle + sign * 0.1, dims.hand, 1));
      arms[which] = { shoulder, elbow, wrist, hand, upperAngle: armAngle, foreAngle };
    });

    const hips = {
      left: add(pelvis, { x: -dims.hipWidth / 2, y: 4 }),
      right: add(pelvis, { x: dims.hipWidth / 2, y: 4 })
    };
    const legs = {};
    ['left', 'right'].forEach(which => {
      const index = which === 'left' ? 0 : 1;
      const ankleTarget = feet[index] || { x: hips[which].x, y: 0 };
      const solved = solveTwoBone(hips[which], ankleTarget, dims.thigh, dims.shin, side);
      const footAngle = p[which + 'Foot'] || 0;
      const heel = add(solved.end, { x: -side * dims.footLength * 0.35, y: 1 });
      const toe = add(solved.end, { x: side * dims.footLength * 0.72 * Math.cos(footAngle), y: dims.footLength * 0.72 * Math.sin(footAngle) });
      legs[which] = { hip: hips[which], knee: solved.knee, ankle: solved.end, heel, toe, thighAngle: solved.upperAngle, shinAngle: solved.lowerAngle, footAngle, reachable: solved.reachable };
    });

    return { pelvis, chest, neck, head, headAngle, shoulders, arms, hips, legs, root, dims };
  }

  function centerOfMass(skeleton) {
    const points = [
      [skeleton.pelvis, 0.22], [skeleton.chest, 0.28], [skeleton.head, 0.10],
      [skeleton.arms.left.hand, 0.045], [skeleton.arms.right.hand, 0.045],
      [skeleton.legs.left.knee, 0.075], [skeleton.legs.right.knee, 0.075],
      [skeleton.legs.left.ankle, 0.055], [skeleton.legs.right.ankle, 0.055]
    ];
    let total = 0, x = 0, y = 0;
    points.forEach(([point, mass]) => { total += mass; x += point.x * mass; y += point.y * mass; });
    return { x: x / total, y: y / total };
  }

  global.StickmanRig = { solveTwoBone, build, centerOfMass, clamp };
})(window);
