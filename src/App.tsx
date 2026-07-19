import React, { useState, useEffect, useRef } from 'react';
import { GameEngine } from './gameEngine';
import { 
  Compass, 
  Map as MapIcon, 
  Flame, 
  Volume2, 
  RotateCcw,
  Sparkles,
  Info,
  Zap,
  Heart
} from 'lucide-react';

interface PixelArtImageProps {
  src: string;
  alt: string;
  className?: string;
  pixelSize?: number;
}

function PixelArtImage({ src, alt, className, pixelSize = 5 }: PixelArtImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.src = src;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = img.width || 256;
      const height = img.height || 144;
      canvas.width = width;
      canvas.height = height;

      // 低解像度オフスクリーンに縮小描画
      const scale = 1 / pixelSize;
      const scaledWidth = Math.max(1, Math.floor(width * scale));
      const scaledHeight = Math.max(1, Math.floor(height * scale));

      const offscreen = document.createElement("canvas");
      offscreen.width = scaledWidth;
      offscreen.height = scaledHeight;
      const oCtx = offscreen.getContext("2d");
      if (!oCtx) return;

      oCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

      // 元のキャンバスに拡大描画（アンチエイリアス無効）
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;
      (ctx as any).mozImageSmoothingEnabled = false;
      (ctx as any).webkitImageSmoothingEnabled = false;
      (ctx as any).msImageSmoothingEnabled = false;

      ctx.drawImage(offscreen, 0, 0, scaledWidth, scaledHeight, 0, 0, width, height);
    };
  }, [src, pixelSize]);

  return (
    <canvas 
      ref={canvasRef} 
      className={className} 
      style={{ imageRendering: 'pixelated' }}
      aria-label={alt}
    />
  );
}

const SURVIVOR_COORDS = [
  { name: "佐藤 (Sato)", x: 22, y: 35 },
  { name: "鈴木 (Suzuki)", x: 65, y: 20 },
  { name: "高橋 (Takahashi)", x: 38, y: 78 },
  { name: "田中 (Tanaka)", x: 78, y: 65 },
  { name: "伊藤 (Ito)", x: 18, y: 72 }
];

const formatBatteryTime = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins} MIN ${secs.toString().padStart(2, '0')} SEC`;
};

export default function App() {
  // モックシミュレーター用ステート
  const [isGameStarted, setIsGameStarted] = useState(false);

  const [flashlightOn, setFlashlightOn] = useState(true);
  const [batterySeconds, setBatterySeconds] = useState(600); // 10分(600秒)〜0秒
  const [isRunning, setIsRunning] = useState(false);
  const [stamina, setStamina] = useState(100);
  const [isStaminaExhausted, setIsStaminaExhausted] = useState(false);
  const [bearDistance, setBearDistance] = useState(250); // 距離 (10〜500px)
  const [isBearOnScreen, setIsBearOnScreen] = useState(true);
  const [savedSurvivors, setSavedSurvivors] = useState<boolean[]>([false, false, false, false, false]);
  const [activeItems, setActiveItems] = useState({ map: false, bell: 0, spray: 0 });
  const [previewEncounter, setPreviewEncounter] = useState(false);
  const [encounterResult, setEncounterResult] = useState<string | null>(null);
  const [isEscaped, setIsEscaped] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showAllSignalMarkers, setShowAllSignalMarkers] = useState(false);
  const [activeSafeRouteIndex, setActiveSafeRouteIndex] = useState<number | null>(null);

  // 懐中電灯点滅演出 (バッテリー2分(120秒)以下の場合)
  const [flickerState, setFlickerState] = useState(true);
  const flickerStateRef = useRef(true);
  useEffect(() => {
    if (batterySeconds <= 120 && flashlightOn) {
      const flickerTimer = setInterval(() => {
        setFlickerState(prev => {
          const next = Math.random() > 0.3;
          flickerStateRef.current = next;
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
      flickerStateRef.current = true;
    }
  }, [batterySeconds, flashlightOn]);

  // 音声（ビープ音）シミュレーター用のオーディオコンテキスト（ブラウザ制限があるためボタン押下時に初期化）
  const audioCtxRef = useRef<AudioContext | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const windSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const windLfoRef = useRef<OscillatorNode | null>(null);

  // --- 本物の2Dゲームエンジン統合 ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});

  // 生存者の救出アドバイスダイアログ用の React State
  const [activeDialog, setActiveDialog] = useState<{ survivor: string; text: string } | null>(null);

  // ゲーム世界の初期化
  const initGameWorld = () => {
    initAudio();
    if (engineRef.current) {
      engineRef.current.initWorld();
    }
  };

  // 鈴を使用する関数 (既存の UI ボタンや F キーで呼び出し)
  const useBell = () => {
    if (engineRef.current && activeItems.bell > 0) {
      if (engineRef.current.bellActiveTimer > 0) {
        return; // 効果持続中は再使用不可
      }
      engineRef.current.useBell();
      playBeep(293, 0.15, 'sine'); // チリン
      setTimeout(() => {
        playBeep(329, 0.2, 'sine'); // チリン
      }, 100);
    }
  };

  // ゲーム更新・描画のメインループ
  useEffect(() => {
    let isMounted = true;

    // 1. キーボード入力の管理
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;
      keysRef.current['shift'] = e.shiftKey;

      if (key === 'shift') {
        if (engineRef.current && !engineRef.current.isStaminaExhausted) {
          engineRef.current.isRunning = true;
          setIsRunning(true);
        }
      } else if (key === 'r') {
        if (activeItems.map) {
          initAudio();
          setShowMapModal(prev => !prev);
          playBeep(520, 0.15);
        }
      } else if (key === 'q') {
        if (activeItems.bell > 0 && isGameStarted && !previewEncounter && !isEscaped) {
          useBell();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
      keysRef.current['shift'] = e.shiftKey;

      if (key === 'shift') {
        if (engineRef.current) {
          engineRef.current.isRunning = false;
          setIsRunning(false);
        }
      }
    };

    // フォーカスが失われた時、またはウィンドウが非アクティブな時にすべての入力状態をリセット
    const handleBlur = () => {
      keysRef.current = {};
      if (engineRef.current) {
        engineRef.current.isRunning = false;
        setIsRunning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    // 2. ゲームループ (requestAnimationFrame)
    let animFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (!isMounted) return; // コンポーネント再マウント、状態変化後の古いループ（ゾンビループ）を完全に遮断

      const dt = Math.min(33, time - lastTime); // 30fps〜60fpsの範囲で安定化
      lastTime = time;

      if (isGameStarted && !previewEncounter && !isEscaped && canvasRef.current) {
        if (!engineRef.current || engineRef.current.canvas !== canvasRef.current) {
          engineRef.current = new GameEngine(canvasRef.current, {
            onStaminaChange: (val) => setStamina(val),
            onStaminaExhausted: (exhausted) => setIsStaminaExhausted(exhausted),
            onRunningChange: (running) => setIsRunning(running),
            onBatteryChange: (seconds) => setBatterySeconds(seconds),
            onBearDistanceChange: (dist) => setBearDistance(dist),
            onBearOnScreenChange: (onScreen) => setIsBearOnScreen(onScreen),
            onItemsChange: (items) => setActiveItems(items),
            onSurvivorsChange: (survivors) => setSavedSurvivors(survivors),
            onEncounter: () => {
              setPreviewEncounter(true);
              keysRef.current = {}; // キーリセット
              playBeep(100, 0.5, 'sawtooth'); // エンカウント
            },
            onEscape: () => {
              handleEscape();
            },
            onPopupMessage: () => {},
            onDialogMessage: (surv, text, idx) => {
              if (surv && text) {
                setActiveDialog({ survivor: surv, text });
                setTimeout(() => {
                  setActiveDialog(null);
                }, 8000);

                if (engineRef.current && engineRef.current.hasMap) {
                  setShowMapModal(true);
                  if (idx !== null) {
                    setActiveSafeRouteIndex(idx);
                  }
                }
              }
            }
          });
          engineRef.current.initWorld();
        }

        engineRef.current.update(dt, keysRef.current);
        engineRef.current.draw(flickerStateRef.current);
      }

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);

    return () => {
      isMounted = false; // クリーンアップ時にフラグを倒し、古いアニメーションのコールバックスケジュールを無効にする
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      cancelAnimationFrame(animFrameId);
    };
  }, [isGameStarted, previewEncounter, isEscaped, activeItems.map, activeItems.bell, activeItems.spray]);

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

  const handleEncounterAction = (action: string) => {
    if (action === 'run' || action === 'dead') {
      setEncounterResult('GAME OVER (クマに襲われ、深い闇の中へ消え去った...)');
      playBeep(50, 1.0, 'sawtooth');
    } else if (action === 'spray') {
      if (activeItems.spray > 0 && engineRef.current) {
        // スプレー音（プシューッ）
        playBeep(400, 0.8, 'triangle');
        engineRef.current.sprayCount -= 1;
        engineRef.current.respawnBearAway();
        setEncounterResult('SUCCESS (スプレーを噴射して遠くへ追い払った！)');
        setTimeout(() => {
          setPreviewEncounter(false);
          setEncounterResult(null);
        }, 2000);
      } else {
        setEncounterResult('NO SPRAY (スプレーを所持していません！)');
      }
    }
  };

  const toggleSurvivor = (index: number) => {
    initAudio();
    const newSaved = [...savedSurvivors];
    const isNowSaved = !newSaved[index];
    newSaved[index] = isNowSaved;
    setSavedSurvivors(newSaved);
    if (engineRef.current) {
      engineRef.current.savedList[index] = isNowSaved;
      engineRef.current.survivors[index].saved = isNowSaved;
    }
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

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if ((e.button === 2 || e.button === 0) && engineRef.current && canvasRef.current) {
      e.preventDefault();
      initAudio();

      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = 960 / rect.width;
      const scaleY = 544 / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      const interacted = engineRef.current.interactAt(mouseX, mouseY);
      if (interacted) {
        playBeep(440, 0.1);
      }
    }
  };

  const resetMock = () => {
    setPreviewEncounter(false);
    setEncounterResult(null);
    setActiveItems({ map: false, bell: 0, spray: 0 });
    setIsBearOnScreen(true);
    setBearDistance(250);
    setBatterySeconds(600);
    setSavedSurvivors([false, false, false, false, false]);
    setStamina(100);
    setIsRunning(false);
    setIsStaminaExhausted(false);
    setIsEscaped(false);
    setIsGameStarted(false);
    setShowMapModal(false);
    setShowAllSignalMarkers(false);
    setActiveSafeRouteIndex(null);
    setActiveDialog(null);
    keysRef.current = {};
    engineRef.current = null;
  };

  // 懐中電灯の照射範囲（半径）の計算
  const getLightRadius = () => {
    if (!flashlightOn || !flickerState) return 0;
    if (engineRef.current) {
      return engineRef.current.getLightRadius();
    }
    const percentage = batterySeconds / 600;
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
      <div className="w-full max-w-[1024px] bg-[#0a0a0a] border-4 border-[#1a1a1a] flex flex-col overflow-hidden p-4 md:p-6 shadow-2xl rounded-sm">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline border-b border-[#333] pb-3 mb-4">
          <div className="flex flex-col">
            <h1 className="text-3xl md:text-4xl font-horror text-[#8B0000] tracking-wider flex items-center gap-3">
              <span>bear escape</span>
              <span className="text-[10px] font-sans tracking-wider bg-[#8B0000]/15 text-[#ff4d4d] px-2 py-0.5 border border-[#8B0000]/30 rounded">
                本編 (PLAYABLE GAME)
              </span>
            </h1>
            <p className="text-[8px] font-mono uppercase tracking-[0.3em] mt-0.5 opacity-60">
              ESCAPE FROM URSUS // PROJECT URSUS-01 // PRODUCTION VER
            </p>
          </div>
          <div className="mt-1 sm:mt-0 flex items-center gap-2">
            <span className="text-[9px] font-mono bg-[#111] border border-[#333] px-2 py-0.5 text-[#ffcc00]">
              SYSTEM: 100x AREA SURVIVAL
            </span>
          </div>
        </header>

        {/* Main Content (Single Column for immersive game feel) */}
        <div className="flex flex-col gap-4">
          
          {/* Visual Canvas Mock / Full Interactive Game Canvas */}
          <div className="flex flex-col">
            <div className="relative bg-[#020202] border-2 border-[#333] w-full aspect-[960/544] overflow-hidden shadow-2xl rounded-sm">
              
              {!isGameStarted ? (
                /* ゲーム開始画面オーバーレイ */
                <div className="absolute inset-0 bg-[#070707] bg-gradient-to-b from-[#0e0202] to-[#050505] p-5 flex flex-col justify-between overflow-y-auto text-gray-300">
                  
                  {/* Header */}
                  <div className="flex justify-between items-center border-b border-[#8B0000]/40 pb-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-[#8B0000] tracking-[0.2em] font-bold">=== GAME START SCREEN ===</span>
                    <span className="text-[9px] font-mono text-[#ffcc00] animate-pulse">PRESS START TO PLAY</span>
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
                      ゲームを開始する (START GAME)
                    </button>
                  </div>

                </div>
              ) : isEscaped ? (
                /* 脱出エンディング画面 */
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
                    もう一度プレイする (RETRY)
                  </button>
                </div>
              ) : (
                /* 探索＆戦闘（重ね合わせ）画面 */
                <>
                  {/* 探索画面 (HTML5 Canvas 2D) - 常にマウント状態を保ち、戦闘中は hidden クラスで非表示にする */}
                  <div className={previewEncounter ? "hidden" : "absolute inset-0"}>
                    <canvas 
                      ref={canvasRef} 
                      width={960}
                      height={544}
                      onContextMenu={(e) => e.preventDefault()}
                      onMouseDown={handleCanvasMouseDown}
                      className="absolute inset-0 w-full h-full block bg-black cursor-pointer"
                    />

                    {/* HUD / Items Counter */}
                    <div className="absolute bottom-3 left-3 flex gap-2 text-[8px] font-mono uppercase">
                      <div className="bg-black/80 px-2 py-0.5 border border-[#333] text-gray-300">
                        Bell: {activeItems.bell > 0 ? `${Math.ceil(activeItems.bell / 2)}個 (残り${activeItems.bell}回) [Q]` : "EMPTY"}
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
                          if (engineRef.current) {
                            engineRef.current.flashlightOn = !engineRef.current.flashlightOn;
                            setFlashlightOn(engineRef.current.flashlightOn);
                          } else {
                            setFlashlightOn(!flashlightOn);
                          }
                          playBeep(500, 0.05);
                        }}
                        className="bg-black/80 border border-gray-600 hover:border-white px-2 py-1 text-[8px] font-mono text-gray-300 rounded cursor-pointer"
                      >
                        LIGHT: {flashlightOn ? "ON" : "OFF"}
                      </button>
                      <span className="bg-black/80 border border-gray-600 px-2 py-1 text-[8px] font-mono text-[#ffcc00] rounded">
                        BATTERY: {formatBatteryTime(batterySeconds)}
                      </span>
                    </div>

                    {/* Dynamic Threat Warning / Pulse warning */}
                    {isBearOnScreen && (
                      <div className="absolute top-3 right-3 bg-[#8B0000] text-white px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase animate-pulse">
                        Threat Detected
                      </div>
                    )}

                    {/* クマ接近警告メーター（画面右下UI） */}
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

                    {/* 遭難者の会話アドバイスダイアログ (Overlay) */}
                    {activeDialog && (
                      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[90%] max-w-[480px] bg-black/95 border border-emerald-500 p-2 text-emerald-400 font-mono text-[9px] rounded shadow-2xl z-10 animate-pulse">
                        <div className="font-bold border-b border-emerald-500/30 pb-0.5 mb-1 text-[10px]">
                          【救助完了】 {activeDialog.survivor} の情報:
                        </div>
                        <div className="text-white leading-normal">{activeDialog.text}</div>
                        <div className="text-[7.5px] text-emerald-500/80 mt-1">※GPSレーダーが自動的に起動し、脱出口への安全ルート（黄色い点滅線）が10秒間表示されます。</div>
                      </div>
                    )}
                  </div>

                  {/* 戦闘コマンド画面 - previewEncounterがtrueの時のみ、z-10かつabsoluteで最前面に重ねて表示する */}
                  {previewEncounter && (
                    <div className="absolute inset-0 bg-gradient-to-b from-[#110101] to-[#050000] p-4 flex flex-col justify-between z-10">
                      {/* Header */}
                      <div className="flex justify-between items-center border-b border-[#8B0000]/40 pb-2">
                        <span className="text-[10px] font-mono text-[#ffcc00] animate-pulse">!! BEAST CONTACTED !!</span>
                        <span className="text-[9px] font-mono text-gray-400">熊との遭遇・戦闘画面</span>
                      </div>

                      {/* Combat Arena (Center) */}
                      <div className="flex-1 flex flex-col items-center justify-center gap-2">
                        {/* 戦闘画面のクマの描写をドット絵（PixelArtImage）に置き換え */}
                        <div className="w-64 h-36 bg-[#1f0505] border-2 border-[#8B0000] flex flex-col items-center justify-center rounded-sm relative shadow-[0_0_15px_rgba(139,0,0,0.6)] overflow-hidden">
                          <PixelArtImage 
                            src="/src/assets/images/zombie_bear_forest_1784349011960.jpg" 
                            alt="Zombie Bear" 
                            className="w-full h-full object-cover"
                            pixelSize={8}
                          />
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
                          className="py-1.5 bg-[#8B0000]/30 hover:bg-[#8B0000] border border-[#8B0000] text-[9px] font-mono uppercase text-white tracking-wider rounded transition-all cursor-pointer"
                        >
                          走って逃げる
                        </button>
                        <button 
                          id="combat-btn-dead"
                          onClick={() => handleEncounterAction('dead')}
                          className="py-1.5 bg-[#222] hover:bg-[#333] border border-[#444] text-[9px] font-mono uppercase text-white tracking-wider rounded transition-all cursor-pointer"
                        >
                          死んだふり
                        </button>
                        <button 
                          id="combat-btn-spray"
                          disabled={activeItems.spray <= 0}
                          onClick={() => handleEncounterAction('spray')}
                          className={`py-1.5 border text-[9px] font-mono uppercase tracking-wider rounded transition-all cursor-pointer ${
                            activeItems.spray > 0 
                              ? 'bg-gradient-to-r from-amber-900 to-amber-700 hover:from-amber-800 hover:to-amber-600 border-[#ffcc00] text-white' 
                              : 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                          }`}
                        >
                          スプレーを使う ({activeItems.spray})
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

            {/* In-Game Instructions & Control Guides */}
            <div className="mt-2 text-[10px] font-mono text-gray-500 flex justify-between items-center px-1">
              <span>※ 懐中電灯/生存者との会話を活用して、クマから逃げ延びながら地図を探してください。</span>
              <button 
                id="reset-mock-btn"
                onClick={resetMock}
                className="bg-amber-950/20 border-2 border-[#ffcc00] hover:bg-[#ffcc00]/20 px-3.5 py-1.5 text-xs font-mono font-bold text-[#ffcc00] tracking-wider uppercase rounded-none cursor-pointer flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(255,204,0,0.2)]"
              >
                <RotateCcw className="w-3.5 h-3.5" /> ゲームをリセット (RETRY)
              </button>
            </div>

            {/* Manual & Items Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* PC Control manual section */}
              <section className="bg-[#0b0b0b] border border-[#222] p-4 rounded-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-mono text-[#8B0000] uppercase mb-3 tracking-widest border-b border-[#222] pb-1.5">
                    [01] 操作マニュアル (CONTROLS)
                  </h3>
                  <div className="space-y-2 text-[11px] text-zinc-300 font-mono">
                    <div className="flex justify-between border-b border-zinc-900 pb-1">
                      <span className="text-zinc-500">移動</span>
                      <span className="text-white font-bold">W, A, S, D キー</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900 pb-1">
                      <span className="text-zinc-500">ダッシュ (スタミナ消費)</span>
                      <span className="text-amber-500 font-bold">Shift キー (長押し)</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900 pb-1">
                      <span className="text-zinc-500">簡易地図の開閉 (所持時)</span>
                      <span className="text-[#ffcc00] font-bold">R キー / HUDクリック</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900 pb-1">
                      <span className="text-zinc-500">鈴を鳴らす (追跡10秒無効 + 再使用CD)</span>
                      <span className="text-[#ffcc00] font-bold">Q キー / 残回数消費</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">アイテム回収 & 生存者救助</span>
                      <span className="text-emerald-400 font-bold">右クリック (接近時)</span>
                    </div>
                  </div>
                </div>
                <div className="text-[9px] text-zinc-500 mt-3 leading-relaxed">
                  ※ 息切れ状態（スタミナ0%）になると、自動的にスタミナが30%以上に回復するまでダッシュができなくなります。
                </div>
              </section>

              {/* Equipment & Items section */}
              <section className="bg-[#0b0b0b] border border-[#222] p-4 rounded-sm">
                <h3 className="text-xs font-mono text-[#8B0000] uppercase mb-3 tracking-widest border-b border-[#222] pb-1.5">
                  [02] アイテム一覧 (ITEMS)
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2">
                    <div className="text-xs shrink-0">🗺️</div>
                    <div>
                      <h4 className="text-[11px] font-bold text-white uppercase flex items-center justify-between">
                        <span>地図 (Map)</span>
                      </h4>
                      <p className="text-[10px] text-[#999] mt-0.5">
                        獲得すると全体マップが表示され、脱出口(EXIT)の位置が明らかになるゲームクリアの最重要鍵。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-xs shrink-0">🔔</div>
                    <div>
                      <h4 className="text-[11px] font-bold text-white uppercase flex items-center justify-between">
                        <span>鈴 (Bell)</span>
                      </h4>
                      <p className="text-[10px] text-[#999] mt-0.5">
                        鳴らすと一時的にクマを遠ざけるが、錆びやすいため2回使うと壊れる（拾うたびに回数が累積）。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-xs shrink-0">💨</div>
                    <div>
                      <h4 className="text-[11px] font-bold text-white uppercase flex items-center justify-between">
                        <span>熊撃退スプレー</span>
                      </h4>
                      <p className="text-[10px] text-[#999] mt-0.5">
                        接触・戦闘時に1個消費してクマを吹き飛ばし、遠くにワープさせて探索を再開できる唯一の防衛策。
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Survivor Tips */}
            <section className="bg-[#0b0b0b] border border-[#222] p-4 rounded-sm">
              <h3 className="text-xs font-mono text-[#8B0000] uppercase mb-2 tracking-widest">
                [03] 生存へのアドバイス（遭難者達の言葉）
              </h3>
              <p className="text-[10px] text-gray-500 mb-2">
                フィールドに存在する5人の生存者から、救出対話時に得られる、生き残るためのヒントです。
              </p>
              <div className="bg-[#0f0f0f] p-3 italic text-[11px] border-l-2 border-[#8B0000] space-y-2 text-[#aaa]">
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

          {/* Footer */}
          <footer className="mt-8 pt-4 border-t border-[#333] flex flex-col md:flex-row justify-between items-center text-[9px] uppercase tracking-widest text-gray-600 gap-2">
            <span>Environment Setup: 96,000 x 54,400 Pixel Grid</span>
            <span>Top-down Survival Horror Design Docs with Interactive Simulator</span>
            <span>© 2026 pixel-horror development unit</span>
          </footer>

        </div>

        {/* Tactical Map Overlay Modal */}
        {showMapModal && activeItems.map && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-[720px] h-[480px] bg-[#040e06]/95 border-2 border-[#10b981]/50 p-4 flex flex-col justify-between text-[#10b981] font-mono shadow-2xl animate-fade-in">
              {/* Map Header */}
              <div className="flex justify-between items-center border-b border-[#10b981]/30 pb-2 shrink-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider">
                  <MapIcon className="w-3.5 h-3.5 animate-pulse" />
                  <span>GPS RADAR SYSTEM v1.1.0 (9,600 x 5,440 PX)</span>
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
                  style={{ 
                    left: engineRef.current ? `${(engineRef.current.playerX / 9600) * 100}%` : '45%', 
                    top: engineRef.current ? `${(engineRef.current.playerY / 5440) * 100}%` : '55%' 
                  }}
                >
                  <div className="w-3 h-3 bg-blue-500 border border-white rounded-full flex items-center justify-center text-white text-[7px] font-bold shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse">
                    P
                  </div>
                  <span className="text-[6.5px] text-blue-400 font-bold whitespace-nowrap mt-0.5 bg-black/80 px-1 border border-blue-500/30 rounded-sm">現在地 (YOU)</span>
                </div>

                {/* 2. Plot escape exit (EXIT) */}
                <div 
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                  style={{ 
                    left: engineRef.current ? `${(engineRef.current.exitX / 9600) * 100}%` : '90%', 
                    top: engineRef.current ? `${(engineRef.current.exitY / 5440) * 100}%` : '12%' 
                  }}
                >
                  <div className="w-3 h-3 bg-emerald-500 border border-white rounded-sm flex items-center justify-center text-white text-[7px] font-bold shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-[ping_1.5s_infinite]">
                    🚪
                  </div>
                  <span className="text-[6.5px] text-emerald-400 font-bold whitespace-nowrap mt-0.5 bg-black/80 px-1 border border-emerald-500/30 rounded-sm">脱出口 (EXIT)</span>
                </div>

                {/* 3. Plot survivors */}
                {SURVIVOR_COORDS.map((survivor, idx) => {
                  const isSaved = savedSurvivors[idx];
                  if (isSaved || showAllSignalMarkers) {
                    const isCurrentRoute = activeSafeRouteIndex === idx;
                    const px = engineRef.current ? (engineRef.current.survivors[idx].x / 9600) * 100 : survivor.x;
                    const py = engineRef.current ? (engineRef.current.survivors[idx].y / 5440) * 100 : survivor.y;
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
                        style={{ left: `${px}%`, top: `${py}%` }}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold border border-white shadow-lg transition-colors ${
                          isSaved 
                            ? isCurrentRoute
                              ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,1)]'
                              : 'bg-emerald-500 text-black animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' 
                            : 'bg-zinc-700 text-zinc-400 border-dashed'
                        }`}>
                          {idx + 1}
                        </div>
                        <span className={`text-[6px] font-bold whitespace-nowrap mt-0.5 bg-black/80 px-1 rounded-sm border transition-colors ${
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
                {activeSafeRouteIndex !== null && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line 
                      x1={engineRef.current ? (engineRef.current.survivors[activeSafeRouteIndex].x / 9600) * 100 : SURVIVOR_COORDS[activeSafeRouteIndex].x} 
                      y1={engineRef.current ? (engineRef.current.survivors[activeSafeRouteIndex].y / 5440) * 100 : SURVIVOR_COORDS[activeSafeRouteIndex].y} 
                      x2={engineRef.current ? (engineRef.current.exitX / 9600) * 100 : 90} 
                      y2={engineRef.current ? (engineRef.current.exitY / 5440) * 100 : 12} 
                      stroke="#f59e0b" 
                      strokeWidth="1.2" 
                      strokeLinecap="round"
                      strokeDasharray="3 3"
                      strokeOpacity="0.6"
                      className="animate-pulse"
                    />
                    <line 
                      x1={engineRef.current ? (engineRef.current.survivors[activeSafeRouteIndex].x / 9600) * 100 : SURVIVOR_COORDS[activeSafeRouteIndex].x} 
                      y1={engineRef.current ? (engineRef.current.survivors[activeSafeRouteIndex].y / 5440) * 100 : SURVIVOR_COORDS[activeSafeRouteIndex].y} 
                      x2={engineRef.current ? (engineRef.current.exitX / 9600) * 100 : 90} 
                      y2={engineRef.current ? (engineRef.current.exitY / 5440) * 100 : 12} 
                      stroke="#fbbf24" 
                      strokeWidth="0.5" 
                      strokeLinecap="round"
                      strokeDasharray="1 1"
                    />
                  </svg>
                )}

                {/* Active Route HUD Toast */}
                {activeSafeRouteIndex !== null && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[7px] px-2.5 py-1 rounded shadow-lg flex items-center gap-1 animate-pulse z-20">
                    <Sparkles className="w-2 h-2" />
                    <span>山の脱出口への安全ラインを10秒間投影中</span>
                  </div>
                )}

                {/* Compass Rose accent */}
                <div className="absolute right-3 bottom-3 opacity-30 text-[10px] flex flex-col items-center">
                  <Compass className="w-4 h-4 animate-[spin_30s_linear_infinite]" />
                  <span className="text-[5px] tracking-widest mt-0.5">NORTH</span>
                </div>

                {/* Coordinates Grid labels */}
                <span className="absolute left-2 top-2 text-[7px] text-[#10b981]/50">[SECTOR-GPS-01]</span>
                <span className="absolute right-2 top-2 text-[7px] text-[#10b981]/50">9,600 x 5,440 PX</span>
              </div>

              {/* Map Legend */}
              <div className="flex justify-between items-center text-[8px] border-t border-[#10b981]/30 pt-1.5 shrink-0">
                <div className="flex gap-3 items-center">
                  <span className="font-bold text-gray-400">凡例:</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block"></span> プレイヤー (P)</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-sm inline-block"></span> 脱出口 (🚪)</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full inline-block"></span> 生存者 (救出済・ルート発信)</span>
                </div>
                <span className="text-[7px] text-[#10b981]/40">山岳地図データ / 遭難信号追跡装置</span>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}
