const WIDTH = 1000;
const HEIGHT = 620;

const LEVELS = [
  { name: '加法森林', topic: '加法練習', color: 0x81dfba, tint: '#9be6c8' },
  { name: '減法沙漠', topic: '減法練習', color: 0xffca79, tint: '#ffd18c' },
  { name: '乘法星港', topic: '乘法練習', color: 0xc5a1ff, tint: '#cdb5ff' },
  { name: '除法月灣', topic: '除法練習', color: 0x82d9f1, tint: '#8ddcf2' },
  { name: '綜合挑戰', topic: '綜合練習', color: 0xff91a5, tint: '#ffa5b4' }
];

const COLORS = {
  ink: '#f8f7ff', muted: '#a8afcf', faint: '#747dA5',
  gold: '#ffd16d', green: '#9be7c1', red: '#ff9aab'
};

class AdventureScene extends Phaser.Scene {
  constructor() {
    super('Adventure');
    this.mode = 'menu';
    this.score = 0;
    this.levelIndex = 0;
    this.questionIndex = 0;
    this.touchDirection = null;
    this.blockedOrb = null;
    this.busy = false;
  }

  create() {
    this.drawBackdrop();
    this.backdropChildren = new Set(this.children.list);
    this.showMenu();
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.mode === 'menu' || this.mode === 'complete') this.startGame();
      else if (this.mode === 'levelComplete') this.nextLevel();
    });
    this.input.on('pointerup', () => { this.touchDirection = null; });
  }

  drawBackdrop() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1b2241, 0x1b2241, 0x171d37, 0x171d37, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);

    const rng = new Phaser.Math.RandomDataGenerator(['math-stars']);
    for (let i = 0; i < 85; i++) {
      const x = rng.between(20, WIDTH - 20);
      const y = rng.between(15, HEIGHT - 10);
      const radius = rng.realInRange(0.7, 2.1);
      this.add.circle(x, y, radius, 0xd8e1ff, rng.realInRange(0.12, 0.46));
    }

    // Soft orbital lines give the playfield a little depth without obscuring answers.
    const orbit = this.add.graphics().setAlpha(0.18);
    orbit.lineStyle(1, 0x929ec9, 0.42);
    orbit.strokeEllipse(500, 350, 850, 315);
    orbit.strokeEllipse(500, 350, 680, 245);

    const planet = this.add.circle(900, 113, 43, 0x3c4c79, 0.24);
    planet.setStrokeStyle(1, 0x92a4e0, 0.24);
    this.add.circle(885, 99, 10, 0xa9b4e7, 0.13);
    this.tweens.add({ targets: planet, y: 119, duration: 3100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  showMenu() {
    this.mode = 'menu';
    this.clearUi();

    this.add.text(500, 138, '✦   數學星球探險隊   ✦', {
      fontFamily: 'Nunito, Noto Sans TC, sans-serif', fontSize: '15px', color: '#f6cf76',
      fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5).setDepth(20);

    this.add.text(500, 210, '準備好蒐集答案了嗎？', {
      fontFamily: 'Nunito, Noto Sans TC, sans-serif', fontSize: '36px', color: COLORS.ink,
      fontStyle: 'bold', stroke: '#171d37', strokeThickness: 2
    }).setOrigin(0.5).setDepth(20);

    this.add.text(500, 260, '移動小星球人，碰到正確答案就能前往下一題！', {
      fontFamily: 'Noto Sans TC, sans-serif', fontSize: '16px', color: COLORS.muted
    }).setOrigin(0.5).setDepth(20);

    const avatar = this.makeCharacter(500, 345, 1.22).setDepth(20);
    this.tweens.add({ targets: avatar, y: 336, angle: 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const cards = [
      ['⌨', '方向鍵 / WASD', '移動角色'],
      ['✦', '答對 +10 分', '答錯 −5 分']
    ];
    cards.forEach((card, i) => {
      const x = i === 0 ? 360 : 640;
      const box = this.add.graphics();
      box.fillStyle(0xffffff, 0.055); box.fillRoundedRect(x - 120, 386, 240, 58, 15);
      box.lineStyle(1, 0xe1e7ff, 0.12); box.strokeRoundedRect(x - 120, 386, 240, 58, 15);
      this.add.text(x - 95, 400, card[0], { fontSize: '19px', color: '#f6cf76' }).setOrigin(0, 0.5);
      this.add.text(x - 65, 398, card[1], { fontFamily: 'Noto Sans TC, sans-serif', fontSize: '13px', color: COLORS.ink, fontStyle: 'bold' }).setOrigin(0, 0.5);
      this.add.text(x - 65, 420, card[2], { fontFamily: 'Noto Sans TC, sans-serif', fontSize: '11px', color: COLORS.muted }).setOrigin(0, 0.5);
    });

    this.makeButton(500, 530, '開始冒險', () => this.startGame(), 204, 54);
    this.add.text(500, 576, '共 5 關 · 每關 3 題', {
      fontFamily: 'Noto Sans TC, sans-serif', fontSize: '11px', color: COLORS.faint
    }).setOrigin(0.5).setDepth(20);
  }

  startGame() {
    if (this.mode === 'playing') return;
    this.clearUi();
    this.score = 0;
    this.levelIndex = 0;
    this.questionIndex = 0;
    this.mode = 'playing';
    this.createPlayfield();
    this.setupKeyboard();
    this.showQuestion();
  }

  createPlayfield() {
    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x12182e, 0.56); panel.fillRoundedRect(25, 29, 950, 552, 22);
    panel.lineStyle(1, 0xd9e1ff, 0.1); panel.strokeRoundedRect(25, 29, 950, 552, 22);

    // A dotted trail suggests a route through the answer islands.
    const trail = this.add.graphics().setDepth(1).setAlpha(0.28);
    trail.lineStyle(2, 0xa6afd4, 0.35);
    trail.beginPath(); trail.moveTo(130, 337); trail.lineTo(335, 337); trail.lineTo(505, 260); trail.lineTo(680, 337); trail.lineTo(865, 337); trail.strokePath();
    for (let x = 151; x < 865; x += 32) this.add.circle(x, 337, 1.7, 0xcbd3fa, 0.25).setDepth(1);

    this.hud = this.add.container(0, 0).setDepth(10);
    this.questionText = this.add.text(500, 70, '', {
      fontFamily: 'Nunito, Noto Sans TC, sans-serif', fontSize: '30px', color: COLORS.ink,
      fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5);
    this.hud.add(this.questionText);

    this.levelText = this.add.text(59, 62, '', {
      fontFamily: 'Noto Sans TC, sans-serif', fontSize: '12px', color: COLORS.muted, fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    this.hud.add(this.levelText);

    this.scorePanel = this.add.graphics();
    this.scorePanel.fillStyle(0xffd16d, 0.09); this.scorePanel.fillRoundedRect(827, 44, 119, 38, 12);
    this.scorePanel.lineStyle(1, 0xffd16d, 0.22); this.scorePanel.strokeRoundedRect(827, 44, 119, 38, 12);
    this.hud.add(this.scorePanel);
    this.scoreText = this.add.text(886, 63, '✦  0 分', {
      fontFamily: 'Noto Sans TC, sans-serif', fontSize: '14px', color: '#ffdc89', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.hud.add(this.scoreText);

    this.progressDots = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const dot = this.add.circle(440 + i * 30, 113, 5, 0x9299b9, 0.34);
      this.hud.add(dot); this.progressDots.push(dot);
    }

    this.hintText = this.add.text(500, 552, '碰一碰答案星球來蒐集答案', {
      fontFamily: 'Noto Sans TC, sans-serif', fontSize: '12px', color: '#8e96b7'
    }).setOrigin(0.5);
    this.hud.add(this.hintText);

    this.player = this.makeCharacter(120, 338, 0.85).setDepth(6);
    this.answerGroup = this.add.group();
    this.makeDpad();
  }

  setupKeyboard() {
    if (this.keys) return;
    this.keys = this.input.keyboard?.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      w: 'W', a: 'A', s: 'S', d: 'D'
    });
  }

  makeDpad() {
    const cx = 100, cy = 490, size = 35, gap = 38;
    const directions = [
      { x: cx, y: cy - gap, key: 'up', glyph: '▲' },
      { x: cx, y: cy + gap, key: 'down', glyph: '▼' },
      { x: cx - gap, y: cy, key: 'left', glyph: '◀' },
      { x: cx + gap, y: cy, key: 'right', glyph: '▶' }
    ];
    this.dpad = this.add.container(0, 0).setDepth(12).setScrollFactor(0);
    directions.forEach(({ x, y, key, glyph }) => {
      const bg = this.add.circle(x, y, size / 2, 0xffffff, 0.09);
      bg.setStrokeStyle(1, 0xd8e0ff, 0.16);
      const text = this.add.text(x, y - 1, glyph, { fontSize: '14px', color: '#cbd2ef' }).setOrigin(0.5);
      const zone = this.add.zone(x, y, size + 7, size + 7).setInteractive();
      zone.on('pointerdown', () => { this.touchDirection = key; });
      this.dpad.add([bg, text, zone]);
    });
    const caption = this.add.text(100, 565, '移動', { fontFamily: 'Noto Sans TC, sans-serif', fontSize: '10px', color: '#7780a4' }).setOrigin(0.5);
    this.dpad.add(caption);
  }

  showQuestion() {
    if (this.mode !== 'playing') return;
    this.busy = false;
    this.blockedOrb = null;
    this.answerGroup.clear(true, true);
    const level = LEVELS[this.levelIndex];
    const { prompt, answer } = this.makeProblem(this.levelIndex);
    this.currentAnswer = answer;
    this.questionText.setText(prompt);
    this.questionText.setColor(level.tint);
    this.levelText.setText(`${level.name}   ·   ${level.topic}   ·   第 ${this.questionIndex + 1} / 3 題`);
    this.hintText.setText(`第 ${this.levelIndex + 1} 關 / 5 關　　碰一碰正確答案`);
    this.progressDots.forEach((dot, i) => {
      dot.setFillStyle(i < this.levelIndex ? 0x9be7c1 : i === this.levelIndex ? level.color : 0x9299b9,
        i === this.levelIndex ? 0.95 : i < this.levelIndex ? 0.72 : 0.26);
      if (i === this.levelIndex) dot.setRadius(7); else dot.setRadius(5);
    });
    this.scoreText.setText(`✦  ${this.score} 分`);
    this.player.setPosition(120, 338);

    const positions = [{ x: 340, y: 338 }, { x: 665, y: 258 }, { x: 835, y: 410 }];
    Phaser.Utils.Array.Shuffle(this.makeChoices(answer)).forEach((value, i) => {
      const orb = this.makeAnswer(positions[i].x, positions[i].y, value, i, level.color);
      this.answerGroup.add(orb);
    });
  }

  makeProblem(levelIndex) {
    const rand = (min, max) => Phaser.Math.Between(min, max);
    if (levelIndex === 0) {
      const a = rand(3, 13), b = rand(2, 19 - a);
      return { prompt: `${a} + ${b} = ?`, answer: a + b };
    }
    if (levelIndex === 1) {
      const a = rand(12, 35), b = rand(2, a - 2);
      return { prompt: `${a} − ${b} = ?`, answer: a - b };
    }
    if (levelIndex === 2) {
      const a = rand(2, 9), b = rand(2, 9);
      return { prompt: `${a} × ${b} = ?`, answer: a * b };
    }
    if (levelIndex === 3) {
      const divisor = rand(2, 9), quotient = rand(2, 10);
      return { prompt: `${divisor * quotient} ÷ ${divisor} = ?`, answer: quotient };
    }
    const type = rand(0, 3);
    if (type === 0) {
      const a = rand(12, 35), b = rand(3, 19);
      return { prompt: `${a} + ${b} = ?`, answer: a + b };
    }
    if (type === 1) {
      const a = rand(21, 60), b = rand(4, a - 2);
      return { prompt: `${a} − ${b} = ?`, answer: a - b };
    }
    if (type === 2) {
      const a = rand(3, 12), b = rand(3, 9);
      return { prompt: `${a} × ${b} = ?`, answer: a * b };
    }
    const divisor = rand(3, 9), quotient = rand(3, 12);
    return { prompt: `${divisor * quotient} ÷ ${divisor} = ?`, answer: quotient };
  }

  makeChoices(answer) {
    const values = new Set([answer]);
    const offsets = [-9, -7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7, 9];
    while (values.size < 3) {
      const offset = Phaser.Utils.Array.GetRandom(offsets);
      const option = answer + offset;
      if (option >= 0) values.add(option);
    }
    return Array.from(values);
  }

  makeAnswer(x, y, value, index, accent) {
    const container = this.add.container(x, y).setDepth(4);
    const shadow = this.add.ellipse(0, 33, 88, 18, 0x080d1d, 0.27);
    const glow = this.add.circle(0, 0, 45, accent, 0.08);
    const orb = this.add.circle(0, 0, 31, [0x243354, 0x293353, 0x263454][index], 1);
    orb.setStrokeStyle(2, accent, 0.72);
    const inner = this.add.circle(0, 0, 25, accent, 0.09);
    const badge = this.add.circle(-18, -20, 8, accent, 0.94);
    const spark = this.add.text(-18, -20, '✦', { fontSize: '8px', color: '#202744' }).setOrigin(0.5);
    const number = this.add.text(0, 1, `${value}`, {
      fontFamily: 'Nunito, Noto Sans TC, sans-serif', fontSize: value > 99 ? '17px' : '22px',
      color: '#fffdf5', fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add([shadow, glow, orb, inner, badge, spark, number]);
    container.setData('value', value);
    container.setData('baseY', y);
    container.setData('phase', index * 1.9);
    this.tweens.add({ targets: glow, alpha: 0.22, scale: 1.17, duration: 1200 + index * 170, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return container;
  }

  makeCharacter(x, y, scale = 1) {
    const container = this.add.container(x, y).setScale(scale);
    const shadow = this.add.ellipse(0, 32, 54, 14, 0x080d1d, 0.34);
    const pack = this.add.roundRectangle?.(0, 5, 30, 33, 13, 0xe99153, 1);
    if (pack) container.add(pack);
    else {
      const packShape = this.add.graphics(); packShape.fillStyle(0xe99153, 1); packShape.fillRoundedRect(-15, -10, 30, 33, 12); container.add(packShape);
    }
    const body = this.add.circle(0, -5, 23, 0xf6a76b, 1);
    body.setStrokeStyle(3, 0xffdca6, 0.95);
    const glass = this.add.ellipse(0, -3, 30, 25, 0xffe5b8, 0.88);
    const eyes = this.add.ellipse(0, -3, 14, 9, 0x313352, 1);
    const shine1 = this.add.circle(-4, -5, 2, 0xffffff, 0.9);
    const antenna = this.add.line(0, 0, 0, -28, 4, -35, 0xffda83, 0.9).setLineWidth(2);
    const antennaStar = this.add.star(4, -37, 4, 2, 5, 0xffd56f, 1);
    const foot1 = this.add.ellipse(-12, 18, 14, 9, 0xe67f52, 1);
    const foot2 = this.add.ellipse(12, 18, 14, 9, 0xe67f52, 1);
    container.add([shadow, antenna, antennaStar, foot1, foot2, body, glass, eyes, shine1]);
    return container;
  }

  makeButton(x, y, label, callback, width = 220, height = 58) {
    const button = this.add.container(x, y).setDepth(25).setSize(width, height).setInteractive({ useHandCursor: true });
    const base = this.add.graphics();
    base.fillStyle(0xd99b4e, 1); base.fillRoundedRect(-width / 2, -height / 2 + 4, width, height, 18);
    base.fillStyle(0xffd87d, 1); base.fillRoundedRect(-width / 2, -height / 2, width, height - 7, 18);
    base.fillStyle(0xffe6a5, 0.5); base.fillRoundedRect(-width / 2 + 3, -height / 2 + 2, width - 6, 12, 9);
    const text = this.add.text(0, -1, label, {
      fontFamily: 'Noto Sans TC, sans-serif', fontSize: '16px', color: '#48351e', fontStyle: 'bold'
    }).setOrigin(0.5);
    button.add([base, text]);
    button.on('pointerover', () => { this.tweens.add({ targets: button, scale: 1.04, duration: 100 }); });
    button.on('pointerout', () => { this.tweens.add({ targets: button, scale: 1, duration: 110 }); });
    button.on('pointerdown', () => { this.tweens.add({ targets: button, y: y + 2, duration: 60, yoyo: true }); callback(); });
    return button;
  }

  update(time, delta) {
    if (this.mode !== 'playing' || !this.player || this.busy) return;
    for (const orb of this.answerGroup.getChildren()) {
      orb.y = orb.getData('baseY') + Math.sin(time / 430 + orb.getData('phase')) * 7;
    }
    const speed = 240 * (delta / 1000);
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k?.left.isDown || k?.a.isDown || this.touchDirection === 'left') dx -= 1;
    if (k?.right.isDown || k?.d.isDown || this.touchDirection === 'right') dx += 1;
    if (k?.up.isDown || k?.w.isDown || this.touchDirection === 'up') dy -= 1;
    if (k?.down.isDown || k?.s.isDown || this.touchDirection === 'down') dy += 1;
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    this.player.x = Phaser.Math.Clamp(this.player.x + dx * speed, 62, 938);
    this.player.y = Phaser.Math.Clamp(this.player.y + dy * speed, 175, 510);
    if (dx !== 0) this.player.setScale(dx < 0 ? -0.85 : 0.85, 0.85);
    if (dx || dy) this.player.y += Math.sin(time / 65) * 0.23;

    for (const orb of this.answerGroup.getChildren()) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, orb.x, orb.y);
      if (orb === this.blockedOrb) {
        if (distance < 76) continue;
        this.blockedOrb = null;
      }
      if (distance < 48) {
        this.collect(orb, time);
        break;
      }
    }
  }

  collect(orb, time) {
    if (this.busy) return;
    const value = orb.getData('value');
    if (value !== this.currentAnswer) {
      this.blockedOrb = orb;
      this.score -= 5;
      this.scoreText.setText(`✦  ${this.score} 分`);
      this.showFeedback('再想一想！　−5 分', COLORS.red, orb.x, orb.y);
      this.tweens.add({ targets: orb, x: orb.x + 8, duration: 45, yoyo: true, repeat: 3 });
      this.cameras.main.shake(120, 0.002);
      return;
    }

    this.busy = true;
    this.score += 10;
    this.scoreText.setText(`✦  ${this.score} 分`);
    this.showFeedback('答對了！　+10 分', COLORS.green, orb.x, orb.y);
    this.tweens.add({
      targets: orb, scale: 1.55, alpha: 0, duration: 230, ease: 'Back.In',
      onComplete: () => orb.destroy()
    });
    this.tweens.add({ targets: this.player, scale: 0.97, duration: 80, yoyo: true, repeat: 1 });
    this.time.delayedCall(760, () => {
      if (this.mode !== 'playing') return;
      this.questionIndex++;
      if (this.questionIndex >= 3) this.completeLevel();
      else this.showQuestion();
    });
  }

  showFeedback(message, color, x, y) {
    const text = this.add.text(x, y - 36, message, {
      fontFamily: 'Noto Sans TC, sans-serif', fontSize: '14px', color,
      fontStyle: 'bold', stroke: '#171d37', strokeThickness: 4
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: text, y: y - 71, alpha: 0, duration: 790, ease: 'Cubic.Out', onComplete: () => text.destroy() });
  }

  completeLevel() {
    this.mode = 'levelComplete';
    this.answerGroup.clear(true, true);
    this.player.setVisible(false);
    this.dpad.setVisible(false);
    this.hintText.setVisible(false);
    const isFinal = this.levelIndex === LEVELS.length - 1;
    const title = isFinal ? '太棒了，冒險完成！' : `${LEVELS[this.levelIndex].name} 通關！`;
    const subtitle = isFinal ? '你成功探索了全部 5 個數學星球。' : `準備好前往「${LEVELS[this.levelIndex + 1].name}」了嗎？`;
    this.showOverlay(title, subtitle, isFinal ? '再玩一次' : '前往下一關', () => {
      if (isFinal) this.showFinalSummary(); else this.nextLevel();
    });
  }

  nextLevel() {
    this.levelIndex++;
    this.questionIndex = 0;
    this.mode = 'playing';
    this.player.setVisible(true);
    this.dpad.setVisible(true);
    this.hintText.setVisible(true);
    this.clearOverlay();
    this.showQuestion();
  }

  showFinalSummary() {
    this.clearOverlay();
    this.mode = 'complete';
    this.showOverlay('你是數學探險王！', `五關全部完成　·　最後得分 ${this.score} 分`, '再玩一次', () => this.startGame());
  }

  showOverlay(title, subtitle, button, action) {
    this.overlay = this.add.container(0, 0).setDepth(40);
    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x0b1023, 0.76);
    const card = this.add.graphics();
    card.fillStyle(0x252e50, 0.98); card.fillRoundedRect(250, 185, 500, 255, 26);
    card.lineStyle(1, 0xe5e9ff, 0.16); card.strokeRoundedRect(250, 185, 500, 255, 26);
    const star = this.add.star(500, 235, 5, 11, 23, 0xffd16d, 1);
    const heading = this.add.text(500, 284, title, {
      fontFamily: 'Noto Sans TC, sans-serif', fontSize: '26px', color: COLORS.ink, fontStyle: 'bold'
    }).setOrigin(0.5);
    const line = this.add.text(500, 328, subtitle, {
      fontFamily: 'Noto Sans TC, sans-serif', fontSize: '14px', color: COLORS.muted
    }).setOrigin(0.5);
    this.overlay.add([shade, card, star, heading, line]);
    const cta = this.makeButton(500, 385, button, action, 200, 48);
    this.overlay.add(cta);
    this.tweens.add({ targets: star, angle: 28, duration: 3500, repeat: -1, ease: 'Sine.InOut' });
  }

  clearOverlay() {
    if (this.overlay) { this.overlay.destroy(true); this.overlay = null; }
  }

  clearUi() {
    this.clearOverlay();
    this.answerGroup?.clear(false, false);
    this.children.list.slice().forEach((child) => {
      if (!this.backdropChildren.has(child)) child.destroy(true);
    });
    this.hud = null;
    this.dpad = null;
    this.answerGroup = null;
    this.player = null;
    this.questionText = null;
    this.levelText = null;
    this.scoreText = null;
    this.progressDots = [];
    this.hintText = null;
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#171d37',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [AdventureScene]
};

new Phaser.Game(config);
