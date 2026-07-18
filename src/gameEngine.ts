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

  // プレイヤー状態
  public playerX = 4800;
  public playerY = 2720;
  public playerDirX = 0;
  public playerDirY = 1;
  public stamina = 100;
  public isStaminaExhausted = false;
  public isRunning = false;
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
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#fbbf24';
            ctx.fillStyle = '#b45309';
            ctx.fillRect(rx - 8, ry - 8 + bob, 16, 16);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(rx - 8, ry - 8 + bob, 16, 16);

            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('M', rx, ry + 3 + bob);
          } else if (item.type === 'bell') {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#eab308';
            ctx.fillStyle = '#ca8a04';
            ctx.beginPath();
            ctx.arc(rx, ry + bob, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#eab308';
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('B', rx, ry + 3 + bob);
          } else if (item.type === 'spray') {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#f97316';
            ctx.fillStyle = '#ea580c';
            ctx.fillRect(rx - 6, ry - 9 + bob, 12, 18);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(rx - 6, ry - 9 + bob, 12, 18);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('S', rx, ry + 3 + bob);
          }

          // プレイヤーが近くにいる場合、操作案内テキストを表示
          const pDist = Math.sqrt((this.playerX - item.x) ** 2 + (this.playerY - item.y) ** 2);
          if (pDist < 120) {
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('[右クリックで拾う]', rx, ry - 18 + bob);
          }

          ctx.restore();
        }
      }
    });

    // 3. 生存者の描画
    this.survivors.forEach(surv => {
      const rx = surv.x - camX;
      const ry = surv.y - camY;
      if (rx > -30 && rx < 990 && ry > -30 && ry < 574) {
        ctx.fillStyle = surv.saved ? '#059669' : '#047857';
        ctx.beginPath();
        ctx.arc(rx, ry, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(surv.id + 1), rx, ry + 3);

        const pulse = Math.sin(performance.now() / 150) * 1.5;
        if (!surv.saved) {
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(rx - 16, ry - 25 + pulse, 32, 9);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('HELP!', rx, ry - 18 + pulse);

          // プレイヤーが近くにいる場合、操作案内テキストを表示
          const pDist = Math.sqrt((this.playerX - surv.x) ** 2 + (this.playerY - surv.y) ** 2);
          if (pDist < 120) {
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('[右クリックで救助]', rx, ry - 32 + pulse);
          }
        } else {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(rx - 16, ry - 24, 32, 9);
          ctx.fillStyle = '#fff';
          ctx.font = '7px sans-serif';
          ctx.fillText('SAFE', rx, ry - 17);
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

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', rx, ry + 3);
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
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`🔔 ACTIVE: ${remainingSeconds}s`, prx, pry - 20);
      
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

          // 1. 背中の金色の突起（棘・スパイク）- 背中側（左側・進行方向の逆）に複数放射
          const spikeCount = 5;
          const isSpikeGlow = bear.state === 'chase' && (Math.floor(time / 150) % 2 === 0);
          ctx.fillStyle = isSpikeGlow ? '#c084fc' : '#eab308'; // 追跡中は紫に明滅、通常は金色
          ctx.strokeStyle = isSpikeGlow ? '#581c1c' : '#854d0e';
          ctx.lineWidth = 1;
          
          for (let i = 0; i < spikeCount; i++) {
            const angleOffset = -Math.PI * 0.65 + (i * (Math.PI * 1.3 / (spikeCount - 1))); // 後方180度に分散
            ctx.save();
            ctx.rotate(angleOffset);
            ctx.beginPath();
            ctx.moveTo(-11, 0);
            ctx.lineTo(-21, -3.5);
            ctx.lineTo(-15, -6.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          // 2. 異形の悪魔熊の巨体（濃い紫色〜茶褐色）
          ctx.fillStyle = '#2e1065'; // 濃い紫色 (ダークパープル)
          ctx.strokeStyle = '#581c1c'; // 赤黒い輪郭線
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(-2, 0, 16, 0, Math.PI * 2); // 巨体化 (半径16)
          ctx.fill();
          ctx.stroke();

          // 耳の描画 (悪魔風の尖った耳)
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.arc(-5, -12, 4.5, 0, Math.PI * 2);
          ctx.arc(-5, 12, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

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

          // 4. 赤く怪しく光る目
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(7, -4.5, 3, 0, Math.PI * 2);
          ctx.arc(7, 4.5, 3, 0, Math.PI * 2);
          ctx.fill();
          
          // 目に怪しい光沢（ハイライト）
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(8, -4.5, 0.8, 0, Math.PI * 2);
          ctx.arc(8, 4.5, 0.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();

          // 5. ステータステキスト（頭上）
          ctx.save();
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(bear.state === 'chase' ? '👿 CHASE' : isBellActive ? '🔔 鈴惑わし' : '🌲 WANDER', brx + shake, bry - 22);
          ctx.restore();
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
  }
}
