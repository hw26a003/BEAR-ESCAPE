import { useState, useEffect, useRef } from 'react';
import { 
  Compass, 
  Map as MapIcon, 
  Flame, 
  Volume2, 
  HelpCircle, 
  BookOpen, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  Info,
  Zap,
  Users,
  Shield,
  Lightbulb,
  Heart
} from 'lucide-react';

const specs = {
  overview: {
    title: "01. ゲーム概要 (Game Overview)",
    icon: BookOpen,
    content: `山に迷い込んだ主人公が、いつどこから現れるか分からない「恐ろしいクマ」の追跡を逃れながら、山を下る（脱出する）ことを目指す、見下ろし視点（トップビュー）の探索型2Dホラーゲームです。

### 1.1 あらすじ（プロローグ）
「気づけば、私は深い闇に包まれた山の中にいた。
どこをどう歩いてきたのか、帰り道が分からない。
冷たい夜風が木々を揺らし、不気味なざわめきが耳を打つ。

とにかく、山を降りなければ。

そう決意して歩き出そうとしたその時、闇の奥から重苦しい足音が聞こえた。
それは、普通の熊とは明らかに異なる、この世のモノとは思えない恐ろしい『クマ』の気配だった。

手元にあるのは、かろうじて周囲を照らす懐中電灯だけ。
山を下るための『地図』を探し出し、あの恐怖から生き延びて、無事に生還することができるだろうか……。」

### 1.2 ゲームの目的とクリア条件
- **目的**: 恐ろしいクマから逃げつつ、山を下りて脱出すること。
- **クリア条件（通常クリア）**: 
  1. フィールドに配置されているアイテム「地図」を獲得する。
  2. 地図を獲得することで判明する「山の出口（脱出口）」に到達する。
- **マルチエンディング・評価システム**:
  - フィールドに点在する **5人の生存者（遭難者）を何人救出して脱出できたか** によって、クリア時の評価（ランクS〜C）およびエンディングのストーリー・演出が変化します。
  - 生存者はそれぞれ異なるヒント（ゲームを生き抜くための鍵）を持っています。

### 1.3 主要アイテム説明
探索中に役立つ、またゲームクリアに欠かせないキーアイテムです。
- 🗺️ **地図 (Map) - 出現数 1個**:
  獲得するとフィールドの全体マップが判明し、\`R\`キーで表示可能になります。脱出口（クリア位置）を特定するための最重要アイテムです。
- 🔔 **鈴 (Bell) - 出現数 3個**:
  使用すると一時的にクマの追跡を無効化できます（一時的に気配を消す）。ただし、錆びやすいため2回使うと壊れてしまいます。
- 💨 **熊撃退スプレー (Spray) - 出現数 3個**:
  クマに接触した際の戦闘画面でのみ使用可能です。1個消費してクマを吹き飛ばし、遠くに再配置（ワープ）させ、探索を再開できる唯一の防衛手段。`
  },
  system: {
    title: "02. ゲームシステム (Game System)",
    icon: Compass,
    content: `### 2.1 フィールドの構造
- **視点**: 見下ろし視点（トップビュー）の2Dマップ。
- **画面表示サイズ**: 960 × 544 ピクセル。
- **フィールド全体の大きさ**: **面積100倍**（幅10倍 × 高さ10倍：**9,600 × 5,440 ピクセル**、画面100枚分の広さ）。
- **環境・演出**: 夜中の山の中を想定した暗い画面表示。
  - プレイヤーの持つ「懐中電灯」の光が届く範囲（プレイヤーの周囲）だけがかろうじて見えている視界制限演出。

### 2.2 操作方法（PC想定）
- **移動**: キーボードの \`W\`, \`A\`, \`S\`, \`D\` キーでプレイヤーを上下左右に操作。
- **ダッシュ（走る）[新規]**: キーボードの **\`Shift\` キーを長押し** しながら移動。スタミナを消費し、通常速度の **160%** で高速移動。
- **地図の表示**: キーボードの \`R\` キー（地図を所持している時のみ有効）。
- **鈴の使用**: キーボード of \`F\` キー（鈴を所持している時のみ有効）。
- **探索・対話**: マウスの「右クリック」でフィールド上のアイテムを取得したり、NPC（生存者）と会話（救出）をしたりします。

### 2.3 ダッシュとスタミナシステム [新規]
- **スタミナゲージ**:
  - 画面上にスタミナゲージを表示。
  - ダッシュ（Shift長押し移動）中はスタミナが減少し、最大から **5秒間** で空（0）になる。
  - ダッシュを止めると自動的に回復が始まり、空から **約3秒** で全回復する。
- **スタミナ切れペナルティ**:
  - スタミナが空になると息切れ状態になり、ゲージが30%以上まで自動回復するまでダッシュ不可となる。

### 2.4 懐中電灯のバッテリー制限 [新規]
- **制限時間**: バッテリー寿命は **10分（600秒）**。
- **減衰演出**: 残り時間に比例して周囲を照らす可視範囲の半径が徐々に縮小。
- **末期症状**: 残り2分（120秒）以下で光が点滅（明滅）し始め、電気ノイズ音が発生。10分経過で完全な暗闇（極小視界）となる。

### 2.5 アイテムシステム
- **地図 (Map) - 出現数 1個**: 獲得するとフィールドの全体マップが判明し、\`R\`キーで表示可能になる。
- **鈴 (Bell) - 出現数 3個**: 使用すると15秒間クマの追跡を無効化。拾うたびに残り使用回数が **+2回** 累積管理される。
- **熊撃退スプレー (Spray) - 出現数 3個**: 戦闘時のみ使用可能。一度だけクマを追い返し、遠くにワープさせて探索を再開。

### 2.6 生存者救出（NPC）
- **配置数**: ランダムな位置に合計5人配置（直立固定）。
- **救出**: マウス右クリックで会話。会話後に救出完了となりカウンターに加算。
- **ヒント内容**:
  1. 「遠くにいる時は静かにその場を去る方がいい」
  2. 「近くにいる時は熊を見ながらゆっくり後退して！興奮させないのが一番だよ」
  3. 「鈴はクマが寄ってこなくなるがすぐに錆びてしまうため、長くは使えない。」`
  },
  battle: {
    title: "03. 戦闘・エンカウント (Combat & Encounter)",
    icon: Flame,
    content: `### 3.1 敵「クマ」の生態と挙動
- **存在数**: フィールド上に1体のみ（異形デザイン、二足歩行）。
- **追跡条件**: 画面（960×544）の範囲内にクマが入った時点で、即座に追跡が始まる。
- **位置再配置（ワープ）仕様**: ゲーム開始時、および戦闘で「熊撃退スプレー」を使用して追い払った戦闘後のリスポン時のみワープ。通常徘徊中に突然のワープは行わない。

### 3.2 エンカウント（戦闘移行条件）
- フィールド上でプレイヤーとクマの「当たり判定」が接触した瞬間、戦闘画面に移行。

### 3.3 戦闘コマンド（選択肢）
1. **走って逃げる**: 失敗、即座に「ゲームオーバー画面」へ。
2. **死んだふりをする**: 失敗、即座に「ゲームオーバー画面」へ。
3. **アイテムを使う（熊撃退スプレー）**: スプレーを1個消費。クマを遠くへワープさせ、元の探索画面に戻る。スプレーがない場合は使用不可。`
  },
  visual: {
    title: "04. ビジュアル・グラフィック・サウンド (Visual, Sound & Meter)",
    icon: Volume2,
    content: `### 4.1 アートスタイル
- **グラフィック**: レトロで不気味な2Dピクセルアート（ドット絵）。
- **フィールド構造**: 256px/512pxの複合的な「大オブジェクトブロック（背景パーツ）」を組み合わせて構築。

### 4.2 画面演出とUIメーター [新規]
- **暗闇演出**: 懐中電灯を当てた部分だけが照らされる（バッテリー残量で半径が縮小）。
- **クマ接近警告メーター（画面右下UI）**:
  - クマが画面外のとき：**グレー（無彩色）**で静止または緩やかに明滅。
  - クマが画面内に入ったとき：**赤色**に変化し、点滅を開始。
  - クマとの距離が縮まるほど、点滅・鼓動アニメーションのテンポが動的に加速。

### 4.3 マルチエンディング・評価ランク [新規]
- **Sランク (5人救出)**: 「奇跡の生還者たち」エンディング。全員で無事に生還、最高評価。
- **Aランク (3〜4人救出)**: 「多くの命を救って」エンディング。
- **Bランク (1〜2人救出)**: 「ほろ苦い生還」エンディング。
- **Cランク (0人救出)**: 「孤独な生還」エンディング。自分だけ生還するが、深い後悔。

### 4.4 サウンド・音響演出仕様 [新規]
- **距離連動型「心音（鼓動音）」**: クマとの直線距離が縮まるほど、バックグラウンドの鼓動音（ドクン、ドクン）の音量とテンポ（BPM）が急上昇する。
- **鈴の音**: 使用時に澄んだ「チリン、チリン」という音が響く。
- **スプレーの噴射音**: 使用時に勢いよく「プシューッ！」と鳴る。
- **懐中電灯のノイズ音**: バッテリー2分以下での明滅に合わせて「ジジッ…」「ジーッ」という電気ノイズ音が発生。`
  },
  decisions: {
    title: "05. 決定事項・合意 (Resolved Decisions)",
    icon: CheckCircle2,
    content: `ゲームデザイナー様との間で合意・決定された仕様詳細です。

1. **フィールドの「100倍」の定義**: A案（面積が100倍：幅10倍 × 高さ10倍、9,600 × 5,440 ピクセル、画面100枚分）。
2. **鈴の耐久力（2回）の管理**: B案（全体の「残り使用可能回数」に拾うたび+2回加算）。
3. **鈴の効果**: 使用してから15秒間、クマがプレイヤーを追跡（追尾）しなくなる。
4. **追跡条件**: 画面（960×544）の範囲内にクマが入った時点で即座に追跡が始まる。
5. **NPCの配置と移動**: フィールド上のランダム位置に配置、直立固定。
6. **タイルパーツの構成**: 木や道がセットになった「複合大オブジェクトブロック」仕様。
7. **クマのワープ制限**: ワープするのは「初期配置時」と「スプレー戦闘後のリスポン時」のみ。通常探索中に突然ワープしない。
8. **画面演出の配置**: 「Threat Detected」および「接近警告メーター」はプレイヤーの視認性を邪魔しない【右下】に配置。
9. **ダッシュ（Shift長押し）＆スタミナ**: 5秒ダッシュで息切れペナルティ、3秒で全回復。通常速度の160%速。
10. **懐中電灯の10分制限**: 残時間連動で照射半径が減少、2分以下で点滅＋ノイズ。
11. **接近警告メーター**: 画面外はグレー、画面内は赤点滅、距離に応じてテンポが速まる。
12. **マルチエンディング（4段階評価）**: 救出人数（0〜5人）によるS〜Cの分岐エンディング。`
  }
};

const SURVIVOR_COORDS = [
  { name: "佐藤 (Sato)", x: 22, y: 35 },
  { name: "鈴木 (Suzuki)", x: 65, y: 20 },
  { name: "高橋 (Takahashi)", x: 38, y: 78 },
  { name: "田中 (Tanaka)", x: 78, y: 65 },
  { name: "伊藤 (Ito)", x: 18, y: 72 }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<keyof typeof specs>('overview');
  
  // インタラクティブな仮回答ステート
  const [answers, setAnswers] = useState({
    fieldSize: 'A',
    bellUsage: 'B',
    bearSpawn: 'A',
    bearSight: 'A',
    npcSpawn: 'A',
    tileMeaning: 'B'
  });

  // モックシミュレーター用ステート
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(true);
  const [batteryMinutes, setBatteryMinutes] = useState(10); // 10分〜0分
  const [isRunning, setIsRunning] = useState(false);
  const [stamina, setStamina] = useState(100);
  const [isStaminaExhausted, setIsStaminaExhausted] = useState(false);
  const [bearDistance, setBearDistance] = useState(250); // 距離 (10〜500px)
  const [isBearOnScreen, setIsBearOnScreen] = useState(true);
  const [savedSurvivors, setSavedSurvivors] = useState<boolean[]>([false, false, false, false, false]);
  const [activeItems, setActiveItems] = useState({ map: false, bell: 2, spray: 1 });
  const [previewEncounter, setPreviewEncounter] = useState(false);
  const [encounterResult, setEncounterResult] = useState<string | null>(null);
  const [isEscaped, setIsEscaped] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showAllSignalMarkers, setShowAllSignalMarkers] = useState(false);
  const [activeSafeRouteIndex, setActiveSafeRouteIndex] = useState<number | null>(null);

  // 音声（ビープ音）シミュレーター用のオーディオコンテキスト（ブラウザ制限があるためボタン押下時に初期化）
  const audioCtxRef = useRef<AudioContext | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const windSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const windLfoRef = useRef<OscillatorNode | null>(null);

  // スタミナの自動増減ループ
  useEffect(() => {
    const timer = setInterval(() => {
      if (isRunning) {
        setStamina(prev => {
          const next = prev - 4; // 5秒で100から0に (約25回ループ 5000ms/200ms)
          if (next <= 0) {
            setIsRunning(false);
            setIsStaminaExhausted(true);
            playBeep(180, 0.3); // 疲労ビープ音
            return 0;
          }
          return next;
        });
      } else {
        setStamina(prev => {
          const next = prev + 6.6; // 約3秒で全回復 (3000ms/200ms)
          if (next >= 100) {
            if (isStaminaExhausted) {
              setIsStaminaExhausted(false);
            }
            return 100;
          }
          return next;
        });
      }
    }, 200);

    return () => clearInterval(timer);
  }, [isRunning, isStaminaExhausted]);

  // キーボードイベントのモック対応 (Shiftキーによるダッシュ、Rキーによるマップ切替シミュレート)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        if (!isStaminaExhausted && stamina > 30) {
          setIsRunning(true);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (activeItems.map) {
          initAudio();
          setShowMapModal(prev => !prev);
          playBeep(520, 0.15);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsRunning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isStaminaExhausted, stamina, activeItems.map]);

  // 簡易シンセビープ音生成
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  // 環境風音（アンビエントサウンド）の合成再生
  const startWindAmbient = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // すでに再生中なら多重再生を防ぐ
      if (windSourceRef.current) return;

      // 1. ホワイトノイズの生成 (2秒分バッファ)
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // 2. ノイズソースを作成
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // 3. バンドパスフィルタ（風のようなヒューヒューとした周波数帯を再現）
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(320, ctx.currentTime);
      filter.Q.setValueAtTime(1.8, ctx.currentTime);

      // 4. LFO（低周波発振器）でフィルター周波数を揺らして風の強弱・うねりを演出
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // 0.12Hz (約8秒で1周期の緩やかな揺れ)

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(120, ctx.currentTime); // 変調幅120Hz

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // 5. ゲインノード（ホラーな背景音として控えめな音量）
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.008, ctx.currentTime);

      // 6. ノード同士の接続
      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      // 7. 発振開始
      lfo.start();
      noise.start();

      windSourceRef.current = noise;
      windGainRef.current = gainNode;
      windLfoRef.current = lfo;
    } catch (e) {
      console.warn("Ambient audio initialization failed:", e);
    }
  };

  const stopWindAmbient = () => {
    try {
      if (windSourceRef.current) {
        windSourceRef.current.stop();
        windSourceRef.current.disconnect();
        windSourceRef.current = null;
      }
      if (windLfoRef.current) {
        windLfoRef.current.stop();
        windLfoRef.current.disconnect();
        windLfoRef.current = null;
      }
      if (windGainRef.current) {
        windGainRef.current.disconnect();
        windGainRef.current = null;
      }
    } catch (e) {
      // サイレントキャッチ
    }
  };

  // ゲームステウンドに応じた環境音の自動制御
  useEffect(() => {
    if (isGameStarted && !isEscaped && !previewEncounter) {
      startWindAmbient();
    } else {
      stopWindAmbient();
    }
    return () => {
      stopWindAmbient();
    };
  }, [isGameStarted, isEscaped, previewEncounter]);

  // 生存者救出時の安全ルート一時表示制御 (10秒後に非表示)
  useEffect(() => {
    if (activeSafeRouteIndex !== null) {
      const timer = setTimeout(() => {
        setActiveSafeRouteIndex(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [activeSafeRouteIndex]);

  const playBeep = (freq: number, duration: number, type: OscillatorType = 'sine') => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // オーディオ未サポート時のサイレントキャッチ
    }
  };

  // 心音（鼓動）シミュレーター用の定期音
  useEffect(() => {
    if (previewEncounter || isEscaped) return;
    
    // 距離に応じたインターバル設定 (距離10 -> 250ms, 距離500 -> 1500ms)
    const factor = isBearOnScreen ? Math.max(10, Math.min(500, bearDistance)) : 500;
    const interval = isBearOnScreen ? 250 + (factor * 2.5) : 1800;

    const heartTimer = setInterval(() => {
      if (isBearOnScreen) {
        // 二重のドクン、ドクン音
        playBeep(70, 0.1, 'sine');
        setTimeout(() => {
          playBeep(65, 0.12, 'sine');
        }, 150);
      }
    }, interval);

    return () => clearInterval(heartTimer);
  }, [bearDistance, isBearOnScreen, previewEncounter, isEscaped]);

  // 懐中電灯点滅演出 (バッテリー2分以下の場合)
  const [flickerState, setFlickerState] = useState(true);
  useEffect(() => {
    if (batteryMinutes <= 2 && flashlightOn) {
      const flickerTimer = setInterval(() => {
        setFlickerState(prev => {
          const next = Math.random() > 0.3;
          if (!next) {
            // パチパチというノイズ音のシミュレート
            playBeep(120, 0.05, 'triangle');
          }
          return next;
        });
      }, 300);
      return () => clearInterval(flickerTimer);
    } else {
      setFlickerState(true);
    }
  }, [batteryMinutes, flashlightOn]);

  const handleEncounterAction = (action: string) => {
    if (action === 'run' || action === 'dead') {
      setEncounterResult('GAME OVER (クマに襲われ、深い闇の中へ消え去った...)');
      playBeep(50, 1.0, 'sawtooth');
    } else if (action === 'spray') {
      if (activeItems.spray > 0) {
        // スプレー音（プシューッ）
        playBeep(400, 0.8, 'triangle');
        setActiveItems(prev => ({ ...prev, spray: prev.spray - 1 }));
        setEncounterResult('SUCCESS (スプレーを噴射して遠くへ追い払った！)');
        setTimeout(() => {
          setPreviewEncounter(false);
          setEncounterResult(null);
          setBearDistance(400); // 遠くに再配置
          setIsBearOnScreen(false);
        }, 2000);
      } else {
        setEncounterResult('NO SPRAY (スプレーを所持していません！)');
      }
    }
  };

  const useBell = () => {
    if (activeItems.bell > 0) {
      // 鈴の音（チリンチリン）
      playBeep(1200, 0.4, 'sine');
      setTimeout(() => {
        playBeep(1200, 0.5, 'sine');
      }, 150);
      setActiveItems(prev => ({ ...prev, bell: prev.bell - 1 }));
      setIsBearOnScreen(false); // 15秒間追跡を無効にする仕様
      setTimeout(() => {
        setIsBearOnScreen(true);
      }, 5000); // モックなので5秒後に再アクティブ
    }
  };

  const toggleSurvivor = (index: number) => {
    initAudio();
    const newSaved = [...savedSurvivors];
    const isNowSaved = !newSaved[index];
    newSaved[index] = isNowSaved;
    setSavedSurvivors(newSaved);
    if (isNowSaved) {
      playBeep(600, 0.15); // 救出成功音
      if (activeItems.map) {
        setShowMapModal(true);
        setActiveSafeRouteIndex(index);
        playBeep(880, 0.2); // 特別のルート検知シグナル音
      }
    } else {
      if (activeSafeRouteIndex === index) {
        setActiveSafeRouteIndex(null);
      }
    }
  };

  const getSurvivorCount = () => savedSurvivors.filter(Boolean).length;

  // 評価ランク判定
  const getClearRank = () => {
    const count = getSurvivorCount();
    if (count === 5) return { rank: 'S', name: '奇跡の生還者たち', desc: '5人全員を救出し、温かい朝日に包まれながら奇跡の生還を果たした！' };
    if (count >= 3) return { rank: 'A', name: '多くの命を救って', desc: '多数の遭難者を救助し、山を降りた。彼らから深い感謝が贈られた。' };
    if (count >= 1) return { rank: 'B', name: 'ほろ苦い生還', desc: '何人かは救えたものの、救い出せなかった命への後悔が胸を刺す。' };
    return { rank: 'C', name: '孤独な生還', desc: '自分だけは辛うじて生きて帰れたが、深い喪失感が一生消えることはない。' };
  };

  const handleEscape = () => {
    setIsEscaped(true);
    playBeep(880, 0.3);
    setTimeout(() => playBeep(1100, 0.5), 150);
  };

  const resetMock = () => {
    setPreviewEncounter(false);
    setEncounterResult(null);
    setActiveItems({ map: false, bell: 2, spray: 1 });
    setIsBearOnScreen(true);
    setBearDistance(250);
    setBatteryMinutes(10);
    setSavedSurvivors([false, false, false, false, false]);
    setStamina(100);
    setIsRunning(false);
    setIsStaminaExhausted(false);
    setIsEscaped(false);
    setIsGameStarted(false);
    setShowMapModal(false);
    setShowAllSignalMarkers(false);
    setActiveSafeRouteIndex(null);
  };

  // 懐中電灯の照射範囲（半径）の計算
  const getLightRadius = () => {
    if (!flashlightOn || !flickerState) return 0;
    if (batteryMinutes === 0) return 15; // 極小
    const percentage = batteryMinutes / 10;
    return Math.max(20, percentage * 120); // 120pxから徐々に縮小
  };

  // クマ接近警告メーターのアニメーション速度計算
  const getMeterAnimClass = () => {
    if (!isBearOnScreen) return 'animate-[pulse_2.5s_infinite]';
    if (bearDistance < 100) return 'animate-[ping_0.4s_infinite]';
    if (bearDistance < 250) return 'animate-[pulse_0.7s_infinite]';
    return 'animate-[pulse_1.5s_infinite]';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#d1d1d1] font-sans flex items-center justify-center p-4">
      {/* Editorial Outer Frame */}
      <div className="w-full max-w-[1250px] bg-[#0a0a0a] border-8 border-[#1a1a1a] flex flex-col overflow-hidden p-6 md:p-8 shadow-2xl">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-baseline border-b border-[#333] pb-4 mb-6">
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-serif italic text-[#8B0000] tracking-tighter flex items-center gap-2">
              <span>熊からの脱出</span>
              <span className="text-xs font-sans tracking-widest bg-[#8B0000]/15 text-[#ff4d4d] px-2 py-0.5 border border-[#8B0000]/30 rounded">
                仕様書 ＆ 動作シミュレーター
              </span>
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] mt-1 opacity-60">
              GAME DESIGN SPECIFICATION // PROJECT URSUS-01 // UPDATED VERSION
            </p>
          </div>
          <div className="mt-2 md:mt-0 flex items-center gap-4">
            <span className="text-[11px] font-mono bg-[#111] border border-[#333] px-2 py-1 text-[#ffcc00]">
              ROLE: PRO-GAME DESIGNER & PROGRAMMER
            </span>
            <span className="text-[11px] font-mono border border-[#444] px-2 py-1">
              REV: 1.1.0
            </span>
          </div>
        </header>

        {/* Main Content Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Spec Selector & Document Viewer */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Tab buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 border-b border-[#222] pb-4">
              {(Object.keys(specs) as Array<keyof typeof specs>).map((key) => {
                const SpecIcon = specs[key].icon;
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    id={`tab-btn-${key}`}
                    onClick={() => setActiveTab(key)}
                    className={`flex flex-col items-center justify-center p-2.5 border text-center transition-all ${
                      isActive 
                        ? 'bg-[#151515] border-[#8B0000] text-white shadow-lg shadow-[#8B0000]/10' 
                        : 'bg-transparent border-[#222] hover:border-[#444] text-[#888] hover:text-white'
                    }`}
                  >
                    <SpecIcon className={`w-4 h-4 mb-1 ${isActive ? 'text-[#8B0000]' : 'text-gray-500'}`} />
                    <span className="text-[10px] font-mono uppercase tracking-wider block truncate w-full">
                      {key}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Document Reader */}
            <div className="bg-[#0c0c0c] border border-[#222] p-6 rounded-sm min-h-[460px] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-[#222] pb-3 mb-4">
                  <span className="text-[10px] font-mono text-[#8B0000] uppercase tracking-widest">[DOCUMENT]</span>
                  <h2 className="text-lg font-serif font-semibold text-white">
                    {specs[activeTab].title}
                  </h2>
                </div>
                
                <div className="text-sm text-[#b5b5b5] font-sans leading-relaxed space-y-4 whitespace-pre-wrap max-h-[500px] overflow-y-auto pr-2">
                  {specs[activeTab].content}
                </div>
              </div>

              {/* Document Footer Hint */}
              <div className="mt-8 pt-4 border-t border-[#1a1a1a] flex justify-between items-center text-[10px] font-mono text-gray-500">
                <span>CONFIDENTIAL // GAME SPEC V1.1</span>
                <span>STATUS: FINALIZED</span>
              </div>
            </div>

            {/* Interactive Decision Matrix (Designer Workspace) */}
            <div className="bg-[#0d0d0d] border border-[#222] p-5 rounded-sm">
              <h3 className="text-xs font-mono text-[#ffcc00] uppercase mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> 仕様仮回答・検討用マトリクス（デザイナー用）
              </h3>
              <p className="text-[11px] text-[#888] mb-4">
                仕様書の不確定事項に対して現在確定されているデザイン設定です。
              </p>
              
              <div className="space-y-3 text-xs">
                {/* Q1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-2 border-b border-[#1a1a1a]">
                  <span className="font-medium text-white">1. フィールド「100倍」の定義:</span>
                  <div className="flex gap-2">
                    <button 
                      id="opt-size-a"
                      onClick={() => setAnswers(prev => ({ ...prev, fieldSize: 'A' }))}
                      className={`px-2 py-1 text-[10px] font-mono border rounded ${answers.fieldSize === 'A' ? 'bg-[#8B0000]/20 border-[#8B0000] text-white' : 'border-[#222] text-gray-400'}`}
                    >
                      A案 (面積100倍)
                    </button>
                    <button 
                      id="opt-size-b"
                      onClick={() => setAnswers(prev => ({ ...prev, fieldSize: 'B' }))}
                      className={`px-2 py-1 text-[10px] font-mono border rounded ${answers.fieldSize === 'B' ? 'bg-[#8B0000]/20 border-[#8B0000] text-white' : 'border-[#222] text-gray-400'}`}
                    >
                      B案 (縦横100倍)
                    </button>
                  </div>
                </div>

                {/* Q2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-2 border-b border-[#1a1a1a]">
                  <span className="font-medium text-white">2. 鈴の耐久度（2回）管理:</span>
                  <div className="flex gap-2">
                    <button 
                      id="opt-bell-a"
                      onClick={() => setAnswers(prev => ({ ...prev, bellUsage: 'A' }))}
                      className={`px-2 py-1 text-[10px] font-mono border rounded ${answers.bellUsage === 'A' ? 'bg-[#8B0000]/20 border-[#8B0000] text-white' : 'border-[#222] text-gray-400'}`}
                    >
                      A案 (鈴個別に耐久2)
                    </button>
                    <button 
                      id="opt-bell-b"
                      onClick={() => setAnswers(prev => ({ ...prev, bellUsage: 'B' }))}
                      className={`px-2 py-1 text-[10px] font-mono border rounded ${answers.bellUsage === 'B' ? 'bg-[#8B0000]/20 border-[#8B0000] text-white' : 'border-[#222] text-gray-400'}`}
                    >
                      B案 (全体回数に+2)
                    </button>
                  </div>
                </div>

                {/* Q3 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-2 border-b border-[#1a1a1a]">
                  <span className="font-medium text-white">3. クマの追跡条件（ヘイト）:</span>
                  <div className="flex gap-2">
                    <button 
                      id="opt-sight-a"
                      onClick={() => setAnswers(prev => ({ ...prev, bearSight: 'A' }))}
                      className={`px-2 py-1 text-[10px] font-mono border rounded ${answers.bearSight === 'A' ? 'bg-[#8B0000]/20 border-[#8B0000] text-white' : 'border-[#222] text-gray-400'}`}
                    >
                      A: 画面に入ったら即
                    </button>
                    <button 
                      id="opt-sight-b"
                      onClick={() => setAnswers(prev => ({ ...prev, bearSight: 'B' }))}
                      className={`px-2 py-1 text-[10px] font-mono border rounded ${answers.bearSight === 'B' ? 'bg-[#8B0000]/20 border-[#8B0000] text-white' : 'border-[#222] text-gray-400'}`}
                    >
                      B: 懐中電灯の光のみ
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Interactive Mock, Equipment, Tips */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Interactive Visual Canvas Mock (Nightfall Beast Engine Simulator) */}
            <div className="flex flex-col">
              <h2 className="text-[11px] font-mono text-[#8B0000] uppercase mb-2 tracking-wider flex items-center justify-between">
                <span>[VISUAL SIMULATOR] 仕様挙動シミュレーター</span>
                <span className="text-[9px] opacity-60 text-gray-400">Audio/Logic Realtime</span>
              </h2>

              <div className="relative bg-[#020202] border-2 border-[#333] w-full aspect-[960/544] overflow-hidden shadow-2xl rounded-sm">
                
                {!isGameStarted ? (
                  /* ゲーム開始画面オーバーレイ */
                  <div className="absolute inset-0 bg-[#070707] bg-gradient-to-b from-[#0e0202] to-[#050505] p-5 flex flex-col justify-between overflow-y-auto text-gray-300">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center border-b border-[#8B0000]/40 pb-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-[#8B0000] tracking-[0.2em] font-bold">=== SIMULATOR START SCREEN ===</span>
                      <span className="text-[9px] font-mono text-[#ffcc00] animate-pulse">PRESS START TO INITIATE</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 my-3 space-y-4 pr-1">
                      
                      {/* あらすじ */}
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-mono text-[#8B0000] font-bold uppercase tracking-wider flex items-center gap-1">
                          <span>◆</span> あらすじ (STORY)
                        </h4>
                        <p className="text-[11.5px] leading-relaxed text-zinc-300 pl-3 border-l border-zinc-800">
                          闇夜の雪山で遭難したあなた。周囲の静寂を破るように、周囲には凶暴な「人喰いグマ」が徘徊している。
                          懐中電灯のバッテリーが完全に尽きる10分という極限の制限時間の中、フィールドを探索し、
                          散らばるアイテムを駆使して他の生存者たちを助け出し、この絶望の雪山から生還せよ。
                        </p>
                      </div>

                      {/* クリア条件 */}
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-mono text-[#8B0000] font-bold uppercase tracking-wider flex items-center gap-1">
                          <span>◆</span> クリア条件 (CLEAR CONDITIONS)
                        </h4>
                        <div className="text-[11px] text-zinc-300 pl-3 space-y-1 list-none border-l border-zinc-800">
                          <div className="flex items-start gap-1">
                            <span className="text-amber-500 font-bold">1.</span>
                            <span>フィールド上に配置されている最重要アイテム「地図」を発見・獲得する。</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="text-amber-500 font-bold">2.</span>
                            <span>地図獲得により視覚化される「山の脱出口（EXIT）」に到達する。</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="text-emerald-500 font-bold">★</span>
                            <span className="text-zinc-400">【マルチエンディング】：救出した生存者（0〜5人）の数により、脱出時のクリアランク（S〜C）とエンディングが変わります。</span>
                          </div>
                        </div>
                      </div>

                      {/* アイテム説明 */}
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-mono text-[#8B0000] font-bold uppercase tracking-wider flex items-center gap-1">
                          <span>◆</span> 主要アイテム (ITEMS)
                        </h4>
                        <div className="grid grid-cols-3 gap-2 pl-3">
                          <div className="bg-black/40 border border-zinc-800 p-1.5 rounded-sm flex flex-col justify-between">
                            <div className="flex items-center gap-1 font-bold text-[10px] text-white">
                              <span>🗺️</span> <span>地図 (MAP)</span>
                            </div>
                            <span className="text-[9px] text-zinc-400 mt-0.5 leading-tight">出現数: 1個。脱出口の特定と全体マップを表示可能にする最重要キーアイテム。</span>
                          </div>
                          <div className="bg-black/40 border border-zinc-800 p-1.5 rounded-sm flex flex-col justify-between">
                            <div className="flex items-center gap-1 font-bold text-[10px] text-white">
                              <span>🔔</span> <span>鈴 (BELL)</span>
                            </div>
                            <span className="text-[9px] text-zinc-400 mt-0.5 leading-tight">出現数: 3個。鳴らすと一時的にクマの追跡を無効化。ただし耐久は2回まで。</span>
                          </div>
                          <div className="bg-black/40 border border-zinc-800 p-1.5 rounded-sm flex flex-col justify-between">
                            <div className="flex items-center gap-1 font-bold text-[10px] text-white">
                              <span>💨</span> <span>スプレー (SPRAY)</span>
                            </div>
                            <span className="text-[9px] text-zinc-400 mt-0.5 leading-tight">出現数: 3個。戦闘時専用。1個消費してクマを遠くへ強制退散（ワープ）させる防衛策。</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Action Button */}
                    <div className="flex justify-center pt-2 border-t border-zinc-900 shrink-0">
                      <button
                        id="start-simulation-btn"
                        onClick={() => {
                          initAudio();
                          setIsGameStarted(true);
                          playBeep(600, 0.3);
                        }}
                        className="px-8 py-2.5 bg-[#8B0000] hover:bg-[#a00000] active:scale-95 text-white font-mono text-xs font-bold tracking-widest uppercase border border-[#ff4d4d]/30 hover:border-[#ff4d4d]/60 rounded shadow-[0_0_15px_rgba(139,0,0,0.5)] transition-all cursor-pointer"
                      >
                        シミュレーションを開始する (START)
                      </button>
                    </div>

                  </div>
                ) : isEscaped ? (
                  /* 脱出エンディングシミュレート画面 */
                  <div className="absolute inset-0 bg-[#070907] p-6 flex flex-col justify-between items-center text-center">
                    <div className="w-full border-b border-emerald-800/40 pb-2">
                      <span className="text-[10px] font-mono text-[#00ff66] tracking-[0.2em]">=== SURVIVAL COMPLETED ===</span>
                    </div>

                    <div className="my-auto space-y-4">
                      <div className="inline-block px-4 py-2 bg-emerald-950/40 border-2 border-emerald-500 rounded-lg text-emerald-400">
                        <span className="text-xs font-mono uppercase block">Clear Evaluation</span>
                        <span className="text-4xl font-serif italic font-bold">Rank {getClearRank().rank}</span>
                      </div>
                      
                      <h3 className="text-lg font-bold text-white font-serif">{getClearRank().name}</h3>
                      <p className="text-xs text-gray-300 max-w-[340px] leading-relaxed">
                        {getClearRank().desc}
                      </p>
                      
                      <div className="text-[10px] font-mono text-gray-400">
                        救出した遭難者: {getSurvivorCount()} / 5 人
                      </div>
                    </div>

                    <button
                      id="ending-back-btn"
                      onClick={resetMock}
                      className="px-4 py-1.5 bg-[#111] border border-[#333] hover:border-emerald-500 hover:text-white text-[10px] font-mono transition-all rounded"
                    >
                      もう一度検証する
                    </button>
                  </div>
                ) : previewEncounter ? (
                  /* 戦闘コマンド画面モック */
                  <div className="absolute inset-0 bg-gradient-to-b from-[#110101] to-[#050000] p-4 flex flex-col justify-between">
                    {/* Header */}
                    <div className="flex justify-between items-center border-b border-[#8B0000]/40 pb-2">
                      <span className="text-[10px] font-mono text-[#ffcc00] animate-pulse">!! BEAST CONTACTED !!</span>
                      <span className="text-[9px] font-mono text-gray-400">熊との遭遇・戦闘画面</span>
                    </div>

                    {/* Combat Arena (Center) */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                      {/* 恐ろしいクマのドット調アイコン */}
                      <div className="w-16 h-16 bg-[#1f0505] border-2 border-[#8B0000] flex flex-col items-center justify-center rounded-sm relative shadow-[0_0_15px_rgba(139,0,0,0.6)]">
                        <div className="flex justify-between w-8 mt-2">
                          <div className="w-3 h-3 bg-red-600 rounded-sm animate-ping"></div>
                          <div className="w-3 h-3 bg-red-600 rounded-sm animate-ping"></div>
                        </div>
                        <span className="text-[8px] font-mono text-white mt-1 uppercase">URSUS</span>
                        <div className="absolute top-1 left-1 text-[7px] text-[#ffcc00] font-mono">[!]</div>
                      </div>
                      <p className="text-xs font-serif italic text-red-500 tracking-wider">
                        「目の前に異形のクマが立ち塞がっている...」
                      </p>
                      
                      {encounterResult && (
                        <div className="mt-1 px-3 py-1 bg-black/80 border border-[#8B0000] text-[10px] text-[#ffcc00] font-mono text-center max-w-[280px]">
                          {encounterResult}
                        </div>
                      )}
                    </div>

                    {/* Actions Panel */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#8B0000]/40">
                      <button 
                        id="combat-btn-run"
                        onClick={() => handleEncounterAction('run')}
                        className="py-1.5 bg-[#8B0000]/30 hover:bg-[#8B0000] border border-[#8B0000] text-[9px] font-mono uppercase text-white tracking-wider rounded transition-all"
                      >
                        走って逃げる
                      </button>
                      <button 
                        id="combat-btn-dead"
                        onClick={() => handleEncounterAction('dead')}
                        className="py-1.5 bg-[#222] hover:bg-[#333] border border-[#444] text-[9px] font-mono uppercase text-white tracking-wider rounded transition-all"
                      >
                        死んだふり
                      </button>
                      <button 
                        id="combat-btn-spray"
                        disabled={activeItems.spray <= 0}
                        onClick={() => handleEncounterAction('spray')}
                        className={`py-1.5 border text-[9px] font-mono uppercase tracking-wider rounded transition-all ${
                          activeItems.spray > 0 
                            ? 'bg-gradient-to-r from-amber-900 to-amber-700 hover:from-amber-800 hover:to-amber-600 border-[#ffcc00] text-white' 
                            : 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        スプレーを使う ({activeItems.spray})
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 探索画面モック */
                  <>
                    {/* Dark map background overlay simulating flashlight and battery degradation */}
                    <div 
                      className="absolute inset-0 transition-all duration-300" 
                      style={{
                        background: flashlightOn 
                          ? `radial-gradient(circle at 45% 55%, transparent ${getLightRadius() * 0.4}px, rgba(0,0,0,${Math.min(0.99, 0.95 + (1 - batteryMinutes / 10) * 0.04)}) ${getLightRadius()}px)` 
                          : 'rgba(0,0,0,0.99)'
                      }}
                    ></div>

                    {/* Grid pixel lines */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
                      backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                      backgroundSize: '16px 16px'
                    }}></div>

                    {/* Exit Gate (Map must be acquired) */}
                    {activeItems.map && (
                      <button 
                        id="escape-gate"
                        onClick={handleEscape}
                        className="absolute right-10 top-12 flex flex-col items-center group cursor-pointer"
                      >
                        <div className="w-7 h-7 border-2 border-emerald-500 bg-emerald-950/40 flex items-center justify-center rounded-sm text-emerald-400 text-[8px] font-mono font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse">EXIT</div>
                        <span className="text-[7px] text-emerald-400 font-mono mt-1">脱出口をクリック</span>
                      </button>
                    )}

                    {/* Character (Player) with custom dash state */}
                    <div className="absolute left-[45%] top-[55%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                      <div className={`w-6 h-6 border flex items-center justify-center rounded-sm transition-all duration-100 ${
                        isRunning 
                          ? 'bg-amber-950/50 border-amber-400 scale-110 shadow-[0_0_8px_rgba(251,191,36,0.6)]' 
                          : 'bg-[#444] border-white'
                      }`}>
                        <span className="text-[8px] font-mono text-white">{isRunning ? "RUN" : "P"}</span>
                      </div>
                      <span className="text-[7px] text-gray-400 font-mono mt-1">
                        {isRunning ? "移動速度160%" : "通常移動"}
                      </span>
                    </div>

                    {/* Map Item Pickable */}
                    {!activeItems.map && (
                      <button 
                        id="mock-map-item"
                        onClick={() => {
                          initAudio();
                          setActiveItems(prev => ({ ...prev, map: true }));
                          playBeep(440, 0.2);
                        }}
                        className="absolute right-1/3 top-1/4 group cursor-pointer"
                      >
                        <div className="w-4 h-4 bg-amber-950/60 border border-amber-400 flex items-center justify-center rounded-sm animate-pulse">
                          <span className="text-[8px] text-[#ffcc00] font-mono">M</span>
                        </div>
                        <span className="hidden group-hover:block absolute top-6 -left-4 bg-black border border-amber-400 text-[8px] px-1 py-0.5 text-[#ffcc00] whitespace-nowrap">地図（クリック取得）</span>
                      </button>
                    )}

                    {/* Bear Enemy (Ursus) - Toggle state */}
                    {isBearOnScreen && (
                      <button
                        id="mock-bear-enemy"
                        onClick={() => {
                          initAudio();
                          setPreviewEncounter(true);
                        }}
                        className="absolute transition-all duration-300 group cursor-pointer"
                        style={{
                          right: `${30 + (bearDistance / 15)}%`,
                          top: '35%'
                        }}
                      >
                        <div className="w-10 h-10 bg-[#300] border-2 border-[#800] rounded-sm flex flex-col items-center justify-center shadow-[0_0_15px_rgba(139,0,0,0.5)]">
                          <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></div>
                          <span className="text-[6px] text-red-500 font-mono mt-1">BEAR</span>
                        </div>
                        <span className="hidden group-hover:block absolute top-12 -left-6 bg-black border border-red-800 text-[8px] px-1.5 py-0.5 text-red-500 whitespace-nowrap">戦闘突入（接触）</span>
                      </button>
                    )}

                    {/* HUD / Items Counter */}
                    <div className="absolute bottom-3 left-3 flex gap-2 text-[8px] font-mono uppercase">
                      <div className="bg-black/80 px-2 py-0.5 border border-[#333] text-gray-300">
                        Bell: {activeItems.bell > 0 ? `0${activeItems.bell}` : "EMPTY"}
                      </div>
                      <div className="bg-black/80 px-2 py-0.5 border border-[#333] text-gray-300">
                        Spray: {activeItems.spray > 0 ? `0${activeItems.spray}` : "EMPTY"}
                      </div>
                      {activeItems.map && (
                        <button
                          id="hud-toggle-map-btn"
                          onClick={() => {
                            initAudio();
                            setShowMapModal(prev => !prev);
                            playBeep(520, 0.15);
                          }}
                          className={`px-2 py-0.5 border text-[8px] font-mono rounded cursor-pointer transition-all duration-150 uppercase flex items-center gap-1 ${
                            showMapModal 
                              ? 'bg-[#ffcc00] text-black border-[#ffcc00] font-bold' 
                              : 'bg-black/80 text-[#ffcc00] border-[#ffcc00]/50 hover:border-[#ffcc00] hover:bg-black/95'
                          }`}
                        >
                          <MapIcon className="w-2.5 h-2.5" />
                          <span>簡易マップ [R]</span>
                        </button>
                      )}
                    </div>

                    {/* Threat indicator and Quick lights toggle */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <button 
                        id="toggle-flashlight"
                        onClick={() => {
                          initAudio();
                          setFlashlightOn(!flashlightOn);
                          playBeep(500, 0.05);
                        }}
                        className="bg-black/80 border border-gray-600 hover:border-white px-2 py-1 text-[8px] font-mono text-gray-300 rounded"
                      >
                        LIGHT: {flashlightOn ? "ON" : "OFF"}
                      </button>
                      <span className="bg-black/80 border border-gray-600 px-2 py-1 text-[8px] font-mono text-[#ffcc00] rounded">
                        BATTERY: {batteryMinutes} MIN
                      </span>
                    </div>

                    {/* Dynamic Threat Warning / Pulse warning */}
                    {isBearOnScreen && (
                      <div className="absolute top-3 right-3 bg-[#8B0000] text-white px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase animate-pulse">
                        Threat Detected
                      </div>
                    )}

                    {/* NEW: クマ接近警告メーター（画面右下UI） */}
                    <div className="absolute bottom-3 right-3 flex flex-col items-end">
                      <div className="bg-black/90 border border-[#333] p-1.5 rounded flex items-center gap-1.5 shadow-lg">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-300 ${
                          isBearOnScreen ? 'bg-red-950/60 border border-red-500 text-red-500' : 'bg-zinc-800 border border-zinc-700 text-zinc-500'
                        } ${getMeterAnimClass()}`}>
                          <Heart className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <div className="flex flex-col text-[7px] font-mono leading-tight">
                          <span className={isBearOnScreen ? 'text-red-400 font-bold' : 'text-zinc-500'}>
                            {isBearOnScreen ? 'APPROACH METER' : 'STANDBY (NO SIGNAL)'}
                          </span>
                          <span className="text-zinc-400">
                            {isBearOnScreen ? `DISTANCE: ${bearDistance}M` : 'SAFE'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tactical Map Overlay */}
                    {showMapModal && activeItems.map && (
                      <div className="absolute inset-0 bg-[#040e06]/95 border-2 border-[#10b981]/50 p-4 flex flex-col justify-between text-[#10b981] font-mono z-20 animate-fade-in">
                        
                        {/* Map Header */}
                        <div className="flex justify-between items-center border-b border-[#10b981]/30 pb-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider">
                            <MapIcon className="w-3.5 h-3.5 animate-pulse" />
                            <span>GPS RADAR SYSTEM v1.1.0</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-[8px] cursor-pointer hover:text-white select-none">
                              <input 
                                type="checkbox"
                                checked={showAllSignalMarkers}
                                onChange={(e) => setShowAllSignalMarkers(e.target.checked)}
                                className="accent-[#10b981] cursor-pointer"
                              />
                              <span>全生存者シグナル表示 (Dev)</span>
                            </label>
                            <button
                              id="close-map-overlay-btn"
                              onClick={() => {
                                initAudio();
                                setShowMapModal(false);
                                playBeep(440, 0.1);
                              }}
                              className="px-2 py-0.5 border border-[#10b981] hover:bg-[#10b981]/20 text-[9px] uppercase font-bold tracking-wide rounded cursor-pointer transition-colors"
                            >
                              閉じる [R]
                            </button>
                          </div>
                        </div>

                        {/* Map Grid Area */}
                        <div className="flex-1 relative my-2 bg-black/85 border border-[#10b981]/20 rounded-sm overflow-hidden">
                          {/* Grid Overlay */}
                          <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                            backgroundImage: `
                              linear-gradient(to right, #10b981 1px, transparent 1px),
                              linear-gradient(to bottom, #10b981 1px, transparent 1px)
                            `,
                            backgroundSize: '10% 10%'
                          }}></div>

                          {/* Radar Scanline overlay */}
                          <div className="absolute inset-0 bg-gradient-to-b from-[#10b981]/5 via-transparent to-transparent bg-[length:100%_4px] opacity-20 pointer-events-none"></div>

                          {/* 1. Plot current location (P) */}
                          <div 
                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                            style={{ left: '45%', top: '55%' }}
                          >
                            <div className="w-3.5 h-3.5 bg-blue-500 border border-white rounded-full flex items-center justify-center text-white text-[8px] font-bold shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse">
                              P
                            </div>
                            <span className="text-[7px] text-blue-400 font-bold whitespace-nowrap mt-0.5 bg-black/80 px-1 border border-blue-500/30 rounded-sm">現在地 (YOU)</span>
                          </div>

                          {/* 2. Plot escape exit (EXIT) */}
                          <div 
                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                            style={{ left: '90%', top: '12%' }}
                          >
                            <div className="w-3.5 h-3.5 bg-emerald-500 border border-white rounded-sm flex items-center justify-center text-white text-[8px] font-bold shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-[ping_1.5s_infinite]">
                              🚪
                            </div>
                            <span className="text-[7px] text-emerald-400 font-bold whitespace-nowrap mt-0.5 bg-black/80 px-1 border border-emerald-500/30 rounded-sm">脱出口 (EXIT)</span>
                          </div>

                          {/* 3. Plot survivors */}
                          {SURVIVOR_COORDS.map((survivor, idx) => {
                            const isSaved = savedSurvivors[idx];
                            // Render if saved, OR if developer showAllSignalMarkers is checked
                            if (isSaved || showAllSignalMarkers) {
                              const isCurrentRoute = activeSafeRouteIndex === idx;
                              return (
                                <button 
                                  key={idx}
                                  onClick={() => {
                                    if (isSaved) {
                                      initAudio();
                                      setActiveSafeRouteIndex(isCurrentRoute ? null : idx);
                                      playBeep(isCurrentRoute ? 440 : 720, 0.12);
                                    }
                                  }}
                                  disabled={!isSaved}
                                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 transition-all ${
                                    isSaved 
                                      ? 'hover:scale-110 active:scale-95 cursor-pointer' 
                                      : 'opacity-50 cursor-not-allowed'
                                  }`}
                                  style={{ left: `${survivor.x}%`, top: `${survivor.y}%` }}
                                  title={isSaved ? "クリックで安全脱出ルートをマップ表示" : survivor.name}
                                >
                                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold border border-white shadow-lg transition-colors ${
                                    isSaved 
                                      ? isCurrentRoute
                                        ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,1)] animate-none'
                                        : 'bg-emerald-500 text-black animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' 
                                      : 'bg-zinc-700 text-zinc-400 border-dashed animate-none'
                                  }`}>
                                    {idx + 1}
                                  </div>
                                  <span className={`text-[7px] font-bold whitespace-nowrap mt-0.5 bg-black/80 px-1 rounded-sm border transition-colors ${
                                    isSaved 
                                      ? isCurrentRoute
                                        ? 'text-amber-400 border-amber-500/50'
                                        : 'text-emerald-400 border-emerald-500/30' 
                                      : 'text-zinc-500 border-zinc-700'
                                  }`}>
                                    {survivor.name} {isSaved ? isCurrentRoute ? '(ルート表示中)' : '(救出済)' : '(未救助シグナル)'}
                                  </span>
                                </button>
                              );
                            }
                            return null;
                          })}

                          {/* 4. Safe Route Path (SVG Line) from rescued survivor to Exit */}
                          {activeSafeRouteIndex !== null && SURVIVOR_COORDS[activeSafeRouteIndex] && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                              {/* Glowing bottom path */}
                              <line 
                                x1={SURVIVOR_COORDS[activeSafeRouteIndex].x} 
                                y1={SURVIVOR_COORDS[activeSafeRouteIndex].y} 
                                x2={90} 
                                y2={12} 
                                stroke="#f59e0b" 
                                strokeWidth="1.2" 
                                strokeLinecap="round"
                                strokeDasharray="3 3"
                                strokeOpacity="0.6"
                                className="animate-pulse"
                              />
                              {/* Sharp core line */}
                              <line 
                                x1={SURVIVOR_COORDS[activeSafeRouteIndex].x} 
                                y1={SURVIVOR_COORDS[activeSafeRouteIndex].y} 
                                x2={90} 
                                y2={12} 
                                stroke="#fbbf24" 
                                strokeWidth="0.5" 
                                strokeLinecap="round"
                                strokeDasharray="1 1"
                              />
                            </svg>
                          )}

                          {/* Active Route HUD Toast */}
                          {activeSafeRouteIndex !== null && SURVIVOR_COORDS[activeSafeRouteIndex] && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[8px] px-2.5 py-1 rounded shadow-lg flex items-center gap-1.5 animate-pulse z-20">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>{SURVIVOR_COORDS[activeSafeRouteIndex].name}の助言: 脱出口への安全ルートを表示中 (10秒限定)</span>
                            </div>
                          )}

                          {/* Compass Rose accent */}
                          <div className="absolute right-3 bottom-3 opacity-30 text-[10px] flex flex-col items-center">
                            <Compass className="w-5 h-5 animate-[spin_30s_linear_infinite]" />
                            <span className="text-[5px] tracking-widest mt-0.5">NORTH</span>
                          </div>

                          {/* Coordinates Grid labels */}
                          <span className="absolute left-2 top-2 text-[7px] text-[#10b981]/50">[SECTOR-01]</span>
                          <span className="absolute right-2 top-2 text-[7px] text-[#10b981]/50">9,600 x 5,440 PX</span>
                        </div>

                        {/* Map Footer & Legend */}
                        <div className="flex justify-between items-center text-[8px] border-t border-[#10b981]/30 pt-1.5 shrink-0">
                          <div className="flex gap-3 items-center">
                            <span className="font-bold text-gray-400">凡例:</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span> 現在地 (P)</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-emerald-500 inline-block font-mono">🚪</span> 脱出口</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> 救出済生存者</span>
                            <span className="flex items-center gap-1 opacity-60"><span className="w-1.5 h-1.5 rounded-full bg-zinc-700 inline-block border border-dashed border-white"></span> 未発見 (Dev)</span>
                          </div>
                          <span className="text-gray-400">※ 生存者を救出するとGPS信号が同期し、自動的にマップにプロットされます。</span>
                        </div>

                      </div>
                    )}
                  </>
                )}

              </div>
              
              {/* Simulator instruction notes */}
              <div className="mt-2 text-[10px] font-mono text-gray-500 flex justify-between items-center px-1">
                <span>※ 懐中電灯/生存者などの設定、Shiftキー（ダッシュ）などを下部パネルで操作できます。</span>
                <button 
                  id="reset-mock-btn"
                  onClick={resetMock}
                  className="text-[#ffcc00] hover:underline flex items-center gap-0.5"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> リセット
                </button>
              </div>
            </div>

            {/* NEW: 探索パラメータ・仕様コントロールパネル */}
            <div className="bg-[#0b0b0b] border border-[#222] p-4 rounded-sm space-y-4">
              <h3 className="text-xs font-mono text-[#ffcc00] uppercase tracking-widest border-b border-[#222] pb-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> リアルタイム仕様コントロール（挙動確認用）
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                
                {/* Stamina & Dash Simulator */}
                <div className="space-y-2 bg-[#0f0f0f] p-2.5 border border-[#1f1f1f] rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-300">スタミナ & 走る (Shiftキー)</span>
                    <span className="font-mono text-[10px] text-amber-400">{Math.round(stamina)}%</span>
                  </div>
                  {/* Visual Stamina Bar */}
                  <div className="w-full bg-zinc-900 h-2 rounded overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-100 ${
                        isStaminaExhausted ? 'bg-red-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${stamina}%` }}
                    ></div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      id="dash-toggle-btn"
                      disabled={isStaminaExhausted}
                      onMouseDown={() => { initAudio(); setIsRunning(true); }}
                      onMouseUp={() => setIsRunning(false)}
                      onMouseLeave={() => setIsRunning(false)}
                      className={`flex-1 py-1 text-[10px] font-mono border rounded ${
                        isRunning 
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300' 
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      走るボタン (長押し)
                    </button>
                    {isStaminaExhausted && (
                      <span className="text-[9px] text-red-500 font-bold self-center animate-pulse">スタミナ切れ!</span>
                    )}
                  </div>
                </div>

                {/* Flashlight Battery Simulator */}
                <div className="space-y-2 bg-[#0f0f0f] p-2.5 border border-[#1f1f1f] rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-300">懐中電灯寿命 (制限10分)</span>
                    <span className="font-mono text-[10px] text-amber-400">{batteryMinutes} 分</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    value={batteryMinutes}
                    onChange={(e) => {
                      initAudio();
                      setBatteryMinutes(parseInt(e.target.value));
                    }}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-[9px] text-gray-400 leading-tight">
                    {batteryMinutes <= 2 ? (
                      <span className="text-red-400 font-bold">2分以下: 光が明滅し、ジジッと電気ノイズ音が発生中</span>
                    ) : (
                      <span>スライダーで残り時間を変更し、光の照射範囲（半径）の減少を確認</span>
                    )}
                  </div>
                </div>

                {/* Bear Distance & Heartbeat Radar */}
                <div className="space-y-2 bg-[#0f0f0f] p-2.5 border border-[#1f1f1f] rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-300">クマとの直線距離 & 心音</span>
                    <span className="font-mono text-[10px] text-red-500">{isBearOnScreen ? `${bearDistance}M` : '検知不能'}</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="500" 
                    value={bearDistance}
                    disabled={!isBearOnScreen}
                    onChange={(e) => {
                      initAudio();
                      setBearDistance(parseInt(e.target.value));
                    }}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer disabled:opacity-30"
                  />
                  <div className="flex gap-2 justify-between">
                    <button
                      onClick={() => {
                        initAudio();
                        setIsBearOnScreen(!isBearOnScreen);
                        playBeep(300, 0.1);
                      }}
                      className={`px-2 py-0.5 text-[9px] font-mono border rounded ${
                        isBearOnScreen ? 'border-red-800 bg-red-950/20 text-red-400' : 'border-zinc-700 text-zinc-500'
                      }`}
                    >
                      クマ画面内出現: {isBearOnScreen ? 'ON (赤点滅)' : 'OFF (グレー)'}
                    </button>
                    <span className="text-[8px] text-zinc-500 self-center">
                      ※ 距離が近いほど、鼓動アニメ・心音テンポが加速
                    </span>
                  </div>
                </div>

                {/* Survivor Rescue Multi-Ending Tracker */}
                <div className="space-y-2 bg-[#0f0f0f] p-2.5 border border-[#1f1f1f] rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-300">生存者救出 (マルチ分岐)</span>
                    <span className="font-mono text-[10px] text-emerald-400">救出: {getSurvivorCount()} / 5人</span>
                  </div>
                  <div className="flex gap-1 justify-between">
                    {savedSurvivors.map((saved, idx) => (
                      <button
                        key={idx}
                        id={`survivor-${idx}`}
                        onClick={() => toggleSurvivor(idx)}
                        className={`w-6 h-6 text-[10px] font-mono border rounded flex items-center justify-center transition-all ${
                          saved 
                            ? 'bg-emerald-950/50 border-emerald-500 text-emerald-400 font-bold' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                        }`}
                        title={`生存者 ${idx + 1}`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-zinc-400 leading-tight">
                    生存者の数により脱出時の評価分岐（S/A/B/C）が確定します。
                  </p>
                </div>

              </div>

              {/* Sound Action SE Simulator buttons */}
              <div className="pt-2 border-t border-[#1f1f1f] flex flex-wrap gap-2 items-center justify-between text-xs">
                <span className="font-bold text-gray-400">サウンドSEデモ:</span>
                <div className="flex gap-1.5">
                  <button 
                    onClick={useBell}
                    disabled={activeItems.bell <= 0}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-[#ffcc00] border border-zinc-700 text-[10px] rounded"
                  >
                    🔔 鈴を使用 (チリンx2)
                  </button>
                  <button 
                    onClick={() => {
                      initAudio();
                      playBeep(350, 0.7, 'triangle'); // スプレー噴射音
                    }}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-500 border border-zinc-700 text-[10px] rounded"
                  >
                    💨 スプレー噴射
                  </button>
                  <button 
                    onClick={() => {
                      initAudio();
                      playBeep(100, 0.08, 'sawtooth'); // ノイズ
                      setTimeout(() => playBeep(120, 0.05, 'sawtooth'), 100);
                    }}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-zinc-700 text-[10px] rounded"
                  >
                    ⚡ 電灯ノイズ音
                  </button>
                </div>
              </div>
            </div>

            {/* Equipment & Items section */}
            <section className="bg-[#0b0b0b] border border-[#222] p-5 rounded-sm">
              <h3 className="text-xs font-mono text-[#8B0000] uppercase mb-4 tracking-widest border-b border-[#222] pb-2">
                [02] アイテム一覧 & キーアサイン
              </h3>
              <div className="space-y-4">
                
                {/* Map */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-[#151515] border border-[#333] flex items-center justify-center font-mono text-[#ffcc00] text-xs shrink-0 rounded-sm">
                    MAP
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase flex items-center justify-between">
                      <span>地図 (Map)</span>
                      <span className="text-[9px] font-mono bg-black border border-[#333] px-1 text-gray-500">[Rキー / クリック取得]</span>
                    </h4>
                    <p className="text-[11px] text-[#999] mt-0.5">
                      フィールドに1個のみ配置。獲得すると全体マップが表示され、脱出口の位置が明らかになる、ゲームクリアの鍵。
                    </p>
                  </div>
                </div>

                {/* Bell */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-[#151515] border border-[#333] flex items-center justify-center font-mono text-[#ffcc00] text-xs shrink-0 rounded-sm">
                    BELL
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase flex items-center justify-between">
                      <span>鈴 (Bell)</span>
                      <span className="text-[9px] font-mono bg-black border border-[#333] px-1 text-gray-500">[Fキー / 5秒間追跡無効]</span>
                    </h4>
                    <p className="text-[11px] text-[#999] mt-0.5">
                      フィールドに3個配置。鳴らすことで一時的にクマを遠ざけるが、錆びやすいため2回使うと壊れてしまう。
                    </p>
                  </div>
                </div>

                {/* Spray */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-[#151515] border border-[#333] flex items-center justify-center font-mono text-[#ffcc00] text-xs shrink-0 rounded-sm">
                    SPRAY
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase flex items-center justify-between">
                      <span>熊撃退スプレー</span>
                      <span className="text-[9px] font-mono bg-black border border-[#333] px-1 text-gray-500">[戦闘時に使用可能]</span>
                    </h4>
                    <p className="text-[11px] text-[#999] mt-0.5">
                      フィールドに3個配置。クマに接触して戦闘に入った際、1個消費してクマを吹き飛ばし、遠くに再配置させる唯一の防衛策。
                    </p>
                  </div>
                </div>

              </div>
            </section>

            {/* Survivor Tips */}
            <section className="bg-[#0b0b0b] border border-[#222] p-5 rounded-sm">
              <h3 className="text-xs font-mono text-[#8B0000] uppercase mb-3 tracking-widest">
                [03] 生存へのアドバイス（遭難者達の言葉）
              </h3>
              <p className="text-[10px] text-gray-500 mb-3">
                フィールドに存在する5人の生存者から、救出対話時に得られる、生き残るためのヒントです。
              </p>
              <div className="bg-[#0f0f0f] p-3 italic text-[11px] border-l-2 border-[#8B0000] space-y-3 text-[#aaa]">
                <p className="relative pl-3">
                  <span className="text-[#8B0000] font-bold absolute left-0 font-serif">“</span>
                  「遠くにいる時は静かにその場を去る方がいい」
                </p>
                <p className="relative pl-3">
                  <span className="text-[#8B0000] font-bold absolute left-0 font-serif">“</span>
                  「近くにいる時は熊を見ながらゆっくり後退して！興奮させないのが一番だよ」
                </p>
                <p className="relative pl-3">
                  <span className="text-[#8B0000] font-bold absolute left-0 font-serif">“</span>
                  「鈴はクマが寄ってこなくなるがすぐに錆びてしまうため、長くは使えない。」
                </p>
              </div>
            </section>

          </div>

        </main>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-[#333] flex flex-col md:flex-row justify-between items-center text-[9px] uppercase tracking-widest text-gray-600 gap-2">
          <span>Environment Setup: 96,000 x 54,400 Pixel Grid</span>
          <span>Top-down Survival Horror Design Docs with Interactive Simulator</span>
          <span>© 2026 pixel-horror development unit</span>
        </footer>

      </div>
    </div>
  );
}
