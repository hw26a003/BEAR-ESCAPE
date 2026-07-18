// --- 2D Bear Horror Escape Game Engine ---
// Designed for modularity, token limit safety, and flawless 60fps execution.

export interface Obstacle {
  x: number;
  y: number;
  r: number;
  type: 'tree' | 'rock';
}

export interface Item {
  id: string;
  x: number;
  y: number;
  type: 'map' | 'bell' | 'spray';
  collected: boolean;
}

export interface Survivor {
  id: number;
  name: string;
  x: number;
  y: number;
  saved: boolean;
  hint: string;
}

export interface Bear {
  id: number;
  x: number;
  y: number;
  state: 'wander' | 'chase';
  wanderDirX: number;
  wanderDirY: number;
  wanderTimer: number;
  speed: number;
}

export interface EngineCallbacks {
  onStaminaChange: (val: number) => void;
  onStaminaExhausted: (exhausted: boolean) => void;
  onRunningChange: (running: boolean) => void;
  onBatteryChange: (minutes: number) => void;
  onBearDistanceChange: (distance: number) => void;
  onBearOnScreenChange: (onScreen: boolean) => void;
  onItemsChange: (items: { map: boolean; bell: number; spray: number }) => void;
  onSurvivorsChange: (survivors: boolean[]) => void;
  onEncounter: () => void;
  onEscape: () => void;
  onPopupMessage: (msg: string | null) => void;
  onDialogMessage: (survivor: string | null, text: string | null, index: number | null) => void;
}

export class GameEngine {
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  // プレイヤー状態
  public playerX = 4800;
  public playerY = 2720;
  public playerDirX = 0;
  public playerDirY = 1;
  public stamina = 100;
  public isStaminaExhausted = false;
  public isRunning = false;
  public playerVx = 0;
  public playerVy = 0;
  public batterySeconds = 600; // 10分
  public flashlightOn = true;

  // ゲーム世界オブジェクト
  public obstacles: Obstacle[] = [];
  public items: Item[] = [];
  public survivors: Survivor[] = [];
  public exitX = 0;
  public exitY = 0;

  // クマ
  public bears: Bear[] = [];
  public bearX = 0;
  public bearY = 0;
  public bearState: 'wander' | 'chase' = 'wander';
  public bearWanderDirX = 1;
  public bearWanderDirY = 0;
  public bearWanderTimer = 0;
  public bearSpeed = 2.8;

  // 鈴の効果タイマー (15秒 = 900フレーム)
  public bellActiveTimer = 0;

  // 収集状態
  public hasMap = false;
  public bellCount = 0;
  public sprayCount = 0;
  public savedList = [false, false, false, false, false];

  // カメラ・レンダリング
  public cameraX = 4320;
  public cameraY = 2448;
  public flickerState = true;

  // 内部状態
  private isInitialized = false;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D rendering context');
    this.ctx = context;
    this.callbacks = callbacks;

    // オフスクリーンCanvasの初期化 (480x272解像度に一度縮小して、ニアレストネイバーで2倍拡大し完璧なドット絵にする)
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 480;
    this.offscreenCanvas.height = 272;
    const oCtx = this.offscreenCanvas.getContext('2d');
    if (oCtx) {
      this.offscreenCtx = oCtx;
    }
  }

  // 10分(600秒)のバッテリー寿命に比例した懐中電灯照射半径
  public getLightRadius(): number {
    if (!this.flashlightOn) return 15; // 完全消灯時
    
    const pct = this.batterySeconds / 600;
    // 10分で 250px から 30px まで徐々に減少、最後は極小
    const baseRadius = 30 + pct * 220; 
    
    if (this.batterySeconds <= 0) return 15;
    return baseRadius;
  }

  // ゲーム世界・マップの自動生成 (パズルのような複合ブロック自動配置と配置制限の完全遵守)
  public initWorld() {
    this.playerX = 4800;
    this.playerY = 2720;
    this.batterySeconds = 600;
    this.stamina = 100;
    this.isStaminaExhausted = false;
    this.isRunning = false;
    this.flashlightOn = true;
    this.bellActiveTimer = 0;
    
    this.hasMap = false;
    this.bellCount = 0;
    this.sprayCount = 0;
    this.savedList = [false, false, false, false, false];

    // 1. 障害物 (木, 岩) の自動生成
    // 512x512のグリッド: 幅9600 / 512 = 18.75 (19個), 高さ5440 / 512 = 10.6 (11個)
    this.obstacles = [];
    const blockCols = 19;
    const blockRows = 11;

    for (let c = 0; c < blockCols; c++) {
      for (let r = 0; r < blockRows; r++) {
        const bx = c * 512;
        const by = r * 512;

        // プレイヤー初期位置周辺 (4800, 2720) から 350px 以内には障害物を置かない (スタック防止)
        const distToPlayerBlock = Math.sqrt((bx + 256 - 4800) ** 2 + (by + 256 - 2720) ** 2);
        if (distToPlayerBlock < 350) continue;

        // 大ブロックごとに2〜4個の障害物をランダムにパズルのように配置
        const numObs = 2 + Math.floor(Math.random() * 3); // 2, 3, 4
        for (let i = 0; i < numObs; i++) {
          const rx = bx + 64 + Math.random() * 384;
          const ry = by + 64 + Math.random() * 384;
          const type = Math.random() > 0.45 ? 'tree' : 'rock';
          const radius = type === 'tree' ? 24 + Math.random() * 8 : 28 + Math.random() * 6;

          this.obstacles.push({ x: rx, y: ry, r: radius, type });
        }
      }
    }

    // 配置検証ヘルパー: 重重複の徹底防止、距離制限の完全厳守
    const checkPositionSafe = (x: number, y: number, r: number, minPlayerDist: number, maxPlayerDist: number, checkOtherEntities: boolean): boolean => {
      // マップ境界チェック
      if (x < 150 || x > 9450 || y < 150 || y > 5290) return false;

      // 障害物との重なり防止
      for (const obs of this.obstacles) {
        const dx = x - obs.x;
        const dy = y - obs.y;
        if (Math.sqrt(dx * dx + dy * dy) < r + obs.r + 20) return false;
      }

      // プレイヤーからの距離制限
      const dxp = x - 4800;
      const dyp = y - 2720;
      const distP = Math.sqrt(dxp * dxp + dyp * dyp);
      if (distP < minPlayerDist || distP > maxPlayerDist) return false;

      // 他のエンティティと 200px 以上離して配置する
      if (checkOtherEntities) {
        // すでに配置されたアイテム
        for (const item of this.items) {
          const dx = x - item.x;
          const dy = y - item.y;
          if (Math.sqrt(dx * dx + dy * dy) < 200) return false;
        }
        // すでに配置された生存者
        for (const surv of this.survivors) {
          const dx = x - surv.x;
          const dy = y - surv.y;
          if (Math.sqrt(dx * dx + dy * dy) < 200) return false;
        }
        // 脱出口
        if (this.exitX !== 0) {
          const dx = x - this.exitX;
          const dy = y - this.exitY;
          if (Math.sqrt(dx * dx + dy * dy) < 200) return false;
        }
      }

      return true;
    };

    // 2. 生存者 5人の配置 (お互い及び障害物から200px以上離す)
    this.survivors = [];
    const survivorNames = ["佐藤 (Sato)", "鈴木 (Suzuki)", "高橋 (Takahashi)", "田中 (Tanaka)", "伊藤 (Ito)"];
    const survivorHints = [
      "「遠くにいる時は静かにその場を去る方がいい」",
      "「近くにいる時は熊を見ながらゆっくり後退して！興奮させないのが一番だよ」",
      "「鈴はクマが寄ってこなくなるがすぐに錆びてしまうため、長くは使えない。」",
      "「脱出口は山のはるか彼方にある。地図があればその正確な位置がわかるはずだ。」",
      "「走る（Shift長押し）と早く動けるが、スタミナが切れると動けなくなるので注意して！」"
    ];

    // 各生存者の目安パーセンテージ位置から微調整
    const survivorBaseCoords = [
      { x: 22, y: 35 },
      { x: 65, y: 20 },
      { x: 38, y: 78 },
      { x: 78, y: 65 },
      { x: 18, y: 72 }
    ];

    survivorBaseCoords.forEach((coords, idx) => {
      let sx = (coords.x / 100) * 9600;
      let sy = (coords.y / 100) * 5440;

      let found = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const testX = sx + (attempt === 0 ? 0 : (Math.random() - 0.5) * 400);
        const testY = sy + (attempt === 0 ? 0 : (Math.random() - 0.5) * 400);

        if (checkPositionSafe(testX, testY, 20, 1000, 99999, true)) {
          sx = testX;
          sy = testY;
          found = true;
          break;
        }
      }

      this.survivors.push({
        id: idx,
        name: survivorNames[idx],
        x: sx,
        y: sy,
        saved: false,
        hint: survivorHints[idx],
      });
    });

    // 3. アイテム (地図 1個、鈴 3個、スプレー 3個) の配置 (200px以上の相互距離、12〜25画面分の初期プレイヤー距離制限)
    // 1画面分の長さを約300px換算、最小3600px、最大7500px離す
    this.items = [];

    // 地図 (1個)
    let mapX = 0, mapY = 0;
    for (let i = 0; i < 500; i++) {
      const rx = 500 + Math.random() * 8600;
      const ry = 500 + Math.random() * 4440;
      if (checkPositionSafe(rx, ry, 15, 3600, 7500, true)) {
        mapX = rx;
        mapY = ry;
        break;
      }
    }
    if (mapX === 0) { mapX = 2200; mapY = 1800; } // フェールセーフ
    this.items.push({ id: 'map', x: mapX, y: mapY, type: 'map', collected: false });

    // 鈴 (3個)
    for (let k = 0; k < 3; k++) {
      let bx = 0, by = 0;
      for (let i = 0; i < 500; i++) {
        const rx = 500 + Math.random() * 8600;
        const ry = 500 + Math.random() * 4440;
        if (checkPositionSafe(rx, ry, 15, 1000, 99999, true)) {
          bx = rx;
          by = ry;
          break;
        }
      }
      if (bx !== 0) {
        this.items.push({ id: `bell_${k}`, x: bx, y: by, type: 'bell', collected: false });
      }
    }

    // スプレー (3個)
    for (let k = 0; k < 3; k++) {
      let sx = 0, sy = 0;
      for (let i = 0; i < 500; i++) {
        const rx = 500 + Math.random() * 8600;
        const ry = 500 + Math.random() * 4440;
        if (checkPositionSafe(rx, ry, 15, 1000, 99999, true)) {
          sx = rx;
          sy = ry;
          break;
        }
      }
      if (sx !== 0) {
        this.items.push({ id: `spray_${k}`, x: sx, y: sy, type: 'spray', collected: false });
      }
    }

    // 4. 脱出口 (EXIT): プレイヤーから最小3600px〜最大7500px離す
    let ex = 0, ey = 0;
    for (let i = 0; i < 500; i++) {
      const rx = 200 + Math.random() * 9200;
      const ry = 200 + Math.random() * 5040;
      if (checkPositionSafe(rx, ry, 30, 3600, 7500, true)) {
        ex = rx;
        ey = ry;
        break;
      }
    }
    if (ex === 0) { ex = 8400; ey = 4200; }
    this.exitX = ex;
    this.exitY = ey;

    // 5. クマ (5体): プレイヤーから最小3600px〜最大7500px離す
    this.bears = [];
    for (let k = 0; k < 5; k++) {
      let bx = 0, by = 0;
      for (let i = 0; i < 500; i++) {
        const rx = 500 + Math.random() * 8600;
        const ry = 500 + Math.random() * 4440;
        if (checkPositionSafe(rx, ry, 25, 3600, 7500, true)) {
          let tooClose = false;
          for (const b of this.bears) {
            if (Math.sqrt((rx - b.x) ** 2 + (ry - b.y) ** 2) < 400) {
              tooClose = true;
              break;
            }
          }
          if (!tooClose) {
            bx = rx;
            by = ry;
            break;
          }
        }
      }
      if (bx === 0) {
        bx = 1200 + k * 1600;
        by = 3800 - (k % 3) * 1000;
      }
      this.bears.push({
        id: k,
        x: bx,
        y: by,
        state: 'wander',
        wanderDirX: 1,
        wanderDirY: 0,
        wanderTimer: 0,
        speed: 1.8 + Math.random() * 0.4 // 移動速度を少し落とす (1.8〜2.2)
      });
    }
    // 後方互換・代表同期
    this.bearX = this.bears[0].x;
    this.bearY = this.bears[0].y;
    this.bearState = this.bears[0].state;

    this.isInitialized = true;

    // React通知
    this.syncAllStatesToReact();
    this.callbacks.onPopupMessage("探索を開始した。地図を探し、遭難者を救助せよ。");
  }

  // スプレーによるワープ (画面7枚分 ≒ 2100px 離れた位置にリスポーン)
  public respawnBearAway() {
    // プレイヤーに最も近いクマを特定してそれを遠くに飛ばす
    let closestBear = this.bears[0];
    let minDist = 99999;
    for (const b of this.bears) {
      const d = Math.sqrt((b.x - this.playerX) ** 2 + (b.y - this.playerY) ** 2);
      if (d < minDist) {
        minDist = d;
        closestBear = b;
      }
    }

    let found = false;
    for (let i = 0; i < 500; i++) {
      // プレイヤーから約2100px〜3000pxの距離
      const angle = Math.random() * Math.PI * 2;
      const dist = 2100 + Math.random() * 900;
      const tx = this.playerX + Math.cos(angle) * dist;
      const ty = this.playerY + Math.sin(angle) * dist;

      // 境界チェック & 障害物チェック
      if (tx > 100 && tx < 9500 && ty > 100 && ty < 5340) {
        let overlap = false;
        for (const obs of this.obstacles) {
          if (Math.sqrt((tx - obs.x) ** 2 + (ty - obs.y) ** 2) < obs.r + 40) {
            overlap = true;
            break;
          }
        }
        if (!overlap) {
          closestBear.x = tx;
          closestBear.y = ty;
          closestBear.state = 'wander';
          closestBear.wanderTimer = 180; // 3秒間立ち止まる
          found = true;
          break;
        }
      }
    }
    if (!found) {
      closestBear.x = (this.playerX + 2100) % 9600;
      closestBear.y = (this.playerY + 2100) % 5440;
      closestBear.state = 'wander';
      closestBear.wanderTimer = 180;
    }

    this.bellActiveTimer = 0; // 鈴無効化をリセット
    this.syncAllStatesToReact();
  }

  // 鈴の使用 (すべてのクマをプレイヤーから画面7枚分 ≒ 2100px 以上離す)
  public useBell() {
    if (this.bellCount <= 0 || this.bellActiveTimer > 0) return;
    this.bellCount -= 1;
    this.bellActiveTimer = 600; // 10秒 (600フレーム@60fps)

    // すべてのクマをプレイヤーから画面7枚分以上(最低2100px)離す
    for (const b of this.bears) {
      let found = false;
      for (let i = 0; i < 500; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 2100 + Math.random() * 2000; // 2100px〜4100px離す
        const tx = this.playerX + Math.cos(angle) * dist;
        const ty = this.playerY + Math.sin(angle) * dist;

        if (tx > 150 && tx < 9450 && ty > 150 && ty < 5290) {
          let overlap = false;
          for (const obs of this.obstacles) {
            if (Math.sqrt((tx - obs.x) ** 2 + (ty - obs.y) ** 2) < obs.r + 40) {
              overlap = true;
              break;
            }
          }
          if (!overlap) {
            b.x = tx;
            b.y = ty;
            b.state = 'wander';
            b.wanderTimer = 120; // 2秒間立ち止まる
            found = true;
            break;
          }
        }
      }
      if (!found) {
        b.x = (this.playerX + 2500) % 9600;
        b.y = (this.playerY + 2500) % 5440;
        b.state = 'wander';
        b.wanderTimer = 120;
      }
    }

    this.callbacks.onItemsChange({ map: this.hasMap, bell: this.bellCount, spray: this.sprayCount });
    this.callbacks.onPopupMessage("🔔 鈴を鳴らした！10秒間、クマがあなたを見失う。すべてのクマが遠くに逃げ去った！");
  }

  // 1フレーム更新
  public update(dt: number, keys: Record<string, boolean>) {
    if (!this.isInitialized) return;

    // 1. バッテリー消費
    if (this.flashlightOn) {
      this.batterySeconds = Math.max(0, this.batterySeconds - dt / 1000);
    }

    // 2. 鈴タイマー
    if (this.bellActiveTimer > 0) {
      this.bellActiveTimer -= 1;
    }

    // 3. プレイヤー移動入力・計算
    let dx = 0;
    let dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    const isMoving = dx !== 0 || dy !== 0;
    this.playerVx = dx;
    this.playerVy = dy;

    // 移動方向のインジケータ更新
    if (isMoving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      this.playerDirX = dx / len;
      this.playerDirY = dy / len;
    }

    // スタミナゲージのリアルタイム増減
    const shiftPressed = keys['shift'];
    if (shiftPressed && isMoving && !this.isStaminaExhausted) {
      this.isRunning = true;
      this.stamina = Math.max(0, this.stamina - (100 / (5 * 60))); // 5秒で100%消費
      if (this.stamina <= 0) {
        this.isRunning = false;
        this.isStaminaExhausted = true;
        this.callbacks.onStaminaExhausted(true);
      }
    } else {
      this.isRunning = false;
      this.stamina = Math.min(100, this.stamina + (100 / (3 * 60))); // 3秒で100%回復
      if (this.stamina >= 100 && this.isStaminaExhausted) {
        this.isStaminaExhausted = false;
        this.callbacks.onStaminaExhausted(false);
      } else if (this.stamina >= 30 && this.isStaminaExhausted) {
        // ペナルティ解除閾値: 30%
        this.isStaminaExhausted = false;
        this.callbacks.onStaminaExhausted(false);
      }
    }

    this.callbacks.onStaminaChange(this.stamina);
    this.callbacks.onRunningChange(this.isRunning);

    // プレイヤー移動速度
    const speed = this.isRunning && isMoving ? 4.5 : 2.8; // 速度を少し落とす (ダッシュ4.5, 通常2.8)
    let nextPlayerX = this.playerX;
    let nextPlayerY = this.playerY;

    if (isMoving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      nextPlayerX += (dx / len) * speed;
      nextPlayerY += (dy / len) * speed;
    }

    // 衝突判定（プレイヤー）: 木や岩を絶対にすり抜けさせない
    for (const obs of this.obstacles) {
      const odx = nextPlayerX - obs.x;
      const ody = nextPlayerY - obs.y;
      const dist = Math.sqrt(odx * odx + ody * ody);
      const minDist = 18 + obs.r; // プレイヤー半径18 (表示拡大に合わせて調整)
      if (dist < minDist) {
        const overlap = minDist - dist;
        nextPlayerX += (odx / dist) * overlap;
        nextPlayerY += (ody / dist) * overlap;
      }
    }

    // 壁・マップクランプ
    this.playerX = Math.max(15, Math.min(9585, nextPlayerX));
    this.playerY = Math.max(15, Math.min(5425, nextPlayerY));

    // 4. クマの移動AI (3体それぞれ独立して更新)
    const isBellActive = this.bellActiveTimer > 0;
    let closestDist = 99999;
    let anyBearInCam = false;

    for (const bear of this.bears) {
      let bdx = this.playerX - bear.x;
      let bdy = this.playerY - bear.y;
      let distToPlayer = Math.sqrt(bdx * bdx + bdy * bdy);

      // クマが追尾する条件: 鈴が有効でなく、かつプレイヤーが視界内（600px以内）にいる時
      if (isBellActive || distToPlayer > 600) {
        // 徘徊状態 (Wander)
        bear.state = 'wander';
        bear.wanderTimer -= 1;
        if (bear.wanderTimer <= 0) {
          const angle = Math.random() * Math.PI * 2;
          bear.wanderDirX = Math.cos(angle);
          bear.wanderDirY = Math.sin(angle);
          bear.wanderTimer = 90 + Math.floor(Math.random() * 120); // 1.5〜3.5秒
        }

        let nextBearX = bear.x + bear.wanderDirX * 1.0; // 徘徊速度を少し落とす
        let nextBearY = bear.y + bear.wanderDirY * 1.0;

        // コリジョン判定（クマ徘徊）
        let coll = false;
        for (const obs of this.obstacles) {
          const odx = nextBearX - obs.x;
          const ody = nextBearY - obs.y;
          const dist = Math.sqrt(odx * odx + ody * ody);
          const minDist = 25 + obs.r; // クマ半径25 (表示拡大に合わせて調整)
          if (dist < minDist) {
            const overlap = minDist - dist;
            nextBearX += (odx / dist) * overlap;
            nextBearY += (ody / dist) * overlap;
            coll = true;
          }
        }
        if (nextBearX < 20 || nextBearX > 9580 || nextBearY < 20 || nextBearY > 5420) {
          coll = true;
        }
        if (coll) {
          bear.wanderTimer = 0; // すぐに逆方向転換
        }

        bear.x = Math.max(20, Math.min(9580, nextBearX));
        bear.y = Math.max(20, Math.min(5420, nextBearY));
      } else {
        // 追跡状態 (Chase) - 障害物迂回ステアリング
        bear.state = 'chase';
        let bvx = bdx / distToPlayer;
        let bvy = bdy / distToPlayer;

        // 120px先の障害物を予測検知
        let mostThreatening: Obstacle | null = null;
        let minObsDist = 99999;

        for (const obs of this.obstacles) {
          const odx = obs.x - bear.x;
          const ody = obs.y - bear.y;
          const obsDist = Math.sqrt(odx * odx + ody * ody);
          if (obsDist < 150) {
            const dot = odx * bvx + ody * bvy;
            if (dot > 0) { // クマの進行方向前方にある
              const projX = bear.x + bvx * dot;
              const projY = bear.y + bvy * dot;
              const lateralDist = Math.sqrt((projX - obs.x) ** 2 + (projY - obs.y) ** 2);
              if (lateralDist < obs.r + 30) {
                if (obsDist < minObsDist) {
                  minObsDist = obsDist;
                  mostThreatening = obs;
                }
              }
            }
          }
        }

        // 回避力をステアリングに加算
        if (mostThreatening) {
          const avoidDx = bear.x - mostThreatening.x;
          const avoidDy = bear.y - mostThreatening.y;
          const avoidLen = Math.sqrt(avoidDx * avoidDx + avoidDy * avoidDy);

          // 進行ベクトルと回避ベクトルをブレンド (40% vs 60%)
          bvx = bvx * 0.4 + (avoidDx / avoidLen) * 0.6;
          bvy = bvy * 0.4 + (avoidDy / avoidLen) * 0.6;

          const totalLen = Math.sqrt(bvx * bvx + bvy * bvy);
          bvx /= totalLen;
          bvy /= totalLen;
        }

        let nextBearX = bear.x + bvx * bear.speed;
        let nextBearY = bear.y + bvy * bear.speed;

        // 直接衝突押し戻し（すり抜け防御）
        for (const obs of this.obstacles) {
          const odx = nextBearX - obs.x;
          const ody = nextBearY - obs.y;
          const dist = Math.sqrt(odx * odx + ody * ody);
          const minDist = 25 + obs.r; // クマ半径25
          if (dist < minDist) {
            const overlap = minDist - dist;
            nextBearX += (odx / dist) * overlap;
            nextBearY += (ody / dist) * overlap;
          }
        }

        bear.x = Math.max(20, Math.min(9580, nextBearX));
        bear.y = Math.max(20, Math.min(5420, nextBearY));
      }

      const d = Math.sqrt((this.playerX - bear.x) ** 2 + (this.playerY - bear.y) ** 2);
      if (d < closestDist) {
        closestDist = d;
      }

      // クマが画面内(960x544)にいるか判定 (カメラ座標基準)
      const inCamX = bear.x >= this.cameraX && bear.x <= this.cameraX + 960;
      const inCamY = bear.y >= this.cameraY && bear.y <= this.cameraY + 544;
      if (inCamX && inCamY && !isBellActive) {
        anyBearInCam = true;
      }
    }

    // 代表同期 (最も近いクマをベースにする。戦闘等への影響を無くすため)
    let representativeBear = this.bears[0];
    let minD = 99999;
    for (const b of this.bears) {
      const d = Math.sqrt((b.x - this.playerX) ** 2 + (b.y - this.playerY) ** 2);
      if (d < minD) {
        minD = d;
        representativeBear = b;
      }
    }
    this.bearX = representativeBear.x;
    this.bearY = representativeBear.y;
    this.bearState = representativeBear.state;

    // 5. プレイヤーとクマの接触判定 (戦闘移行)
    if (closestDist <= 42) {
      this.callbacks.onEncounter();
      return;
    }

    // 6. アイテム回収判定 (接触での自動回収は行わない。近くにいる場合に右クリックで回収)
    // 7. 生存者救出判定 (接触での自動救出は行わない。近くにいる場合に右クリックで会話・救助)

    // 8. 脱出口クリア判定
    if (this.hasMap) {
      const edist = Math.sqrt((this.playerX - this.exitX) ** 2 + (this.playerY - this.exitY) ** 2);
      if (edist < 40) {
        this.callbacks.onEscape();
        return;
      }
    }

    // 9. カメラ更新 (スクロールクランプ)
    this.cameraX = this.playerX - 960 / 2;
    this.cameraY = this.playerY - 544 / 2;
    this.cameraX = Math.max(0, Math.min(9600 - 960, this.cameraX));
    this.cameraY = Math.max(0, Math.min(5440 - 544, this.cameraY));

    // 10. React通知 (距離・接近・バッテリー)
    this.callbacks.onBearDistanceChange(Math.round(closestDist));
    this.callbacks.onBearOnScreenChange(anyBearInCam);
    this.callbacks.onBatteryChange(Math.ceil(this.batterySeconds / 60));
  }

  // React State への同期
  public syncAllStatesToReact() {
    this.callbacks.onStaminaChange(this.stamina);
    this.callbacks.onStaminaExhausted(this.isStaminaExhausted);
    this.callbacks.onRunningChange(this.isRunning);
    this.callbacks.onBatteryChange(Math.ceil(this.batterySeconds / 60));
    
    let closestDist = 99999;
    let anyBearInCam = false;
    for (const bear of this.bears) {
      const d = Math.sqrt((bear.x - this.playerX) ** 2 + (bear.y - this.playerY) ** 2);
      if (d < closestDist) {
        closestDist = d;
      }
      const inCamX = bear.x >= this.cameraX && bear.x <= this.cameraX + 960;
      const inCamY = bear.y >= this.cameraY && bear.y <= this.cameraY + 544;
      if (inCamX && inCamY && this.bellActiveTimer <= 0) {
        anyBearInCam = true;
      }
    }
    
    this.callbacks.onBearDistanceChange(Math.round(closestDist));
    this.callbacks.onBearOnScreenChange(anyBearInCam);

    this.callbacks.onItemsChange({ map: this.hasMap, bell: this.bellCount, spray: this.sprayCount });
    this.callbacks.onSurvivorsChange([...this.savedList]);
  }

  // マウスクリック（右クリック等）によるインタラクション処理
  public interactAt(canvasX: number, canvasY: number): boolean {
    const worldX = this.cameraX + canvasX;
    const worldY = this.cameraY + canvasY;

    // 1. 生存者救出チェック
    for (let idx = 0; idx < this.survivors.length; idx++) {
      const surv = this.survivors[idx];
      if (!surv.saved) {
        const clickDist = Math.sqrt((worldX - surv.x) ** 2 + (worldY - surv.y) ** 2);
        const playerDist = Math.sqrt((this.playerX - surv.x) ** 2 + (this.playerY - surv.y) ** 2);

        // クリック位置が生存者の近く（半径40px以内）かつプレイヤーが生存者に近い（120px以内）
        if (clickDist < 40 && playerDist < 120) {
          surv.saved = true;
          this.savedList[idx] = true;
          this.callbacks.onSurvivorsChange([...this.savedList]);
          this.callbacks.onDialogMessage(surv.name, surv.hint, idx);
          this.syncAllStatesToReact();
          return true;
        }
      }
    }

    // 2. アイテム回収チェック
    for (const item of this.items) {
      if (!item.collected) {
        const clickDist = Math.sqrt((worldX - item.x) ** 2 + (worldY - item.y) ** 2);
        const playerDist = Math.sqrt((this.playerX - item.x) ** 2 + (this.playerY - item.y) ** 2);

        // クリック位置がアイテムの近く（半径35px以内）かつプレイヤーがアイテムに近い（120px以内）
        if (clickDist < 35 && playerDist < 120) {
          item.collected = true;
          if (item.type === 'map') {
            this.hasMap = true;
            this.callbacks.onPopupMessage("🗺️ 地図を獲得した！[R]キーで全体マップを開く。");
          } else if (item.type === 'bell') {
            this.bellCount += 2;
            this.callbacks.onPopupMessage("🔔 古びた鈴を獲得した！[Q]キーで鳴らすと10秒間クマを欺ける。");
          } else if (item.type === 'spray') {
            this.sprayCount += 1;
            this.callbacks.onPopupMessage("💨 熊撃退スプレーを獲得した！戦闘時のみ使用可能。");
          }
          this.callbacks.onItemsChange({ map: this.hasMap, bell: this.bellCount, spray: this.sprayCount });
          this.syncAllStatesToReact();
          return true;
        }
      }
    }

    return false;
  }

  // 描画処理 (懐中電灯マスクを含む完全な2D描画)
  public draw(flickerState: boolean) {
    const ctx = this.ctx;
    const camX = this.cameraX;
    const camY = this.cameraY;
    const textDrawQueue: any[] = [];

    // キャンバスクリア
    ctx.fillStyle = '#050c05'; // 深い山の闇緑
    ctx.fillRect(0, 0, 960, 544);

    // 背景グリッド(512pxの大ブロック)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 1;
    for (let x = -camX % 512; x < 960; x += 512) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 544);
      ctx.stroke();
    }
    for (let y = -camY % 512; y < 544; y += 512) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // 1. 障害物の描画
    this.obstacles.forEach(obs => {
      const rx = obs.x - camX;
      const ry = obs.y - camY;
      if (rx > -obs.r && rx < 960 + obs.r && ry > -obs.r && ry < 544 + obs.r) {
        if (obs.type === 'tree') {
          // 幹
          ctx.fillStyle = '#2d1808';
          ctx.beginPath();
          ctx.arc(rx, ry, 6, 0, Math.PI * 2);
          ctx.fill();

          // 葉 (3層の立体感)
          ctx.fillStyle = '#062606';
          ctx.beginPath();
          ctx.arc(rx, ry, obs.r, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#0b350b';
          ctx.beginPath();
          ctx.arc(rx, ry - 4, obs.r * 0.75, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#114a11';
          ctx.beginPath();
          ctx.arc(rx, ry - 8, obs.r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 岩
          ctx.fillStyle = '#2f2f2f';
          ctx.beginPath();
          ctx.arc(rx, ry, obs.r, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#444444';
          ctx.beginPath();
          ctx.arc(rx - obs.r * 0.2, ry - obs.r * 0.2, obs.r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // 2. アイテムの描画
    this.items.forEach(item => {
      if (!item.collected) {
        const rx = item.x - camX;
        const ry = item.y - camY;
        if (rx > -30 && rx < 990 && ry > -30 && ry < 574) {
          ctx.save();
          const bob = Math.sin(performance.now() / 180) * 3;

          if (item.type === 'map') {
            // アンティークな「革張りのフィールドガイド（地図帳）」の精巧な描画
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#eab308';

            const bx = rx;
            const by = ry + bob;

            // 1. 本体の革張り表紙（ベース、斜めに置かれた雰囲気）
            ctx.fillStyle = '#451a03'; // ダークブラウン
            ctx.strokeStyle = '#1c1917';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(bx - 12, by - 8, 24, 16, 2);
            ctx.fill();
            ctx.stroke();

            // 2. 本の厚み・ページ部分（右下・下部のベージュ色）
            ctx.fillStyle = '#f5f5f4'; // ページ紙
            ctx.fillRect(bx - 11, by + 6, 22, 2);

            // 3. 深緑と真鍮の高級な装飾フレーム
            ctx.fillStyle = '#14532d'; // 深緑
            ctx.beginPath();
            ctx.roundRect(bx - 10, by - 6, 20, 11, 1);
            ctx.fill();

            ctx.strokeStyle = '#ca8a04'; // ゴールド装飾線
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // 4. 地図面（古紙風のベージュ・薄黄色）
            ctx.fillStyle = '#fef3c7'; // 古紙ベージュ
            ctx.fillRect(bx - 8, by - 4, 13, 7);

            // 地図の模様（川、森を模した青と緑のドット）
            ctx.fillStyle = '#3b82f6'; // 川
            ctx.fillRect(bx - 6, by - 2, 4, 1);
            ctx.fillRect(bx - 3, by - 1, 3, 1);
            ctx.fillStyle = '#22c55e'; // 森林
            ctx.fillRect(bx + 1, by - 3, 2, 2);

            // 5. 右上の丸型羅針盤（コンパス）
            ctx.fillStyle = '#d97706'; // 真鍮ゴールド
            ctx.beginPath();
            ctx.arc(bx + 7, by - 3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // 羅針盤の指針（黒い極小十字）
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(bx + 7, by - 4.5);
            ctx.lineTo(bx + 7, by - 1.5);
            ctx.moveTo(bx + 5.5, by - 3);
            ctx.lineTo(bx + 8.5, by - 3);
            ctx.stroke();

            // 6. 左下のインク瓶と斜めに挿された金色の羽根ペン
            // インク瓶（黒・ガラス）
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#ca8a04';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.roundRect(bx - 15, by + 3, 4, 4, 1);
            ctx.fill();
            ctx.stroke();

            // 金色の羽根ペン（斜めに伸びる羽のドット）
            ctx.strokeStyle = '#fbbf24'; // 羽のイエロー
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(bx - 13, by + 4);
            ctx.lineTo(bx - 18, by - 2); // 斜め上へ
            ctx.stroke();

            ctx.fillStyle = '#f59e0b'; // 羽の飾り部分
            ctx.beginPath();
            ctx.moveTo(bx - 18, by - 2);
            ctx.lineTo(bx - 20, by - 4);
            ctx.lineTo(bx - 17, by - 3);
            ctx.closePath();
            ctx.fill();
          } else if (item.type === 'bell') {
            // アンティークな「結び紐付きの真鍮製・鐘型鈴」の精巧な描画
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#fbbf24';

            // 1. 上部：ロープ（結び紐・ベージュとブラウン）
            ctx.strokeStyle = '#d97706'; // ロープブラウン
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(rx, ry - 18 + bob);
            ctx.lineTo(rx, ry - 7 + bob);
            ctx.stroke();

            // ロープの結び目（ノット）
            ctx.fillStyle = '#b45309';
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.ellipse(rx, ry - 12 + bob, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 2. 吊り下げ真鍮製リング
            ctx.strokeStyle = '#ca8a04';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(rx, ry - 6 + bob, 3, 0, Math.PI * 2);
            ctx.stroke();

            // 3. 舌（振り子・クラッパー）※先に下に描画
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(rx, ry + 8 + bob);
            ctx.lineTo(rx, ry + 13 + bob);
            ctx.stroke();

            ctx.fillStyle = '#2e1065'; // 暗い鉄色
            ctx.beginPath();
            ctx.arc(rx, ry + 13 + bob, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // 4. 鈴本体（鐘型）
            ctx.beginPath();
            ctx.moveTo(rx - 4, ry - 3 + bob);
            // 左側の滑らかなふくらみ
            ctx.bezierCurveTo(rx - 5, ry - 3 + bob, rx - 7, ry + 3 + bob, rx - 9, ry + 6 + bob);
            // 左下の角（朝顔状の広がり）
            ctx.quadraticCurveTo(rx - 9.5, ry + 8 + bob, rx - 8, ry + 8 + bob);
            // 下部の広がり
            ctx.lineTo(rx + 8, ry + 8 + bob);
            // 右下の角
            ctx.quadraticCurveTo(rx + 9.5, ry + 8 + bob, rx + 9, ry + 6 + bob);
            // 右側の戻り
            ctx.bezierCurveTo(rx + 7, ry + 3 + bob, rx + 5, ry - 3 + bob, rx + 4, ry - 3 + bob);
            ctx.closePath();

            // 真鍮・金色の金属グラデーション
            const bellGrad = ctx.createLinearGradient(rx - 9, 0, rx + 9, 0);
            bellGrad.addColorStop(0, '#78350f');   // 暗部
            bellGrad.addColorStop(0.25, '#d97706'); // ブロンズ
            bellGrad.addColorStop(0.5, '#fef08a');  // ハイライト
            bellGrad.addColorStop(0.75, '#ca8a04'); // ゴールド
            bellGrad.addColorStop(1, '#451a03');   // 影
            ctx.fillStyle = bellGrad;
            ctx.fill();

            ctx.strokeStyle = '#854d0e';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // 5. 表面の美しい装飾レリーフ（波文様）
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(rx - 6.5, ry + 1 + bob);
            ctx.quadraticCurveTo(rx - 3, ry - 1 + bob, rx, ry + 1 + bob);
            ctx.quadraticCurveTo(rx + 3, ry + 3 + bob, rx + 6.5, ry + 1 + bob);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(rx - 7.5, ry + 4 + bob);
            ctx.quadraticCurveTo(rx - 4, ry + 2 + bob, rx, ry + 4 + bob);
            ctx.quadraticCurveTo(rx + 4, ry + 6 + bob, rx + 7.5, ry + 4 + bob);
            ctx.stroke();
          } else if (item.type === 'spray') {
            // 本格的な白と赤のツートンカラー「工業用撃退スプレー缶」の精巧な描画
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#ef4444';

            const topY = ry - 17 + bob; // スプレー缶全体の最頂部

            // 1. ノズル部（最上部保護ハウジング：ダークグレー、およびレッドボタン）
            ctx.fillStyle = '#374151'; // ダークグレー
            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.roundRect(rx - 3.5, topY, 7, 5, 1);
            ctx.fill();
            ctx.stroke();

            // レッドの噴射トリガーボタン（ノズル中央上部）
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(rx - 1.5, topY, 3, 2.5);

            // 白色の極細ストロー/噴射管
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(rx, topY + 3);
            ctx.lineTo(rx - 5, topY + 4);
            ctx.stroke();

            // 2. ショルダードーム（メタリックシルバーの肩部分）
            const shoulderY = topY + 5;
            const shoulderGrad = ctx.createLinearGradient(rx - 6, 0, rx + 6, 0);
            shoulderGrad.addColorStop(0, '#9ca3af');
            shoulderGrad.addColorStop(0.5, '#f3f4f6');
            shoulderGrad.addColorStop(1, '#4b5563');
            ctx.fillStyle = shoulderGrad;
            ctx.strokeStyle = '#6b7280';
            ctx.beginPath();
            ctx.moveTo(rx - 6, shoulderY + 3);
            ctx.quadraticCurveTo(rx - 4, shoulderY, rx - 3, shoulderY);
            ctx.lineTo(rx + 3, shoulderY);
            ctx.quadraticCurveTo(rx + 4, shoulderY, rx + 6, shoulderY + 3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 3. 缶の本体（円柱状。白と赤のツートンカラー）
            const bodyY = shoulderY + 3;
            const bodyH = 21;

            // 缶ベース（白色）
            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(rx - 6, bodyY, 12, bodyH, [0, 0, 1, 1]);
            ctx.fill();
            ctx.stroke();

            // メインの赤いラベル（中央部に帯状に配置）
            const labelGrad = ctx.createLinearGradient(rx - 6, 0, rx + 6, 0);
            labelGrad.addColorStop(0, '#991b1b');  // 濃い影
            labelGrad.addColorStop(0.3, '#dc2626'); // 明るい赤
            labelGrad.addColorStop(0.7, '#ef4444'); // ハイライト赤
            labelGrad.addColorStop(1, '#7f1d1d');  // 影
            ctx.fillStyle = labelGrad;
            ctx.fillRect(rx - 6, bodyY + 2, 12, bodyH - 4);

            // 「SPRAY」ロゴ（極小の白色フォントで缶身に描画）
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('SPRAY', rx, bodyY + 9);
            ctx.font = '4px sans-serif';
            ctx.fillText('CAN', rx, bodyY + 14);
            ctx.restore();

            // 4. 底面の金属プレート
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(rx - 5, bodyY + bodyH, 10, 1);
          }

          // プレイヤーが近くにいる場合、操作案内テキストを表示
          const pDist = Math.sqrt((this.playerX - item.x) ** 2 + (this.playerY - item.y) ** 2);
          if (pDist < 120) {
            textDrawQueue.push({
              text: '[右クリックで拾う]',
              x: rx,
              y: ry - 18 + bob,
              font: 'bold 10px sans-serif',
              color: '#ffcc00',
              align: 'center'
            });
          }

          ctx.restore();
        }
      }
    });

    // 3. 生存者の描画
    this.survivors.forEach(surv => {
      const rx = surv.x - camX;
      const ry = surv.y - camY;
      if (rx > -50 && rx < 1010 && ry > -50 && ry < 594) {
        ctx.save();

        // 呼吸の揺れ（ボビング）
        const bob = Math.sin(performance.now() / 150 + surv.id * 5) * 1.2;
        const bx = rx;
        const by = ry;

        // 視認性を良くするための周囲のグロー（救出状況に応じて色を変化）
        ctx.shadowBlur = surv.saved ? 15 : 10;
        ctx.shadowColor = surv.saved ? '#10b981' : '#dc2626';

        // キャラクター固有の精巧なベクタードット絵描画
        if (surv.id === 0) {
          // ==================== 佐藤 (Sato) [ピンク髪・料理人] ====================
          // 1. 体（水色ドレス）
          ctx.fillStyle = '#60a5fa';
          ctx.beginPath();
          ctx.moveTo(bx - 7, by + 12);
          ctx.lineTo(bx - 4, by - 2 + bob);
          ctx.lineTo(bx + 4, by - 2 + bob);
          ctx.lineTo(bx + 7, by + 12);
          ctx.closePath();
          ctx.fill();

          // 2. 白いエプロン
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(bx - 3.5, by + 1);
          ctx.lineTo(bx + 3.5, by + 1);
          ctx.lineTo(bx + 5, by + 12);
          ctx.lineTo(bx - 5, by + 12);
          ctx.closePath();
          ctx.fill();

          // 3. 頭（肌色）
          ctx.fillStyle = '#ffedd5';
          ctx.beginPath();
          ctx.arc(bx, by - 6 + bob, 5, 0, Math.PI * 2);
          ctx.fill();

          // 4. ピンクのふんわり髪
          ctx.fillStyle = '#f472b6';
          // 後ろ髪
          ctx.beginPath();
          ctx.arc(bx, by - 7 + bob, 6.5, 0, Math.PI * 2);
          ctx.fill();
          // サイドと前髪の膨らみ
          ctx.beginPath();
          ctx.arc(bx - 5, by - 5 + bob, 3.8, 0, Math.PI * 2);
          ctx.arc(bx + 5, by - 5 + bob, 3.8, 0, Math.PI * 2);
          ctx.arc(bx, by - 11 + bob, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // 5. お顔の表情
          ctx.fillStyle = '#fda4af'; // ほっぺのチーク
          ctx.fillRect(bx - 3, by - 5 + bob, 1.2, 1);
          ctx.fillRect(bx + 1.8, by - 5 + bob, 1.2, 1);
          ctx.fillStyle = '#0f172a'; // 目
          ctx.fillRect(bx - 2, by - 7 + bob, 1.2, 1.2);
          ctx.fillRect(bx + 1, by - 7 + bob, 1.2, 1.2);

          // 6. 持ち物
          // 右手：茶色い木製の大きなスプーン
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx - 3, by + 4);
          ctx.lineTo(bx - 11, by - 6 + bob);
          ctx.stroke();
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.ellipse(bx - 12, by - 7 + bob, 3, 2, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();

          // 左手：銅色の丸いコッペル鍋を提げている
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(bx + 3, by + 4);
          ctx.lineTo(bx + 8, by + 8);
          ctx.stroke();
          ctx.fillStyle = '#ca8a04'; // コッパーブロンズ
          ctx.beginPath();
          ctx.roundRect(bx + 5, by + 8, 7, 5, 1.5);
          ctx.fill();
          ctx.fillStyle = '#854d0e';
          ctx.fillRect(bx + 4.5, by + 7.5, 8, 1);

        } else if (surv.id === 1) {
          // ==================== 鈴木 (Suzuki) [修道士・白ひげ] ====================
          // 1. 体（茶色い修道ローブ）
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.moveTo(bx - 6.5, by + 12);
          ctx.lineTo(bx - 4, by - 1 + bob);
          ctx.lineTo(bx + 4, by - 1 + bob);
          ctx.lineTo(bx + 6.5, by + 12);
          ctx.closePath();
          ctx.fill();

          // フードの肩掛け
          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.moveTo(bx - 5.5, by - 2 + bob);
          ctx.lineTo(bx + 5.5, by - 2 + bob);
          ctx.lineTo(bx, by + 2.5 + bob);
          ctx.closePath();
          ctx.fill();

          // 2. 頭（肌色・白ヒゲ）
          ctx.fillStyle = '#ffedd5';
          ctx.beginPath();
          ctx.arc(bx, by - 6 + bob, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // トンスラ（ハゲ頭の周りのグレーの髪のリング）
          ctx.strokeStyle = '#9ca3af';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bx, by - 8.5 + bob, 3.2, Math.PI, Math.PI * 2);
          ctx.stroke();

          // 豊かな白いあごひげ
          ctx.fillStyle = '#f3f4f6';
          ctx.beginPath();
          ctx.moveTo(bx - 3, by - 4 + bob);
          ctx.lineTo(bx + 3, by - 4 + bob);
          ctx.lineTo(bx, by + 1.5 + bob);
          ctx.closePath();
          ctx.fill();

          // 目
          ctx.fillStyle = '#374151';
          ctx.fillRect(bx - 1.8, by - 6 + bob, 1, 1);
          ctx.fillRect(bx + 0.8, by - 6 + bob, 1, 1);

          // 3. 持ち物
          // 胸元：赤茶の革装の分厚い本
          ctx.fillStyle = '#9a3412';
          ctx.beginPath();
          ctx.roundRect(bx - 3.5, by + 1 + bob, 7, 5, 1);
          ctx.fill();
          ctx.fillStyle = '#fef3c7'; // 紙面
          ctx.fillRect(bx - 2.5, by + 2 + bob, 5, 1);

          // 左手：曲がった木製の長い巡礼杖
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(bx + 6, by + 12);
          ctx.lineTo(bx + 6, by - 12 + bob);
          ctx.stroke();
          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.arc(bx + 4.5, by - 11.5 + bob, 1.6, 0, Math.PI * 2);
          ctx.fill();

        } else if (surv.id === 2) {
          // ==================== 高橋 (Takahashi) [赤髪弓使い] ====================
          // 1. 体（茶色の革アーマー＆オリーブ）
          ctx.fillStyle = '#7c2d12';
          ctx.beginPath();
          ctx.moveTo(bx - 6, by + 12);
          ctx.lineTo(bx - 3.5, by - 2 + bob);
          ctx.lineTo(bx + 3.5, by - 2 + bob);
          ctx.lineTo(bx + 6, by + 12);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#a16207'; // レザーベスト
          ctx.fillRect(bx - 2, by + bob, 4, 8);

          // 背中の矢筒（斜めに背負う）
          ctx.save();
          ctx.translate(bx - 5.5, by + 1.5 + bob);
          ctx.rotate(-Math.PI / 6);
          ctx.fillStyle = '#451a03';
          ctx.fillRect(-2, -3, 4, 10);
          ctx.fillStyle = '#e2e8f0'; // 矢の羽
          ctx.fillRect(-1.5, -6, 1, 3);
          ctx.fillRect(0.5, -7, 1, 4);
          ctx.restore();

          // 2. 頭（肌色）
          ctx.fillStyle = '#ffedd5';
          ctx.beginPath();
          ctx.arc(bx, by - 6 + bob, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // 3. 赤褐色の三つ編み
          ctx.fillStyle = '#c2410c';
          ctx.beginPath();
          ctx.arc(bx, by - 7.5 + bob, 5, 0, Math.PI * 2);
          ctx.fill();
          // 三つ編みが右肩に垂れる
          ctx.beginPath();
          ctx.ellipse(bx + 4.2, by - 2 + bob, 1.8, 3.5, Math.PI / 6, 0, Math.PI * 2);
          ctx.ellipse(bx + 5.2, by + 2 + bob, 1.4, 2.5, Math.PI / 6, 0, Math.PI * 2);
          ctx.fill();

          // 目（りりしい表情）
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(bx - 2, by - 7 + bob, 1.2, 1);
          ctx.fillRect(bx + 1, by - 7 + bob, 1.2, 1);

          // 4. 持ち物：左手の木製ロングボウ（弓）
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(bx + 7.5, by + 2 + bob, 9, -Math.PI / 1.7, Math.PI / 1.7);
          ctx.stroke();
          // 弓弦
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(bx + 7.5, by - 7 + bob);
          ctx.lineTo(bx + 7.5, by + 11 + bob);
          ctx.stroke();

        } else if (surv.id === 3) {
          // ==================== 田中 (Tanaka) [頑強な鍛冶屋] ====================
          // 1. 体（がっしりした体型、黒インナーと革エプロン）
          ctx.fillStyle = '#3f3f46';
          ctx.beginPath();
          ctx.moveTo(bx - 8.5, by + 12);
          ctx.lineTo(bx - 5.5, by - 3 + bob);
          ctx.lineTo(bx + 5.5, by - 3 + bob);
          ctx.lineTo(bx + 8.5, by + 12);
          ctx.closePath();
          ctx.fill();

          // 分厚い革エプロン
          ctx.fillStyle = '#78350f';
          ctx.fillRect(bx - 4.5, by - 1 + bob, 9, 13);

          // 2. 頭（肌色）
          ctx.fillStyle = '#ffedd5';
          ctx.beginPath();
          ctx.arc(bx, by - 7 + bob, 5, 0, Math.PI * 2);
          ctx.fill();

          // たくましい茶色の髭
          ctx.fillStyle = '#7c2d12';
          ctx.beginPath();
          ctx.arc(bx - 3.5, by - 4 + bob, 2.5, 0, Math.PI * 2);
          ctx.arc(bx + 3.5, by - 4 + bob, 2.5, 0, Math.PI * 2);
          ctx.arc(bx, by - 2 + bob, 4.2, 0, Math.PI * 2);
          ctx.fill();

          // 豊かな茶髪
          ctx.fillStyle = '#7c2d12';
          ctx.beginPath();
          ctx.arc(bx, by - 9.5 + bob, 5.2, Math.PI, 0);
          ctx.fill();

          // 瞳
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(bx - 2.5, by - 7 + bob, 1.2, 1.2);
          ctx.fillRect(bx + 1.5, by - 7 + bob, 1.2, 1.2);
          ctx.fillStyle = '#020617';
          ctx.fillRect(bx - 2, by - 7 + bob, 0.8, 0.8);
          ctx.fillRect(bx + 2, by - 7 + bob, 0.8, 0.8);

          // 3. 持ち物
          // 右手：巨大な両手鉄ハンマー
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(bx - 6, by + 10);
          ctx.lineTo(bx - 13, by - 4 + bob);
          ctx.stroke();
          // ハンマーヘッド（大きな金属矩形）
          ctx.fillStyle = '#52525b';
          ctx.strokeStyle = '#9ca3af';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.roundRect(bx - 16, by - 8 + bob, 6.5, 5, 1);
          ctx.fill();
          ctx.stroke();

          // 左手：大きな丸型木盾（鉄補強）
          ctx.fillStyle = '#7c2d12';
          ctx.beginPath();
          ctx.arc(bx + 9.5, by + 4 + bob, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#9ca3af';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(bx + 9.5, by + 4 + bob, 2, 0, Math.PI * 2);
          ctx.fill();

        } else if (surv.id === 4) {
          // ==================== 伊藤 (Ito) [黒髪フード・アサシン] ====================
          // 1. 後ろになびく濃紺マント
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(bx - 5, by + 1 + bob);
          ctx.lineTo(bx - 9, by + 12);
          ctx.lineTo(bx - 1, by + 12);
          ctx.lineTo(bx + 5, by + 1 + bob);
          ctx.closePath();
          ctx.fill();

          // 2. 体（ダークグレーの戦闘衣）
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(bx - 6, by + 12);
          ctx.lineTo(bx - 4, by - 1 + bob);
          ctx.lineTo(bx + 4, by - 1 + bob);
          ctx.lineTo(bx + 6, by + 12);
          ctx.closePath();
          ctx.fill();

          // 3. 頭（肌色をフードの奥に）
          ctx.fillStyle = '#ffedd5';
          ctx.beginPath();
          ctx.arc(bx, by - 6 + bob, 4.2, 0, Math.PI * 2);
          ctx.fill();

          // 濃紺のフード
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(bx, by - 7.5 + bob, 5.2, 0, Math.PI * 2);
          ctx.fill();

          // フードの影
          ctx.fillStyle = '#020617';
          ctx.beginPath();
          ctx.arc(bx, by - 7 + bob, 4.4, Math.PI / 6, Math.PI * 5 / 6, true);
          ctx.lineTo(bx, by - 2 + bob);
          ctx.closePath();
          ctx.fill();

          // 青い瞳（フードから覗く）
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(bx + 1.2, by - 6 + bob, 1.2, 1.2);

          // 黒い前髪が片目を隠す
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bx - 3, by - 9.5 + bob);
          ctx.lineTo(bx + 0.5, by - 4 + bob);
          ctx.stroke();

          // 4. 持ち物
          // 右手：小型の手斧（ハチェット）
          ctx.strokeStyle = '#7c2d12';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bx - 4, by + 7);
          ctx.lineTo(bx - 11, by + 10);
          ctx.stroke();
          ctx.fillStyle = '#94a3b8'; // 鉄刃
          ctx.beginPath();
          ctx.moveTo(bx - 9, by + 7);
          ctx.quadraticCurveTo(bx - 12, by + 4, bx - 13, by + 6);
          ctx.lineTo(bx - 10, by + 11);
          ctx.closePath();
          ctx.fill();

          // 左腰のナイフの鞘
          ctx.fillStyle = '#451a03';
          ctx.fillRect(bx + 4.5, by + 4 + bob, 2.5, 6);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(bx + 3.5, by + 3.5 + bob, 4.5, 1);
        }

        ctx.restore();

        // 救助マーク、テキスト、数字の描画
        const pulse = Math.sin(performance.now() / 150) * 1.5;

        // 頭上に救出用の番号（1〜5）を表示
        ctx.fillStyle = surv.saved ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.arc(rx, ry - 14 + bob, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        textDrawQueue.push({
          text: String(surv.id + 1),
          x: rx,
          y: ry - 11.5 + bob,
          font: 'bold 8px sans-serif',
          color: '#ffffff',
          align: 'center'
        });

        if (!surv.saved) {
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(rx - 16, ry - 30 + pulse, 32, 9);

          textDrawQueue.push({
            text: 'HELP!',
            x: rx,
            y: ry - 23 + pulse,
            font: 'bold 8px sans-serif',
            color: '#ffffff',
            align: 'center'
          });

          // プレイヤーが近くにいる場合、操作案内テキストを表示
          const pDist = Math.sqrt((this.playerX - surv.x) ** 2 + (this.playerY - surv.y) ** 2);
          if (pDist < 120) {
            textDrawQueue.push({
              text: '[右クリックで救助]',
              x: rx,
              y: ry - 37 + pulse,
              font: 'bold 10px sans-serif',
              color: '#10b981',
              align: 'center'
            });
          }
        } else {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(rx - 16, ry - 29, 32, 9);

          textDrawQueue.push({
            text: 'SAFE',
            x: rx,
            y: ry - 22,
            font: 'bold 8px sans-serif',
            color: '#ffffff',
            align: 'center'
          });
        }
      }
    });

    // 4. 脱出口の描画
    if (this.hasMap) {
      const rx = this.exitX - camX;
      const ry = this.exitY - camY;
      if (rx > -60 && rx < 1020 && ry > -60 && ry < 604) {
        ctx.save();
        const pulse = 24 + Math.sin(performance.now() / 120) * 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#10b981';
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.beginPath();
        ctx.arc(rx, ry, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.arc(rx, ry, 10, 0, Math.PI * 2);
        ctx.fill();

        textDrawQueue.push({
          text: 'EXIT',
          x: rx,
          y: ry + 3,
          font: 'bold 9px monospace',
          color: '#ffffff',
          align: 'center'
        });
        ctx.restore();
      }
    }

    // 5. プレイヤーの描画
    const prx = this.playerX - camX;
    const pry = this.playerY - camY;

    // ソナーエフェクトの描画 (鈴の効果が有効な間、プレイヤーの周囲に広がるゴールドの波紋)
    if (this.bellActiveTimer > 0) {
      ctx.save();
      const time = performance.now();
      
      // 3本の波紋を時間差で広げる
      for (let i = 0; i < 3; i++) {
        // 各波紋の位相 (0.0 〜 1.0)
        const phase = ((time / 1000) + i * 0.33) % 1.0;
        const radius = phase * 130; // 最大130pxまで広がる
        const opacity = Math.max(0, 1 - phase) * 0.6; // 外側に行くほどフェードアウト
        
        ctx.strokeStyle = `rgba(234, 179, 8, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(prx, pry, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // 残り時間をプレイヤーの少し上にテキストで表示
      const remainingSeconds = (this.bellActiveTimer / 60).toFixed(1);
      textDrawQueue.push({
        text: `🔔 ACTIVE: ${remainingSeconds}s`,
        x: prx,
        y: pry - 20,
        font: 'bold 10px monospace',
        color: '#fbbf24',
        align: 'center'
      });
      
      ctx.restore();
    }

    ctx.save();

    // 懐中電灯光軸
    if (this.flashlightOn && this.getLightRadius() > 20) {
      const rad = this.getLightRadius();
      const angle = Math.atan2(this.playerDirY, this.playerDirX);
      ctx.fillStyle = 'rgba(253, 224, 71, 0.1)';
      ctx.beginPath();
      ctx.moveTo(prx, pry);
      ctx.arc(prx, pry, rad * 1.4, angle - Math.PI / 4, angle + Math.PI / 4);
      ctx.closePath();
      ctx.fill();
    }

    // プレイヤー（SCARED TRAVELER）の精巧な描画
    const pAngle = Math.atan2(this.playerDirY, this.playerDirX);
    const isMoving = Math.abs(this.playerVx) > 0.1 || Math.abs(this.playerVy) > 0.1;
    const legSwing = isMoving ? Math.sin(performance.now() / 60) * 4 : 0;
    const staminaRatio = this.stamina / 100;

    ctx.save();
    ctx.translate(prx, pry);
    ctx.scale(1.25, 1.25);
    ctx.rotate(pAngle);

    // 1. リュックサック (茶色) - 背中側 (左側)
    ctx.fillStyle = '#78350f'; // 茶色
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-13, -5, 5, 10, 2);
    ctx.fill();
    ctx.stroke();

    // 2. 体/ジャケット (緑色)
    ctx.fillStyle = this.isRunning ? '#15803d' : '#166534'; // 走るとやや明るい緑、通常は深緑
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-2, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. 茶色のズボン/足のアニメーション
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-7, -7 + legSwing, 3, 2.5);
    ctx.fillRect(-7, 4.5 - legSwing, 3, 2.5);

    // 4. 頭/肌 (恐怖で青ざめている: スタミナが低い、または危険時に青っぽく)
    const faceColor = staminaRatio < 0.35 ? '#93c5fd' : '#fed7aa'; // 青白い or 薄橙
    ctx.fillStyle = faceColor;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(3, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. 乱れた茶髪 (後ろ・横髪)
    ctx.fillStyle = '#451a03'; // 濃い茶色
    ctx.beginPath();
    ctx.arc(-1, 0, 7.5, Math.PI / 2, Math.PI * 1.5);
    // 乱れた前髪の房
    ctx.lineTo(5, -4);
    ctx.lineTo(3, -1);
    ctx.lineTo(6, 0);
    ctx.lineTo(3, 1.5);
    ctx.lineTo(5, 4);
    ctx.closePath();
    ctx.fill();

    // 6. 怯えた表情 (見開いた目、冷や汗)
    // 白目 (大きく見開く)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, -2.5, 2, 0, Math.PI * 2);
    ctx.arc(4, 2.5, 2, 0, Math.PI * 2);
    ctx.fill();
    // 黒目 (極小にして恐怖感を演出)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(4.5, -2.5, 0.7, 0, Math.PI * 2);
    ctx.arc(4.5, 2.5, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 冷や汗 (水色)
    if (staminaRatio < 0.5) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(2, -4, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. 手/懐中電灯
    if (this.flashlightOn) {
      ctx.fillStyle = '#4b5563'; // 懐中電灯グレー
      ctx.fillRect(5, 2.5, 5, 2.5);
      ctx.fillStyle = '#fef08a'; // 黄色いレンズ
      ctx.fillRect(10, 2.5, 1.5, 2.5);
    }

    ctx.restore();
    ctx.restore();

    // 6. クマの描画 (3体すべて描画：DEMONIC BEAR仕様)
    this.bears.forEach(bear => {
      const brx = bear.x - camX;
      const bry = bear.y - camY;
      if (brx > -35 && brx < 995 && bry > -35 && bry < 579) {
        const isBellActive = this.bellActiveTimer > 0;
        const distToPlayer = Math.sqrt((this.playerX - bear.x) ** 2 + (this.playerY - bear.y) ** 2);
        const isIlluminated = this.flashlightOn && distToPlayer < this.getLightRadius();

        if (distToPlayer < 200 || isIlluminated) {
          ctx.save();
          const shake = bear.state === 'chase' ? Math.sin(performance.now() / 35) * 1.5 : 0;
          const time = performance.now();
          
          // クマの向いている角度を計算
          let bearAngle = 0;
          if (bear.state === 'chase') {
            bearAngle = Math.atan2(this.playerY - bear.y, this.playerX - bear.x);
          } else {
            bearAngle = Math.atan2(bear.wanderDirY, bear.wanderDirX);
          }

          // 不気味な闇のオーラ（周囲に漂う不気味なぼかし円グラデーション）
          const auraGrad = ctx.createRadialGradient(brx + shake, bry, 12.5, brx + shake, bry, 44);
          const auraColor = bear.state === 'chase' ? 'rgba(220, 38, 38, 0.18)' : 'rgba(147, 51, 234, 0.15)';
          auraGrad.addColorStop(0, auraColor);
          auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(brx + shake, bry, 44, 0, Math.PI * 2);
          ctx.fill();

          ctx.translate(brx + shake, bry);
          ctx.scale(1.25, 1.25); // クマを1.25倍に拡大
          ctx.rotate(bearAngle);

          // 1. 背中や足元からのたうつ赤い寄寄生組織・触手（くねくね動くアニメーション）
          const tentacleCount = 6;
          ctx.strokeStyle = '#dc2626'; // 鮮血の赤
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          for (let i = 0; i < tentacleCount; i++) {
            const angleOffset = -Math.PI * 0.75 + (i * (Math.PI * 1.5 / (tentacleCount - 1))); // 後方〜側方に放射
            ctx.save();
            ctx.rotate(angleOffset);
            
            ctx.beginPath();
            ctx.moveTo(-11, 0);
            const length = 18 + Math.sin(time / 140 + i * 1.8) * 4;
            ctx.lineTo(-11 - length * 0.35, Math.sin(time / 110 + i) * 2.5);
            ctx.lineTo(-11 - length * 0.7, Math.cos(time / 130 + i * 1.4) * 4);
            ctx.lineTo(-11 - length, Math.sin(time / 95 + i * 0.8) * 5);
            ctx.stroke();
            
            // 触手の先端の不気味な肉芽
            ctx.fillStyle = '#f472b6';
            ctx.beginPath();
            ctx.arc(-11 - length, Math.sin(time / 95 + i * 0.8) * 5, 1.8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
          }

          // 2. 実験体ゾンビベアの巨体（汚れた茶褐色、露出した筋肉、血まみれの傷）
          ctx.fillStyle = '#5c2d17'; // 汚れた茶褐色
          ctx.strokeStyle = '#311005'; // 赤黒い輪郭線
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(-2, 0, 16, 0, Math.PI * 2); // 巨体
          ctx.fill();
          ctx.stroke();

          // 壊死した傷痕、露出したグレーの筋組織の描き込み
          ctx.fillStyle = '#4b5563'; // 暗いグレーの壊死組織
          ctx.beginPath();
          ctx.arc(-6, -6, 4, 0, Math.PI * 2);
          ctx.arc(-2, 7, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#991b1b'; // 傷口の暗い赤（血痕）
          ctx.beginPath();
          ctx.arc(-5, -6, 2.5, 0, Math.PI * 2);
          ctx.arc(-2, 7, 2, 0, Math.PI * 2);
          ctx.fill();

          // 2.2. 鋭く血まみれの巨大な爪
          ctx.strokeStyle = '#991b1b'; // 血の暗い赤
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(11, -8); ctx.lineTo(17, -10 + Math.sin(time / 110) * 1.5);
          ctx.moveTo(12, 0); ctx.lineTo(19, Math.cos(time / 90) * 1.5);
          ctx.moveTo(11, 8); ctx.lineTo(17, 10 + Math.sin(time / 110) * 1.5);
          ctx.stroke();

          ctx.fillStyle = '#dc2626'; // 鮮血
          ctx.beginPath();
          ctx.arc(17, -10 + Math.sin(time / 110) * 1.5, 1.2, 0, Math.PI * 2);
          ctx.arc(19, Math.cos(time / 90) * 1.5, 1.2, 0, Math.PI * 2);
          ctx.arc(17, 10 + Math.sin(time / 110) * 1.5, 1.2, 0, Math.PI * 2);
          ctx.fill();

          // 耳の描画（ボロボロの耳）
          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.arc(-5, -12, 4.5, 0, Math.PI * 2);
          ctx.arc(-5, 12, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // 2.5. 金属鋲（スタッズ）付きの暗青色の実験首輪
          ctx.strokeStyle = '#1e3a8a'; // 暗青色
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(2, 0, 16.5, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();

          // スタッズの金属光沢（シルバーの点）
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(4, -8, 1.2, 0, Math.PI * 2);
          ctx.arc(5.2, 0, 1.2, 0, Math.PI * 2);
          ctx.arc(4, 8, 1.2, 0, Math.PI * 2);
          ctx.fill();

          // 3. 咆哮・闇の霧ブレスエフェクト (CHASE状態で周期的に口から紫オーラを吐き出す)
          if (bear.state === 'chase') {
            const breathCycle = (time / 800) % 1.0;
            if (breathCycle < 0.45) {
              ctx.save();
              const breathSize = breathCycle * 28;
              const breathOpacity = Math.max(0, 0.75 - breathCycle * 1.6);
              const breathGrad = ctx.createRadialGradient(16, 0, 2, 16 + breathSize, 0, breathSize * 1.5);
              breathGrad.addColorStop(0, `rgba(168, 85, 247, ${breathOpacity})`);
              breathGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
              ctx.fillStyle = breathGrad;
              ctx.beginPath();
              ctx.arc(16 + breathSize / 2, 0, breathSize * 1.3, -Math.PI / 5, Math.PI / 5);
              ctx.lineTo(16, 0);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
          }

          // 3.5. 裂けた口、むき出しの牙、したたる不気味な唾液（ヨダレ）
          ctx.save();
          ctx.translate(11, 0);
          
          // 口の赤黒い腔内
          ctx.fillStyle = '#450a0a';
          ctx.beginPath();
          ctx.ellipse(0, 0, 4.5, 6, 0, -Math.PI / 2, Math.PI / 2);
          ctx.fill();

          // 鋭い牙（白い極小三角形）
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(1, -4.5); ctx.lineTo(3.5, -3); ctx.lineTo(1.5, -1.5);
          ctx.moveTo(1.5, -3); ctx.lineTo(4, -1.5); ctx.lineTo(1.5, 0);
          ctx.moveTo(1.5, 0); ctx.lineTo(4, 1.5); ctx.lineTo(1.5, 3);
          ctx.moveTo(1, 4.5); ctx.lineTo(3.5, 3); ctx.lineTo(1.5, 1.5);
          ctx.fill();

          // したたるねばねばしたヨダレ
          const salivaLen = 5 + Math.sin(time / 110) * 3;
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)'; // 黄ばんだ粘液
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(2, 2.5);
          ctx.lineTo(2 + salivaLen * 0.4, 4 + Math.sin(time / 90) * 1.5);
          ctx.lineTo(2 + salivaLen, 6 + Math.cos(time / 70) * 2);
          ctx.stroke();
          ctx.restore();

          // 4. 右目は黒い空洞（血涙が流れる）、左目は黄色く濁って光る
          // 右目 (上側: y = -4.5) - 黒い空洞
          ctx.fillStyle = '#050505';
          ctx.beginPath();
          ctx.arc(8, -4.5, 3.2, 0, Math.PI * 2);
          ctx.fill();

          // 垂れ落ちる黒い液
          ctx.strokeStyle = '#050505';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(8, -4.5);
          ctx.lineTo(2, -7 - Math.sin(time / 200) * 1.5);
          ctx.stroke();

          // 左目 (下側: y = 4.5) - 黄色く光る
          ctx.fillStyle = '#facc15'; // 黄色
          ctx.beginPath();
          ctx.arc(8, 4.5, 3.2, 0, Math.PI * 2);
          ctx.fill();

          // 濁った瞳孔
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(8.5, 4.5, 1.2, 0, Math.PI * 2);
          ctx.fill();

          // ハイライト
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(9.2, 3.8, 0.7, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();

          // 5. ステータステキスト（頭上）
          textDrawQueue.push({
            text: bear.state === 'chase' ? '👿 CHASE' : isBellActive ? '🔔 鈴惑わし' : '🌲 WANDER',
            x: brx + shake,
            y: bry - 22,
            font: 'bold 9.5px monospace',
            color: '#ef4444',
            align: 'center'
          });
        }
      }
    });

    // 7. 懐中電灯による極限暗闇シャドウマスク (視界制限・明滅の再現)
    ctx.save();
    if (!this.maskCanvas) {
      this.maskCanvas = document.createElement('canvas');
      this.maskCanvas.width = 960;
      this.maskCanvas.height = 544;
      this.maskCtx = this.maskCanvas.getContext('2d');
    }
    const maskCanvas = this.maskCanvas;
    const mctx = this.maskCtx;

    if (mctx) {
      const batteryMinutes = Math.ceil(this.batterySeconds / 60);
      const isFlickeringOff = this.flashlightOn && batteryMinutes <= 2 && !flickerState;
      const darknessOpacity = !this.flashlightOn || isFlickeringOff ? 0.995 : 0.98;

      mctx.fillStyle = `rgba(3, 7, 3, ${darknessOpacity})`;
      mctx.fillRect(0, 0, 960, 544);

      if (this.flashlightOn && !isFlickeringOff) {
        mctx.globalCompositeOperation = 'destination-out';
        const rad = this.getLightRadius();

        const grad = mctx.createRadialGradient(prx, pry, rad * 0.1, prx, pry, rad);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.9)');
        grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

        mctx.fillStyle = grad;
        mctx.beginPath();
        mctx.arc(prx, pry, rad, 0, Math.PI * 2);
        mctx.fill();
      }

      ctx.drawImage(maskCanvas, 0, 0);
    }
    ctx.restore();

    // 究極のドット絵化（480x272の低解像度に縮小し、画像補間を無効にして960x544に2倍拡大転送）
    if (this.offscreenCanvas && this.offscreenCtx) {
      // 1. メインCanvasの描画を480x272に縮小
      this.offscreenCtx.clearRect(0, 0, 480, 272);
      this.offscreenCtx.drawImage(this.canvas, 0, 0, 960, 544, 0, 0, 480, 272);

      // 2. メインCanvasを全クリア
      ctx.clearRect(0, 0, 960, 544);

      // 3. 拡大時の補完処理（バイリニアなど）を無効にしてニアレストネイバー（ジャギーを綺麗に残す）に設定
      ctx.imageSmoothingEnabled = false;
      (ctx as any).mozImageSmoothingEnabled = false;
      (ctx as any).webkitImageSmoothingEnabled = false;
      (ctx as any).msImageSmoothingEnabled = false;

      // 4. 2倍に引き伸ばして描き直す
      ctx.drawImage(this.offscreenCanvas, 0, 0, 480, 272, 0, 0, 960, 544);
    }

    // 5. 探索マップ上のテキストを高解像度（アンチエイリアスありのクリアなフォント、黒縁取り付き）で上乗せ描画
    if (textDrawQueue.length > 0) {
      ctx.save();
      // 高精細テキストにするため、画像補間を通常（滑らか）に戻す
      ctx.imageSmoothingEnabled = true;
      (ctx as any).mozImageSmoothingEnabled = true;
      (ctx as any).webkitImageSmoothingEnabled = true;
      (ctx as any).msImageSmoothingEnabled = true;

      // シャドウ設定を一度クリア
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      textDrawQueue.forEach(q => {
        ctx.fillStyle = q.color;
        ctx.font = q.font;
        ctx.textAlign = q.align;
        
        // 視認性を劇的に向上させるため、文字の周りに黒い縁取り（袋文字）をクオリティ高く描画
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.strokeText(q.text, q.x, q.y);
        ctx.fillText(q.text, q.x, q.y);
      });
      ctx.restore();
    }
  }
}
