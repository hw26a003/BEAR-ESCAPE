import { useState } from 'react';
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
  Info
} from 'lucide-react';

// 仕様書
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
- **クリア条件**: 
  1. フィールドに配置されているアイテム「地図」を獲得する。
  2. 地図を獲得することで判明する「山の出口（脱出口）」に到達する。`
  },
  system: {
    title: "02. ゲームシステム (Game System)",
    icon: Compass,
    content: `### 2.1 フィールドの構造
- **視点**: 見下ろし視点（トップビュー）の2Dマップ。
- **画面表示サイズ**: 960 × 544 ピクセル。
- **フィールド全体の大きさ**: **面積100倍**（幅10倍 × 高さ10倍：**9,600 × 5,440 ピクセル**、画面100枚分の広さ）。
- **環境・演出**: 夜中の山の中を想定した暗い画面表示。
  - プレイヤーの持つ「懐中電灯」の光が届く範囲（プレイヤーの周囲）だけがかろうじて見えているような視界制限演出。

### 2.2 操作方法（PC想定）
- **移動**: キーボードの \`W\`, \`A\`, \`S\`, \`D\` キーでプレイヤーを上下左右に操作。
- **地図の表示**: キーボードの \`R\` キー（地図を所持している時のみ有効）。
- **鈴の使用**: キーボードの \`F\` キー（鈴を所持している時のみ有効）。
- **探索・対話**: マウスの「右クリック」でフィールド上のアイテムを取得したり、NPCと会話をしたりします。

### 2.3 アイテムシステム
フィールドには以下のアイテムがランダムに配置されます（いずれも初期配置数は限定）。
- **地図 (Map) - 出現数 1個**: 獲得するとフィールドの全体マップが表示され、\`R\`キーで表示します。
- **鈴 (Bell) - 出現数 3個**: フィールド上で使用すると熊を寄せ付けない効果。獲得時に所持数が1増え、耐久力（制限）として獲得するたびに全体の残り使用可能回数（耐久度）に **+2回** され、共通のカウンターで累積管理。
- **熊撃退スプレー (Spray) - 出現数 3個**: 戦闘時のみ使用可能。一度だけクマを追い返し、戦闘から離脱して探索を再開できる。`
  },
  battle: {
    title: "03. 戦闘・エンカウント (Combat & Encounter)",
    icon: Flame,
    content: `### 3.1 敵「クマ」の生態と挙動
- **存在数**: フィールド上に1体のみ。
- **外見**: 普通のクマとは明らかに異なる、異様で恐ろしい見た目。
- **初期位置**: ゲーム開始時、プレイヤーから少し離れた遠い位置に配置される。
- **出現**: いつどこから現れるか分からない。
- **追跡条件**: 画面（960×544）の範囲内にクマが入った時点で、即座に追跡が始まる。
- **追跡の一時無効化**: 鈴を使用すると15秒間追跡を無効にする。

### 3.2 エンカウント（戦闘移行条件）
フィールド上でプレイヤーとクマの「当たり判定」が接触した瞬間、画面が切り替わり戦闘画面に移行します。

### 3.3 戦闘コマンド（選択肢）
クマと接触した際、プレイヤーは以下の3つの選択肢から行動を選択します。

1. **走って逃げる**:
   - 失敗し、即座に「ゲームオーバー画面」に移行する。
2. **死んだふりをする**:
   - 失敗し、即座に「ゲームオーバー画面」に移行する。
3. **アイテムを使う（熊撃退スプレー）**:
   - 熊撃退スプレーを1個消費し、クマを一時的に遠ざけて戦闘を終了し、再び元のフィールド探索画面に戻る。
   - 使用後、クマの位置はプレイヤーから遠めの場所に再配置されます。`
  },
  visual: {
    title: "04. ビジュアル・グラフィック (Visual & Sound)",
    icon: Volume2,
    content: `### 4.1 アートスタイル
- **グラフィック**: レトロで不気味な2Dドット絵（ピクセルアート）。
- **フィールドパーツ**: 256×256ピクセル、または512×512ピクセルの正方形パーツ（タイル）を組み合わせて夜中の山を自動または手動生成します。
  - **仕様特性**: 1マスの床などの最小単位ではなく、木々, 障害物、道などがまとめられた複合的な「大オブジェクトブロック（背景パーツ）」として扱います。
- **キャラクター**: 主人公、クマ、5人のNPCも、すべてこの正方形タイル比率に合わせた不気味なドット絵デザインで統一します。

### 4.2 画面演出
- **暗闇演出**: 画面全体は夜道を模して暗く、懐中電灯を当てた部分だけが丸く照らされる視界制限を実装。
- **脅威演出**: クマが画面に現れると、画面上に「Threat Detected（脅威感知）」が赤く点滅するなどの緊迫感を演出します。`
  },
  decisions: {
    title: "05. 決定事項・合意 (Resolved Decisions)",
    icon: CheckCircle2,
    content: `ゲームデザイナー様との間で合意・決定された仕様詳細です。

1. **フィールドの「100倍」の定義**: A案（面積が100倍：幅10倍 × 高さ10倍、9,600 × 5,440 ピクセル、画面100枚分）の広さ。
2. **鈴の耐久力（2回）の管理**: B案（鈴を拾うごとに、全体の「残り使用可能回数（耐久度）」に一律で+2回が加算され、共通カウンターで管理する）。
3. **鈴の効果**: 使用してから15秒間、クマがプレイヤーを追跡（追尾）しなくなる。
4. **追跡条件**: 懐中電灯の光が届いているかに関わらず、画面（960×544）の範囲内にクマが入った時点で即座に追跡が始まる。
5. **NPCの配置と移動**: フィールド上のランダムな位置に配置、直立固定（移動なし）。
6. **タイルパーツの構成**: 256px/512pxパーツは、いくつかの木や道が描かれた「複合大オブジェクトブロック」としての仕様。`
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<keyof typeof specs>('overview');
  
  // インタラクティブな仮回答ステート
  const [answers, setAnswers] = useState({
    fieldSize: 'A', // A: 面積100倍, B: 縦横100倍
    bellUsage: 'B', // A: 個別管理, B: 共通回数+2
    bearSpawn: 'A', // A: 徘徊型, B: スポン型
    bearSight: 'A', // A: 画面に入ったら即, B: 懐中電灯の光に触れたら
    npcSpawn: 'A',  // A: 固定配置, B: ランダム配置
    tileMeaning: 'B' // A: 最小マップチップ, B: 複合大オブジェクトブロック
  });

  // モックプレビュー用ステート
  const [flashlightOn, setFlashlightOn] = useState(true);
  const [threatActive, setThreatActive] = useState(true);
  const [activeItems, setActiveItems] = useState({ map: false, bell: 2, spray: 1 });
  const [previewEncounter, setPreviewEncounter] = useState(false);
  const [encounterResult, setEncounterResult] = useState<string | null>(null);

  const handleEncounterAction = (action: string) => {
    if (action === 'run' || action === 'dead') {
      setEncounterResult('GAME OVER (死亡して山に取り込まれた...)');
    } else if (action === 'spray') {
      if (activeItems.spray > 0) {
        setActiveItems(prev => ({ ...prev, spray: prev.spray - 1 }));
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

  const resetMock = () => {
    setPreviewEncounter(false);
    setEncounterResult(null);
    setActiveItems({ map: false, bell: 2, spray: 1 });
    setThreatActive(true);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#d1d1d1] font-sans flex items-center justify-center p-4">
      {/* Editorial Outer Frame */}
      <div className="w-full max-w-[1200px] bg-[#0a0a0a] border-8 border-[#1a1a1a] flex flex-col overflow-hidden p-6 md:p-10 shadow-2xl">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-baseline border-b border-[#333] pb-4 mb-6">
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-serif italic text-[#8B0000] tracking-tighter">
              熊からの脱出
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] mt-1 opacity-60">
              GAME DESIGN SPECIFICATION // PROJECT URSUS-01
            </p>
          </div>
          <div className="mt-2 md:mt-0 flex items-center gap-4">
            <span className="text-[11px] font-mono bg-[#111] border border-[#333] px-2 py-1 text-[#ffcc00]">
              ROLE: PRO-GAME DESIGNER
            </span>
            <span className="text-[11px] font-mono border border-[#444] px-2 py-1">
              REV: 1.0.0
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
            <div className="bg-[#0c0c0c] border border-[#222] p-6 rounded-sm min-h-[420px] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-[#222] pb-3 mb-4">
                  <span className="text-[10px] font-mono text-[#8B0000] uppercase tracking-widest">[DOCUMENT]</span>
                  <h2 className="text-lg font-serif font-semibold text-white">
                    {specs[activeTab].title}
                  </h2>
                </div>
                
                <div className="text-sm text-[#b5b5b5] font-sans leading-relaxed space-y-4 whitespace-pre-wrap">
                  {specs[activeTab].content}
                </div>
              </div>

              {/* Document Footer Hint */}
              <div className="mt-8 pt-4 border-t border-[#1a1a1a] flex justify-between items-center text-[10px] font-mono text-gray-500">
                <span>CONFIDENTIAL // GAME SPEC V1</span>
                <span>STATUS: DRAFT</span>
              </div>
            </div>

            {/* Interactive Decision Matrix (Designer Workspace) */}
            <div className="bg-[#0d0d0d] border border-[#222] p-5 rounded-sm">
              <h3 className="text-xs font-mono text-[#ffcc00] uppercase mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> 仕様仮回答・検討用マトリクス（デザイナー用）
              </h3>
              <p className="text-[11px] text-[#888] mb-4">
                仕様書の不明確な点について、ご希望の方向性をその場で仮設定できます。これらの選択に基づき、後々の実装イメージをスムーズに固めます。
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
                <span>[VISUAL SIMULATOR] 探索/戦闘 画面モック</span>
                <span className="text-[9px] opacity-60 text-gray-400">960 x 544 Ratio</span>
              </h2>

              <div className="relative bg-[#020202] border-2 border-[#333] w-full aspect-[960/544] overflow-hidden shadow-2xl rounded-sm">
                
                {previewEncounter ? (
                  /* 戦闘コマンド画面モック */
                  <div className="absolute inset-0 bg-gradient-to-b from-[#110101] to-[#050000] p-4 flex flex-col justify-between">
                    {/* Header */}
                    <div className="flex justify-between items-center border-b border-[#8B0000]/40 pb-2">
                      <span className="text-[10px] font-mono text-[#ffcc00] animate-pulse">!! BEAST CONTACTED !!</span>
                      <span className="text-[9px] font-mono text-gray-400">熊との戦闘画面</span>
                    </div>

                    {/* Combat Arena (Center) */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                      {/* 恐ろしいクマのドット調アイコン (CSSでドット感) */}
                      <div className="w-16 h-16 bg-[#1f0505] border-2 border-[#8B0000] flex flex-col items-center justify-center rounded-sm relative shadow-[0_0_15px_rgba(139,0,0,0.6)]">
                        <div className="flex justify-between w-8 mt-2">
                          <div className="w-3 h-3 bg-red-600 rounded-sm animate-ping"></div>
                          <div className="w-3 h-3 bg-red-600 rounded-sm animate-ping"></div>
                        </div>
                        <span className="text-[8px] font-mono text-white mt-1 uppercase">URSUS</span>
                        <div className="absolute top-1 left-1 text-[7px] text-[#ffcc00] font-mono">[!]</div>
                      </div>
                      <p className="text-xs font-serif italic text-red-500 tracking-wider">
                        「異形のクマが目の前で咆哮をあげている...」
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
                    {/* Dark map background overlay simulating flashlight */}
                    <div 
                      className="absolute inset-0 transition-opacity duration-300" 
                      style={{
                        background: flashlightOn 
                          ? 'radial-gradient(circle at 45% 55%, transparent 70px, rgba(0,0,0,0.96) 180px)' 
                          : 'rgba(0,0,0,0.99)'
                      }}
                    ></div>

                    {/* Grid pixel lines simulating 16px grid */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
                      backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                      backgroundSize: '16px 16px'
                    }}></div>

                    {/* Escape exit (Visible only if map is acquired) */}
                    {activeItems.map && (
                      <div className="absolute right-10 top-12 flex flex-col items-center">
                        <div className="w-6 h-6 border border-emerald-500 bg-emerald-950/40 flex items-center justify-center rounded-sm text-emerald-400 text-[8px] font-mono">EXIT</div>
                        <span className="text-[7px] text-emerald-400 font-mono mt-1">脱出口</span>
                      </div>
                    )}

                    {/* Character (Player) */}
                    <div className="absolute left-[45%] top-[55%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                      <div className="w-6 h-6 bg-[#444] border border-white flex items-center justify-center rounded-sm shadow-lg">
                        <span className="text-[8px] font-mono text-white">P</span>
                      </div>
                      <span className="text-[7px] text-gray-400 font-mono mt-1">主人公</span>
                    </div>

                    {/* Clues / Items on Ground (Map if not taken) */}
                    {!activeItems.map && (
                      <button 
                        id="mock-map-item"
                        onClick={() => setActiveItems(prev => ({ ...prev, map: true }))}
                        className="absolute right-1/3 top-1/4 group cursor-pointer"
                      >
                        <div className="w-4 h-4 bg-amber-950/60 border border-amber-400 flex items-center justify-center rounded-sm animate-pulse">
                          <span className="text-[8px] text-[#ffcc00] font-mono">M</span>
                        </div>
                        <span className="hidden group-hover:block absolute top-6 -left-4 bg-black border border-amber-400 text-[8px] px-1 py-0.5 text-[#ffcc00] whitespace-nowrap">右クリで取得</span>
                      </button>
                    )}

                    {/* Bear Enemy (Ursus) */}
                    <button
                      id="mock-bear-enemy"
                      onClick={() => setPreviewEncounter(true)}
                      className="absolute right-12 top-[40%] group cursor-pointer"
                    >
                      <div className="w-10 h-10 bg-[#300] border-2 border-[#800] rounded-sm flex flex-col items-center justify-center shadow-[0_0_15px_rgba(139,0,0,0.5)]">
                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></div>
                        <span className="text-[6px] text-red-500 font-mono mt-1">BEAR</span>
                      </div>
                      <span className="hidden group-hover:block absolute top-12 -left-6 bg-black border border-red-800 text-[8px] px-1.5 py-0.5 text-red-500 whitespace-nowrap">クリックで接触</span>
                    </button>

                    {/* HUD / Interface overlays */}
                    <div className="absolute bottom-3 left-3 flex gap-2 text-[8px] font-mono uppercase">
                      <div className="bg-black/80 px-2 py-0.5 border border-[#333] text-gray-300">
                        Bell: {activeItems.bell > 0 ? `0${activeItems.bell}` : "EMPTY"}
                      </div>
                      <div className="bg-black/80 px-2 py-0.5 border border-[#333] text-gray-300">
                        Spray: {activeItems.spray > 0 ? `0${activeItems.spray}` : "EMPTY"}
                      </div>
                      {activeItems.map && (
                        <div className="bg-black/80 px-2 py-0.5 border border-[#ffcc00]/40 text-[#ffcc00]">
                          MAP: ACQUIRED [R]
                        </div>
                      )}
                    </div>

                    {/* Flashlight toggle control */}
                    <button 
                      id="toggle-flashlight"
                      onClick={() => setFlashlightOn(!flashlightOn)}
                      className="absolute top-3 left-3 bg-black/80 border border-gray-600 hover:border-white px-2 py-1 text-[8px] font-mono text-gray-300 rounded"
                    >
                      LIGHT: {flashlightOn ? "ON" : "OFF"}
                    </button>

                    {/* Threat detection status */}
                    {threatActive && (
                      <div className="absolute top-3 right-3 bg-[#8B0000] text-white px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase animate-pulse">
                        Threat Detected
                      </div>
                    )}
                  </>
                )}

              </div>
              
              {/* Simulator instruction notes */}
              <div className="mt-2 text-[10px] font-mono text-gray-500 flex justify-between items-center px-1">
                <span>※ 地図（M）を取得、またはクマをクリックして戦闘を開始できます。</span>
                <button 
                  id="reset-mock-btn"
                  onClick={resetMock}
                  className="text-[#ffcc00] hover:underline flex items-center gap-0.5"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> リセット
                </button>
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
                      <span className="text-[9px] font-mono bg-black border border-[#333] px-1 text-gray-500">[Rキー / 右クリ取得]</span>
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
                      <span className="text-[9px] font-mono bg-black border border-[#333] px-1 text-gray-500">[Fキー / 使用]</span>
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

            {/* Survivor Tips (Must-include Dialogues) */}
            <section className="bg-[#0b0b0b] border border-[#222] p-5 rounded-sm">
              <h3 className="text-xs font-mono text-[#8B0000] uppercase mb-3 tracking-widest">
                [03] 生存へのアドバイス（遭難者達の言葉）
              </h3>
              <p className="text-[10px] text-gray-500 mb-3">
                フィールドに存在する5人のNPC（生存者）と会話（右クリック）することで得られる、生存のための極めて重要なアドバイスです。
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
          <span>Top-down Survival Horror Design Docs</span>
          <span>© 2026 pixel-horror development unit</span>
        </footer>

      </div>
    </div>
  );
}
