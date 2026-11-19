'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const RAD = Math.PI / 180;

  const canvas = $('#stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const stageWrap = $('#stageWrap');
  const editor = $('#editorContent');
  const state = StickmanPhysics.createState();

  const appearance = {
    style: 'fighter', body: '#d9a45c', accent: '#df4b39', skin: '#e8bd98', hair: '#252333',
    height: 1, head: 1, shoulders: 1, limbs: 1
  };
  const manualPose = {
    torso: 0, head: 0, leftArm: -0.08, rightArm: 0.08,
    leftElbow: 0.24, rightElbow: 0.24, legLift: 0
  };
  const physics = { gravity: 980, jumpImpulse: 520, balanceAssist: true };
  let motion = 'idle';
  let activePosePreset = 'neutral';
  let activeTab = 'design';
  let showJoints = false;
  let lastFrame = 0;
  let rafId = 0;
  let stageWidth = 0;
  let stageHeight = 0;
  let pixelRatio = 1;
  let scale = 1;
  let groundScreen = 0;
  let lastSkeleton = null;
  let toastTimer = 0;

  const motionMeta = {
    idle: { label: 'ایستادن طبیعی', icon: '◉', title: 'ایستادن طبیعی' },
    walk: { label: 'راه رفتن', icon: '↗', title: 'راه رفتن' },
    run: { label: 'دویدن', icon: '⚡', title: 'دویدن' },
    wave: { label: 'دست تکان دادن', icon: '✋', title: 'دست تکان دادن' },
    guard: { label: 'گارد رزمی', icon: '◆', title: 'گارد رزمی' },
    balance: { label: 'حفظ تعادل', icon: '⌁', title: 'حفظ تعادل روی یک پا' }
  };

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2100);
  }

  function sectionHeading(symbol, title, subtitle) {
    const node = document.createElement('div');
    node.className = 'section-title';
    node.innerHTML = `<span class="symbol">${symbol}</span><div class="copy"><h2>${title}</h2><p>${subtitle}</p></div>`;
    return node;
  }

  function makeCard(title) {
    const card = document.createElement('section');
    card.className = 'card';
    if (title) {
      const h = document.createElement('h3');
      h.className = 'card-heading';
      h.textContent = title;
      card.appendChild(h);
    }
    return card;
  }

  function addRange(parent, label, value, min, max, step, onInput, formatter = v => String(v)) {
    const wrap = document.createElement('div');
    wrap.className = 'control';
    const head = document.createElement('div');
    head.className = 'control-head';
    const caption = document.createElement('label');
    caption.textContent = label;
    const output = document.createElement('output');
    output.className = 'value';
    output.textContent = formatter(value);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const next = Number(input.value);
      output.textContent = formatter(next);
      onInput(next);
    });
    head.append(caption, output);
    wrap.append(head, input);
    parent.appendChild(wrap);
    return input;
  }

  function addColor(parent, label, key) {
    const row = document.createElement('div');
    row.className = 'color-row';
    const caption = document.createElement('label');
    caption.textContent = label;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = appearance[key];
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => { appearance[key] = input.value; });
    row.append(caption, input);
    parent.appendChild(row);
  }

  function addSwitch(parent, label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'switch-row';
    const caption = document.createElement('span');
    caption.textContent = label;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'switch' + (value ? ' on' : '');
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', value ? 'true' : 'false');
    button.addEventListener('click', () => {
      value = !value;
      button.classList.toggle('on', value);
      button.setAttribute('aria-checked', value ? 'true' : 'false');
      onChange(value);
    });
    row.append(caption, button);
    parent.appendChild(row);
  }

  function addNote(parent, html) {
    const note = document.createElement('p');
    note.className = 'note';
    note.innerHTML = html;
    parent.appendChild(note);
  }

  function addAction(parent, label, onClick, primary = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action' + (primary ? ' primary' : '');
    button.textContent = label;
    button.addEventListener('click', onClick);
    parent.appendChild(button);
    return button;
  }

  function renderDesignPanel() {
    editor.appendChild(sectionHeading('◈', 'طراحی ظاهر', 'رنگ و تناسبات اصلی کاراکتر را تغییر بده.'));
    const styles = makeCard('سبک بدن');
    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    const options = [
      ['classic', 'استیکمن کلاسیک', 'فرم ساده و سبک', '⌁'],
      ['fighter', 'رزمی', 'بدن ورزیده و متعادل', '✦'],
      ['armored', 'زره‌پوش', 'محافظ شانه و دست', '⬡']
    ];
    options.forEach(([value, title, subtitle, icon]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice' + (appearance.style === value ? ' active' : '');
      button.innerHTML = `<span class="choice-icon">${icon}</span><span>${title}<small>${subtitle}</small></span>`;
      button.addEventListener('click', () => {
        appearance.style = value;
        $$('.choice', grid).forEach(b => b.classList.toggle('active', b === button));
      });
      grid.appendChild(button);
    });
    styles.appendChild(grid);
    editor.appendChild(styles);

    const colors = makeCard('رنگ‌بندی');
    addColor(colors, 'رنگ اصلی بدن', 'body');
    addColor(colors, 'رنگ لباس و جزئیات', 'accent');
    addColor(colors, 'رنگ پوست', 'skin');
    addColor(colors, 'رنگ مو', 'hair');
    editor.appendChild(colors);

    const proportions = makeCard('اندازه و تناسبات');
    addRange(proportions, 'قد کلی', appearance.height, 0.78, 1.22, 0.01, v => appearance.height = v, v => `${Math.round(v * 100)}٪`);
    addRange(proportions, 'اندازهٔ سر', appearance.head, 0.72, 1.35, 0.01, v => appearance.head = v, v => `${v.toFixed(2)}×`);
    addRange(proportions, 'عرض شانه‌ها', appearance.shoulders, 0.7, 1.45, 0.01, v => appearance.shoulders = v, v => `${v.toFixed(2)}×`);
    addRange(proportions, 'ضخامت دست و پا', appearance.limbs, 0.72, 1.42, 0.01, v => appearance.limbs = v, v => `${v.toFixed(2)}×`);
    editor.appendChild(proportions);

    const actions = makeCard('');
    const row = document.createElement('div');
    row.className = 'action-row';
    addAction(row, 'بازنشانی ظاهر', () => {
      Object.assign(appearance, { style: 'fighter', body: '#d9a45c', accent: '#df4b39', skin: '#e8bd98', hair: '#252333', height: 1, head: 1, shoulders: 1, limbs: 1 });
      renderPanel('design');
      showToast('ظاهر به حالت پیش‌فرض برگشت.');
    }, false);
    addAction(row, 'ذخیرهٔ پروژه', saveProject, true);
    actions.appendChild(row);
    const row2 = document.createElement('div');
    row2.className = 'action-row';
    row2.style.marginTop = '8px';
    addAction(row2, 'بارگذاری پروژه', loadProject, false);
    actions.appendChild(row2);
    editor.appendChild(actions);
  }

  function applyPosePreset(name) {
    Object.assign(manualPose, { torso: 0, head: 0, leftArm: -0.08, rightArm: 0.08, leftElbow: 0.24, rightElbow: 0.24, legLift: 0 });
    if (name === 'guard') Object.assign(manualPose, { torso: 0.14, head: -0.06, leftArm: 1.2, rightArm: 1.65, leftElbow: 0.8, rightElbow: 0.9 });
    if (name === 'tpose') Object.assign(manualPose, { leftArm: -Math.PI / 2, rightArm: Math.PI / 2, leftElbow: 0, rightElbow: 0 });
    if (name === 'balance') Object.assign(manualPose, { torso: -0.05, leftArm: -1.05, rightArm: 1.05, legLift: 42 });
    if (name === 'squat') Object.assign(manualPose, { torso: 0.1, leftArm: 0.55, rightArm: 0.65, leftElbow: 0.45, rightElbow: 0.45 });
    motion = name === 'balance' ? 'balance' : name === 'guard' ? 'guard' : 'idle';
    if (name === 'tpose' || name === 'squat') motion = 'custom';
    if (name === 'squat') manualPose.squat = 22;
    else manualPose.squat = 0;
    activePosePreset = name;
    StickmanPhysics.setMotion(state, motion, physicsConfig());
    renderPanel('pose');
    updateMotionUI();
  }

  function renderPosePanel() {
    editor.appendChild(sectionHeading('⌘', 'مفاصل و پوز', 'زاویه‌ها را تغییر بده؛ بدن با زنجیرهٔ مفصلی هماهنگ می‌شود.'));
    const presets = makeCard('پوزهای آماده');
    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    const options = [
      ['neutral', 'ایستادن طبیعی', 'حالت پایه', '◉'],
      ['guard', 'گارد رزمی', 'دست‌ها در وضعیت دفاع', '◆'],
      ['tpose', 'حالت T', 'برای بررسی ریگ', '✚'],
      ['balance', 'تعادل روی یک پا', 'انتقال وزن بدن', '⌁'],
      ['squat', 'نیم‌اسکوات', 'خم شدن زانوها', '⌄']
    ];
    options.forEach(([value, title, subtitle, icon]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice' + (activePosePreset === value ? ' active' : '');
      button.dataset.preset = value;
      button.innerHTML = `<span class="choice-icon">${icon}</span><span>${title}<small>${subtitle}</small></span>`;
      button.addEventListener('click', () => {
        applyPosePreset(value);
      });
      grid.appendChild(button);
    });
    presets.appendChild(grid);
    editor.appendChild(presets);

    const joints = makeCard('تنظیم دستی مفاصل');
    addRange(joints, 'خم شدن ستون فقرات', Math.round(manualPose.torso / RAD), -35, 35, 1, v => { motion = 'custom'; activePosePreset = 'manual'; manualPose.squat = 0; manualPose.torso = v * RAD; updateMotionUI(); }, v => `${v}°`);
    addRange(joints, 'چرخش سر و گردن', Math.round(manualPose.head / RAD), -30, 30, 1, v => { motion = 'custom'; activePosePreset = 'manual'; manualPose.head = v * RAD; updateMotionUI(); }, v => `${v}°`);
    addRange(joints, 'زاویهٔ شانهٔ چپ', Math.round(manualPose.leftArm / RAD), -150, 150, 1, v => { motion = 'custom'; activePosePreset = 'manual'; manualPose.leftArm = v * RAD; updateMotionUI(); }, v => `${v}°`);
    addRange(joints, 'زاویهٔ شانهٔ راست', Math.round(manualPose.rightArm / RAD), -150, 150, 1, v => { motion = 'custom'; activePosePreset = 'manual'; manualPose.rightArm = v * RAD; updateMotionUI(); }, v => `${v}°`);
    addRange(joints, 'خم زانو و آرنج', Math.round(manualPose.rightElbow / RAD), 0, 110, 1, v => { motion = 'custom'; activePosePreset = 'manual'; manualPose.leftElbow = v * RAD; manualPose.rightElbow = v * RAD; updateMotionUI(); }, v => `${v}°`);
    addRange(joints, 'بالا آوردن پای راست', Math.round(manualPose.legLift), 0, 75, 1, v => { motion = 'custom'; activePosePreset = 'manual'; manualPose.legLift = v; manualPose.squat = 0; updateMotionUI(); }, v => `${v} px`);
    editor.appendChild(joints);

    const info = makeCard('نحوهٔ حرکت مفاصل');
    addNote(info, 'دست و پا با <b>حل‌کنندهٔ IK دو‌بخشی</b> محاسبه می‌شوند؛ طول ران، ساق، بازو و ساعد ثابت می‌ماند و آرنج/زانو از اتصال دو استخوان به‌دست می‌آید. هنگام بالا آوردن پا، لگن و بالاتنه برای حفظ تعادل جابه‌جا می‌شوند.');
    editor.appendChild(info);
  }

  function selectMotion(next) {
    motion = next;
    manualPose.squat = 0;
    if (next === 'balance') {
      Object.assign(manualPose, { leftArm: -1.05, rightArm: 1.05, torso: -0.05, legLift: 42 });
    }
    activePosePreset = 'neutral';
    StickmanPhysics.setMotion(state, motion, physicsConfig());
    updateMotionUI();
  }

  function renderMotionPanel() {
    editor.appendChild(sectionHeading('▶', 'حرکت‌های آماده', 'برای دیدن حرکت طبیعی، یکی از حالت‌ها را انتخاب کن.'));
    const cards = makeCard('انیمیشن زنده');
    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    Object.entries(motionMeta).forEach(([key, meta]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice' + (motion === key ? ' active' : '');
      button.dataset.motion = key;
      button.innerHTML = `<span class="choice-icon">${meta.icon}</span><span>${meta.title}<small>${key === 'idle' ? 'نفس کشیدن و ریزحرکت‌ها' : key === 'walk' ? 'گام‌برداری با کف پای ثابت' : key === 'run' ? 'گام سریع و انتقال وزن' : key === 'wave' ? 'حرکت نرم دست و مچ' : key === 'guard' ? 'حالت آماده و پویا' : 'تکیه روی پای پشتیبان'}</small></span>`;
      button.addEventListener('click', () => selectMotion(key));
      grid.appendChild(button);
    });
    cards.appendChild(grid);
    editor.appendChild(cards);

    const speed = makeCard('تنظیم سرعت');
    addRange(speed, 'سرعت کلی انیمیشن', animationSpeed, 0.45, 1.8, 0.05, v => animationSpeed = v, v => `${v.toFixed(2)}×`);
    addNote(speed, 'در حالت ایستاده، حرکت‌های بسیار ظریف تنفس، جابه‌جایی نرم شانه‌ها و اصلاح تعادل به‌صورت پیوسته اجرا می‌شوند.');
    editor.appendChild(speed);

    const controls = makeCard('کنترل پخش');
    const row = document.createElement('div');
    row.className = 'action-row';
    addAction(row, 'توقف و ایستادن', () => selectMotion('idle'), true);
    addAction(row, 'پرش', () => doJump(), false);
    controls.appendChild(row);
    editor.appendChild(controls);
  }

  function renderPhysicsPanel() {
    editor.appendChild(sectionHeading('◎', 'فیزیک و تعادل', 'گرانش، فرود و کنترل مرکز ثقل بدن.'));
    const forces = makeCard('پارامترهای فیزیکی');
    addRange(forces, 'شتاب گرانش', physics.gravity, 250, 1800, 10, v => physics.gravity = v, v => `${v} px/s²`);
    addRange(forces, 'قدرت پرش', physics.jumpImpulse, 280, 850, 10, v => physics.jumpImpulse = v, v => `${v} px/s`);
    editor.appendChild(forces);

    const balance = makeCard('کنترل پایداری');
    addSwitch(balance, 'کمک‌تعادل و اصلاح مرکز ثقل', physics.balanceAssist, v => {
      physics.balanceAssist = v;
      $('#balanceState').textContent = v ? 'فعال' : 'خاموش';
    });
    addNote(balance, 'وقتی یک پا از زمین جدا می‌شود، موقعیت لگن و زاویهٔ بالاتنه نسبت به پای تکیه‌گاه اصلاح می‌شود تا مرکز جرم تا حد ممکن بالای سطح اتکا بماند.');
    editor.appendChild(balance);

    const ground = makeCard('تماس با زمین');
    const row = document.createElement('div');
    row.className = 'pill-row';
    ['پاهای چسبیده به زمین', 'برخورد و فرود', 'محدودیت طول استخوان‌ها'].forEach(text => {
      const pill = document.createElement('span');
      pill.className = 'pill-btn active';
      pill.textContent = text;
      pill.setAttribute('aria-label', text + ' فعال');
      row.appendChild(pill);
    });
    ground.appendChild(row);
    addNote(ground, 'قفل تماس کف پا همیشه روشن است. هنگام فاز اتکا، مختصات پای تکیه‌گاه ثابت می‌ماند؛ هنگام پرش و فرود نیز گرانش و برخورد با سطح زمین اعمال می‌شوند.');
    editor.appendChild(ground);

    const actions = makeCard('آزمایش فیزیک');
    const row2 = document.createElement('div');
    row2.className = 'action-row';
    addAction(row2, 'پرش آزمایشی', doJump, true);
    addAction(row2, 'بازنشانی وضعیت', () => {
      state.height = 0; state.vy = 0; state.onGround = true; state.vx = 0;
      state.feet.forEach(f => { f.plantX = null; f.swing = false; });
      StickmanPhysics.resetFeet(state, 14);
      showToast('وضعیت فیزیکی بازنشانی شد.');
    });
    actions.appendChild(row2);
    editor.appendChild(actions);
  }

  let animationSpeed = 1;

  function renderPanel(tab) {
    activeTab = tab || activeTab;
    editor.replaceChildren();
    if (activeTab === 'design') renderDesignPanel();
    else if (activeTab === 'pose') renderPosePanel();
    else if (activeTab === 'motion') renderMotionPanel();
    else renderPhysicsPanel();
    $$('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === activeTab));
  }

  function updateMotionUI() {
    const meta = motionMeta[motion] || { label: 'پوز دستی' };
    $('#motionLabel').textContent = motion === 'custom' ? 'پوز دستی' : meta.label;
    $$('[data-motion]').forEach(button => button.classList.toggle('active', button.dataset.motion === motion));
  }

  function physicsConfig() {
    return {
      gravity: physics.gravity,
      walkSpeed: 112 * animationSpeed,
      runSpeed: 218 * animationSpeed,
      stride: 72,
      swingHeight: 27,
      stance: 14
    };
  }

  function doJump() {
    if (StickmanPhysics.jump(state, physics.jumpImpulse)) {
      showToast('پرش با گرانش و برخورد زمین اجرا شد.');
    }
  }

  function dimensions() {
    const h = appearance.height;
    const l = appearance.limbs;
    return {
      spine: 57 * h,
      neck: 13 * h,
      headOffset: 20 * h,
      headRadius: 16.7 * appearance.head * h,
      shoulderWidth: 37 * appearance.shoulders * h,
      hipWidth: 20 * l * h,
      upperArm: 42 * l * h,
      forearm: 36 * l * h,
      hand: 9 * l * h,
      thigh: 73 * l * h,
      shin: 70 * l * h,
      footLength: 24 * l * h,
      armWidth: (appearance.style === 'classic' ? 9 : appearance.style === 'armored' ? 14 : 12) * l * h,
      legWidth: (appearance.style === 'classic' ? 11 : appearance.style === 'armored' ? 16 : 14) * l * h,
      bodyWidth: (appearance.style === 'classic' ? 21 : appearance.style === 'armored' ? 31 : 27) * h
    };
  }

  function getPose() {
    const t = state.time * animationSpeed;
    const p = {
      torso: 0.016 * Math.sin(t * 1.35),
      head: 0.018 * Math.sin(t * 0.82 + 0.7),
      leftArm: -0.075 + 0.025 * Math.sin(t * 1.5),
      rightArm: 0.075 - 0.025 * Math.sin(t * 1.5 + 0.4),
      leftElbow: 0.20 + 0.025 * Math.sin(t * 1.1),
      rightElbow: 0.21 + 0.025 * Math.sin(t * 1.1 + 0.5),
      leftFoot: 0, rightFoot: 0, squat: 0
    };

    if (!state.onGround) {
      const tuck = clamp(-state.height / 95, 0, 1);
      p.torso = 0.06;
      p.leftArm = -1.75;
      p.rightArm = 1.75;
      p.leftElbow = 0.52;
      p.rightElbow = 0.52;
      p.leftFoot = -0.16 * tuck;
      p.rightFoot = -0.16 * tuck;
      return p;
    }

    if (motion === 'walk' || motion === 'run') {
      const phase = state.gaitDistance / 72 * TAU;
      const run = motion === 'run';
      const swing = Math.sin(phase) * (run ? 0.78 : 0.53);
      p.leftArm = -0.08 + swing;
      p.rightArm = 0.08 - swing;
      p.leftElbow = run ? 0.52 : 0.34;
      p.rightElbow = run ? 0.52 : 0.34;
      p.torso = run ? 0.20 : 0.11;
      p.head = -0.015 * Math.sin(phase * 0.5);
      p.squat = run ? 13 : 2.5;
      return p;
    }
    if (motion === 'wave') {
      p.rightArm = 2.2 + 0.12 * Math.sin(t * 1.4);
      p.rightElbow = 0.48 + 0.27 * Math.sin(t * 5.8);
      p.leftArm = -0.12;
      p.leftElbow = 0.24;
      p.head = 0.045 * Math.sin(t * 1.8);
      p.torso = 0.025 * Math.sin(t * 1.1);
      return p;
    }
    if (motion === 'guard') {
      p.leftArm = 1.15 + 0.025 * Math.sin(t * 2.2);
      p.rightArm = 1.55 + 0.035 * Math.sin(t * 2.1 + 0.5);
      p.leftElbow = 0.78;
      p.rightElbow = 0.92;
      p.torso = 0.13;
      p.head = -0.06;
      p.squat = 4;
      return p;
    }
    if (motion === 'balance') {
      Object.assign(p, { leftArm: -1.05, rightArm: 1.05, leftElbow: 0.12, rightElbow: 0.12, torso: -0.035, head: 0.025 });
      return p;
    }
    if (motion === 'custom') {
      Object.assign(p, manualPose);
      return p;
    }
    return p;
  }

  function getFootTargets(dims) {
    const ankleLift = -7;
    const targets = state.feet.map(f => ({ x: f.x, y: state.onGround ? ankleLift + f.y : f.y }));
    if (motion === 'balance') {
      targets[1] = { x: state.x + 38, y: -43 };
    } else if (motion === 'custom' && manualPose.legLift > 0) {
      targets[1] = { x: state.x + 18 + manualPose.legLift * 0.22, y: -manualPose.legLift };
    }
    return targets;
  }

  function makeSkeleton() {
    const dims = dimensions();
    const pose = getPose();
    const footTargets = getFootTargets(dims);
    const baseHipY = -(dims.thigh + dims.shin) * 0.955 + state.height + (pose.squat || 0);
    const root = { x: state.x, y: baseHipY + (state.onGround ? Math.sin(state.time * 1.7) * 1.1 : 0) };
    let skeleton = StickmanRig.build(root, footTargets, dims, pose, 1);
    let balanceOffset = 0;
    let leanCorrection = 0;

    if (physics.balanceAssist && state.onGround && (motion === 'balance' || (motion === 'custom' && manualPose.legLift > 1) || motion === 'walk' || motion === 'run')) {
      const support = footTargets.filter((foot, index) => {
        if (motion === 'balance' || (motion === 'custom' && manualPose.legLift > 1)) return index === 0;
        return state.feet[index].y >= -0.5 && !state.feet[index].swing;
      });
      const supportX = support.length ? support.reduce((sum, foot) => sum + foot.x, 0) / support.length : state.x;
      const com = StickmanRig.centerOfMass(skeleton);
      balanceOffset = clamp((supportX - com.x) * 0.28, -20, 20);
      leanCorrection = clamp((supportX - com.x) / Math.max(1, dims.spine) * 0.2, -0.12, 0.12);
      skeleton = StickmanRig.build({ x: root.x + balanceOffset, y: root.y }, footTargets, dims, { ...pose, torso: pose.torso + leanCorrection }, 1);
    }
    const com = StickmanRig.centerOfMass(skeleton);
    return { skeleton, dims, footTargets, com, balanceOffset };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    stageWidth = Math.max(1, rect.width);
    stageHeight = Math.max(1, rect.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(stageWidth * pixelRatio);
    canvas.height = Math.round(stageHeight * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    scale = Math.min(stageWidth / 820, stageHeight / 510);
    groundScreen = stageHeight * 0.79;
  }

  function screen(point) {
    return {
      x: stageWidth * 0.5 + (point.x - state.x) * scale,
      y: groundScreen + point.y * scale
    };
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, stageHeight);
    sky.addColorStop(0, '#111d2e');
    sky.addColorStop(0.58, '#172536');
    sky.addColorStop(1, '#0a111b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, stageWidth, stageHeight);

    const glow = ctx.createRadialGradient(stageWidth * 0.5, stageHeight * 0.43, 5, stageWidth * 0.5, stageHeight * 0.43, stageWidth * 0.5);
    glow.addColorStop(0, 'rgba(87,139,181,.15)');
    glow.addColorStop(1, 'rgba(12,22,34,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, stageWidth, groundScreen + 30);

    ctx.strokeStyle = 'rgba(148,181,211,.07)';
    ctx.lineWidth = 1;
    const gap = 44 * scale;
    const offset = ((state.x * scale) % gap + gap) % gap;
    for (let x = -gap - offset; x < stageWidth + gap; x += gap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, groundScreen); ctx.stroke();
    }
    for (let y = 30; y < groundScreen; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(stageWidth, y); ctx.stroke();
    }

    const floor = ctx.createLinearGradient(0, groundScreen, 0, stageHeight);
    floor.addColorStop(0, '#1a2a3a');
    floor.addColorStop(1, '#0c141f');
    ctx.fillStyle = floor;
    ctx.fillRect(0, groundScreen, stageWidth, stageHeight - groundScreen);
    ctx.strokeStyle = '#8ca9bd';
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, groundScreen); ctx.lineTo(stageWidth, groundScreen); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(144,173,199,.12)';
    ctx.lineWidth = 1;
    const floorGap = Math.max(20, gap * 0.8);
    const floorOffset = ((state.x * scale * 0.65) % floorGap + floorGap) % floorGap;
    for (let x = -floorGap - floorOffset; x < stageWidth + floorGap; x += floorGap) {
      ctx.beginPath(); ctx.moveTo(stageWidth * 0.5 + (x - stageWidth * 0.5) * 0.18, groundScreen); ctx.lineTo(x, stageHeight); ctx.stroke();
    }
    for (let i = 1; i < 5; i++) {
      const y = groundScreen + i * i * 9;
      if (y < stageHeight) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(stageWidth, y); ctx.stroke(); }
    }
  }

  function drawBone(a, b, width, color, highlight = true) {
    const A = screen(a), B = screen(b);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(3,8,14,.72)'; ctx.lineWidth = width * scale + 5 * scale;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width * scale;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    if (highlight) {
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = Math.max(1, width * scale * 0.17);
      ctx.beginPath(); ctx.moveTo(A.x - 1.1 * scale, A.y - 1.1 * scale); ctx.lineTo(B.x - 1.1 * scale, B.y - 1.1 * scale); ctx.stroke();
    }
  }

  function drawJoint(point, radius, color) {
    const p = screen(point);
    ctx.fillStyle = 'rgba(2,7,12,.65)'; ctx.beginPath(); ctx.arc(p.x, p.y, (radius + 2) * scale, 0, TAU); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, radius * scale, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, radius * scale, 0, TAU); ctx.stroke();
  }

  function drawFoot(leg, dims) {
    const A = screen(leg.ankle), H = screen(leg.heel), T = screen(leg.toe);
    const shoe = appearance.style === 'classic' ? appearance.body : appearance.accent;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#070d14'; ctx.lineWidth = 15 * dims.legWidth / 14 * scale;
    ctx.beginPath(); ctx.moveTo(H.x, H.y + 1 * scale); ctx.lineTo(T.x, T.y + 1 * scale); ctx.stroke();
    ctx.strokeStyle = shoe; ctx.lineWidth = 11 * dims.legWidth / 14 * scale;
    ctx.beginPath(); ctx.moveTo(H.x, H.y); ctx.lineTo(T.x, T.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.26)'; ctx.lineWidth = 1.5 * scale;
    ctx.beginPath(); ctx.moveTo(A.x, A.y - 2 * scale); ctx.lineTo(T.x - 2 * scale, T.y - 2 * scale); ctx.stroke();
    if (appearance.style !== 'classic') {
      ctx.strokeStyle = appearance.accent; ctx.lineWidth = 2.2 * scale;
      ctx.beginPath(); ctx.moveTo(H.x + 2 * scale, H.y + 4 * scale); ctx.lineTo(T.x - 2 * scale, T.y + 4 * scale); ctx.stroke();
    }
  }

  function drawCharacter(data) {
    const { skeleton: sk, dims } = data;
    const bodyColor = appearance.body;
    const accent = appearance.accent;
    const skin = appearance.skin;
    const armWidth = dims.armWidth;
    const legWidth = dims.legWidth;

    // سایهٔ تماس: با فاصله گرفتن بدن از زمین کوچک‌تر و کم‌رنگ‌تر می‌شود.
    const shadowPoint = screen({ x: state.x, y: 0 });
    const shadowScale = clamp(1 + state.height / 250, 0.42, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.34 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(shadowPoint.x, shadowPoint.y + 5 * scale, 52 * scale * shadowScale, 9 * scale * shadowScale, 0, 0, TAU);
    ctx.fill();

    // پای دور و دست دور ابتدا رسم می‌شوند.
    const backLeg = sk.legs.left;
    drawBone(backLeg.hip, backLeg.knee, legWidth, shadeColor(bodyColor, -0.18));
    drawBone(backLeg.knee, backLeg.ankle, legWidth * 0.82, shadeColor(bodyColor, -0.12));
    drawFoot(backLeg, dims);
    const backArm = sk.arms.left;
    drawBone(backArm.shoulder, backArm.elbow, armWidth * 0.9, shadeColor(bodyColor, -0.12));
    drawBone(backArm.elbow, backArm.wrist, armWidth * 0.78, shadeColor(bodyColor, -0.1));
    drawJoint(backArm.hand, armWidth * 0.37, skin);

    // تنه و لباس
    drawBone(sk.pelvis, sk.chest, dims.bodyWidth, bodyColor, true);
    drawBone(sk.chest, sk.neck, Math.max(8, dims.bodyWidth * 0.35), skin, false);
    const pelvis = screen(sk.pelvis), chest = screen(sk.chest);
    ctx.strokeStyle = accent; ctx.lineWidth = 3.2 * scale; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pelvis.x - dims.bodyWidth * 0.38 * scale, pelvis.y - 1 * scale); ctx.lineTo(chest.x - dims.bodyWidth * 0.38 * scale, chest.y + 8 * scale); ctx.stroke();
    if (appearance.style !== 'classic') {
      ctx.strokeStyle = 'rgba(255,226,173,.72)'; ctx.lineWidth = 2.4 * scale;
      ctx.beginPath(); ctx.moveTo(pelvis.x - 12 * scale, pelvis.y - 2 * scale); ctx.lineTo(pelvis.x + 12 * scale, pelvis.y - 2 * scale); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(pelvis.x, pelvis.y, 4.1 * scale, 0, TAU); ctx.fill();
    }

    // سر، مو و چهره
    const head = screen(sk.head);
    const radius = dims.headRadius * scale;
    const skinGrad = ctx.createRadialGradient(head.x - radius * 0.35, head.y - radius * 0.42, 1, head.x, head.y, radius * 1.25);
    skinGrad.addColorStop(0, shadeColor(skin, 0.17));
    skinGrad.addColorStop(1, shadeColor(skin, -0.1));
    ctx.fillStyle = 'rgba(3,8,14,.74)'; ctx.beginPath(); ctx.arc(head.x, head.y, radius + 2.5 * scale, 0, TAU); ctx.fill();
    ctx.fillStyle = skinGrad; ctx.beginPath(); ctx.arc(head.x, head.y, radius, 0, TAU); ctx.fill();
    ctx.fillStyle = appearance.hair;
    ctx.beginPath();
    ctx.arc(head.x - 1.4 * scale, head.y - 2 * scale, radius * 1.02, Math.PI * 1.06, Math.PI * 2.05);
    ctx.quadraticCurveTo(head.x + radius * 0.32, head.y - radius * 0.5, head.x + radius * 0.8, head.y - radius * 0.18);
    ctx.quadraticCurveTo(head.x + radius * 0.12, head.y - radius * 0.66, head.x - radius, head.y - radius * 0.38);
    ctx.fill();
    const eyeX = head.x + 6.5 * scale;
    const eyeY = head.y - 1.5 * scale;
    ctx.fillStyle = '#2b2630'; ctx.beginPath(); ctx.arc(eyeX, eyeY, 1.7 * scale, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(88,48,42,.65)'; ctx.lineWidth = 1.2 * scale;
    ctx.beginPath(); ctx.moveTo(head.x + 7 * scale, head.y + 5 * scale); ctx.lineTo(head.x + 11 * scale, head.y + 4 * scale); ctx.stroke();

    // دست نزدیک و پای نزدیک
    const frontArm = sk.arms.right;
    drawBone(frontArm.shoulder, frontArm.elbow, armWidth, bodyColor);
    drawBone(frontArm.elbow, frontArm.wrist, armWidth * 0.82, bodyColor);
    drawJoint(frontArm.hand, armWidth * 0.4, skin);
    const frontLeg = sk.legs.right;
    drawBone(frontLeg.hip, frontLeg.knee, legWidth * 1.04, bodyColor);
    drawBone(frontLeg.knee, frontLeg.ankle, legWidth * 0.9, bodyColor);
    drawFoot(frontLeg, dims);

    // زره شانه برای حالت رزمی/زره‌پوش
    if (appearance.style === 'fighter' || appearance.style === 'armored') {
      const shoulder = screen(sk.shoulders.right);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(shoulder.x + 1 * scale, shoulder.y, (appearance.style === 'armored' ? 12 : 8) * scale, (appearance.style === 'armored' ? 8 : 6) * scale, -0.22, 0, TAU);
      ctx.fill();
      if (appearance.style === 'armored') {
        ctx.strokeStyle = 'rgba(255,231,178,.8)'; ctx.lineWidth = 1.4 * scale;
        ctx.beginPath(); ctx.arc(shoulder.x, shoulder.y, 7 * scale, Math.PI, TAU); ctx.stroke();
      }
    }

    if (showJoints) {
      const joints = [sk.pelvis, sk.chest, sk.neck, sk.shoulders.left, sk.shoulders.right,
        sk.arms.left.elbow, sk.arms.left.wrist, sk.arms.right.elbow, sk.arms.right.wrist,
        sk.legs.left.knee, sk.legs.left.ankle, sk.legs.right.knee, sk.legs.right.ankle];
      joints.forEach((point, index) => drawJoint(point, index < 3 ? 4.2 : 3.2, index < 3 ? '#ffd36a' : '#66d8db'));
      const com = screen(data.com);
      ctx.save();
      ctx.setLineDash([3 * scale, 4 * scale]);
      ctx.strokeStyle = 'rgba(255,205,101,.72)';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath(); ctx.moveTo(com.x, com.y); ctx.lineTo(com.x, groundScreen); ctx.stroke();
      ctx.restore();
      drawJoint(data.com, 4.4, '#ffc85d');
    }
  }

  function shadeColor(hex, amount) {
    const raw = hex.replace('#', '');
    const n = parseInt(raw, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const target = amount >= 0 ? 255 : 0;
    const factor = Math.abs(amount);
    r = Math.round(r + (target - r) * factor);
    g = Math.round(g + (target - g) * factor);
    b = Math.round(b + (target - b) * factor);
    return `rgb(${r},${g},${b})`;
  }

  function renderStatus(data) {
    const oneLeg = motion === 'balance' || (motion === 'custom' && manualPose.legLift > 1);
    const support = data.footTargets.filter((foot, index) => {
      if (oneLeg) return index === 0;
      return state.feet[index].y >= -0.5 && !state.feet[index].swing;
    });
    const supportX = support.length ? support.reduce((sum, foot) => sum + foot.x, 0) / support.length : state.x;
    const gap = Math.abs(data.com.x - supportX);
    const stable = !physics.balanceAssist || !oneLeg || gap < 42;
    $('#statusDot').classList.toggle('unstable', !stable);
    $('#statusText').textContent = !state.onGround ? 'در حال پرواز' : stable ? 'تعادل برقرار است' : 'در حال اصلاح تعادل';
    $('#balanceState').textContent = physics.balanceAssist ? 'فعال' : 'خاموش';
  }

  function draw() {
    if (!stageWidth || !stageHeight) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawBackground();
    const data = makeSkeleton();
    drawCharacter(data);
    renderStatus(data);
    lastSkeleton = data.skeleton;
  }

  function frame(timestamp) {
    if (!lastFrame) lastFrame = timestamp;
    const dt = clamp((timestamp - lastFrame) / 1000, 0, 1 / 30);
    lastFrame = timestamp;
    StickmanPhysics.step(state, dt, motion === 'walk' || motion === 'run' ? motion : 'idle', physicsConfig());
    if (motion === 'custom' && manualPose.legLift > 0) {
      // پای راست عمداً بالا نگه داشته می‌شود؛ پای چپ همچنان نقطهٔ اتکاست.
    }
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function switchTab(tab) {
    renderPanel(tab);
  }

  function saveProject() {
    const project = {
      version: 3,
      appearance: { ...appearance },
      manualPose: { ...manualPose },
      physics: { ...physics },
      motion
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stickman-character.json';
    link.click();
    URL.revokeObjectURL(url);
    showToast('فایل پروژه ذخیره شد.');
  }

  function savePng() {
    try {
      const link = document.createElement('a');
      link.download = 'stickman-character.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('تصویر کاراکتر ذخیره شد.');
    } catch (error) {
      showToast('ذخیرهٔ تصویر در این مرورگر ممکن نشد.');
    }
  }

  function loadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const project = JSON.parse(String(reader.result));
          if (!project || project.version !== 3 || !project.appearance || !project.physics) throw new Error('نسخهٔ فایل پشتیبانی نمی‌شود.');
          Object.assign(appearance, project.appearance);
          Object.assign(manualPose, project.manualPose || {});
          Object.assign(physics, project.physics);
          if (motionMeta[project.motion] || project.motion === 'custom') motion = project.motion;
          StickmanPhysics.setMotion(state, motion, physicsConfig());
          renderPanel(activeTab);
          updateMotionUI();
          showToast('پروژه بارگذاری شد.');
        } catch (error) {
          showToast(error.message || 'فایل پروژه معتبر نیست.');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function exportSvg() {
    if (!lastSkeleton) return;
    const sk = lastSkeleton;
    const d = sk.dims;
    const sx = point => 400 + (point.x - state.x) * 1.45;
    const sy = point => 430 + point.y * 1.45;
    const pt = point => `${sx(point).toFixed(1)},${sy(point).toFixed(1)}`;
    const line = (a, b, width, color) => `<path d="M ${pt(a)} L ${pt(b)}" fill="none" stroke="${color}" stroke-width="${(width * 1.45).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const circle = (p, r, color) => `<circle cx="${sx(p).toFixed(1)}" cy="${sy(p).toFixed(1)}" r="${(r * 1.45).toFixed(1)}" fill="${color}"/>`;
    const body = appearance.body, accent = appearance.accent, skin = appearance.skin;
    const pieces = [];
    pieces.push('<rect width="800" height="600" fill="#101b29"/>');
    pieces.push('<path d="M0 430 H800" stroke="#9bb1c2" stroke-opacity=".55" stroke-width="2"/>');
    pieces.push('<ellipse cx="400" cy="438" rx="72" ry="11" fill="#000" opacity=".32"/>');
    [['left', 0.88], ['right', 1]].forEach(([which, factor]) => {
      const leg = sk.legs[which];
      pieces.push(line(leg.hip, leg.knee, d.legWidth * factor, body));
      pieces.push(line(leg.knee, leg.ankle, d.legWidth * 0.84 * factor, body));
      pieces.push(line(leg.heel, leg.toe, d.legWidth * 0.76, appearance.style === 'classic' ? body : accent));
    });
    pieces.push(line(sk.pelvis, sk.chest, d.bodyWidth, body));
    pieces.push(line(sk.chest, sk.neck, d.bodyWidth * 0.34, skin));
    ['left', 'right'].forEach((which, i) => {
      const arm = sk.arms[which];
      pieces.push(line(arm.shoulder, arm.elbow, d.armWidth * (i ? 1 : 0.9), body));
      pieces.push(line(arm.elbow, arm.wrist, d.armWidth * 0.78, body));
      pieces.push(circle(arm.hand, d.armWidth * 0.36, skin));
    });
    const head = sk.head;
    pieces.push(circle(head, d.headRadius, skin));
    const hx = sx(head), hy = sy(head), hr = d.headRadius * 1.45;
    pieces.push(`<path d="M ${hx - hr * 1.25} ${hy - hr * .25} Q ${hx} ${hy - hr * 1.5} ${hx + hr * 1.15} ${hy - hr * .35} Q ${hx} ${hy - hr * .8} ${hx - hr * 1.25} ${hy - hr * .25} Z" fill="${appearance.hair}"/>`);
    pieces.push(`<path d="M ${sx(sk.pelvis) - 9} ${sy(sk.pelvis) - 2} L ${sx(sk.chest) - 9} ${sy(sk.chest) + 9}" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`);
    if (showJoints) {
      [sk.pelvis, sk.chest, sk.neck, sk.legs.left.knee, sk.legs.right.knee, sk.arms.left.elbow, sk.arms.right.elbow].forEach(p => pieces.push(circle(p, 3.6, '#66d8db')));
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">${pieces.join('')}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'stickman-character.svg'; link.click();    URL.revokeObjectURL(url);
    showToast('خروجی برداری SVG ذخیره شد.');
  }

  function bindEvents() {
    $$('.tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    $('#savePng').addEventListener('click', savePng);
    $('#exportSvg').addEventListener('click', exportSvg);
    $('#fullscreen').addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) await stageWrap.requestFullscreen();
        else await document.exitFullscreen();
      } catch (error) { showToast('تمام‌صفحه در این مرورگر پشتیبانی نمی‌شود.'); }
    });
    $('#toggleJoints').addEventListener('click', () => {
      showJoints = !showJoints;
      $('#toggleJoints').setAttribute('aria-pressed', showJoints ? 'true' : 'false');
      showToast(showJoints ? 'مفاصل نمایش داده شدند.' : 'نمایش مفاصل خاموش شد.');
    });
    $('#jump').addEventListener('click', doJump);
    window.addEventListener('keydown', event => {
      if (event.code === 'Space' && !['INPUT', 'BUTTON'].includes(document.activeElement.tagName)) {
        event.preventDefault(); doJump();
      }
    });
    if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(stageWrap);
    else window.addEventListener('resize', resizeCanvas);
  }

  function init() {
    bindEvents();
    renderPanel('design');
    updateMotionUI();
    resizeCanvas();
    StickmanPhysics.resetFeet(state, 14);
    rafId = requestAnimationFrame(frame);
    window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));
  }

  init();
})();
