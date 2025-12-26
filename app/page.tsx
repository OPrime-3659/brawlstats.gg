'use client';

// 1. 라이브러리 및 헬퍼 임포트
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { loadTranslations, t, TranslationMap } from '@/utils/translationHelper';

// 2. Supabase 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 3. 상수 데이터
const MODE_NAMES: Record<string, string> = {
  brawlBall: 'Brawl Ball', gemGrab: 'Gem Grab', hotZone: 'Hot Zone',
  knockout: 'Knockout', heist: 'Heist', bounty: 'Bounty'
};

const MODE_ICONS: Record<string, string> = {
  brawlBall: '/icons/mode-brawlball.png',
  gemGrab: '/icons/mode-gemgrab.png',
  hotZone: '/icons/mode-hotzone.png',
  knockout: '/icons/mode-knockout.png',
  heist: '/icons/mode-heist.png',
  bounty: '/icons/mode-bounty.png',
};

const UI_TEXT = {
  ko: { 
    tier: '티어', brawler: '브롤러', match: '매치', win: '승률', score: '점수', 
    opponent: '상대', back: '목록으로',
    score_desc: '승률과 픽률을 기반으로 산출된 점수' 
  },
  en: { 
    tier: 'Tier', brawler: 'Brawler', match: 'Match', win: 'Win%', score: 'Score', 
    opponent: 'Opponent', back: 'Back to List',
    score_desc: 'Score based on Win Rate & Pick Rate'
  },
  ja: { 
    tier: 'ティア', brawler: 'キャラ', match: '対戦数', win: '勝率', score: 'スコア', 
    opponent: '相手', back: '一覧に戻る',
    score_desc: '勝率と使用率に基づくスコア'
  },
};

// 4. 타입 정의
interface BrawlerStat {
  brawler_name: string; match_count: number; win_count: number;
  win_rate: number; pick_rate: number; total_score: number;
}

interface MatchupStat {
  opponent_name: string; match_count: number; win_rate: number;
}

export default function BrawlMetaDashboard() {
  // === State ===
  const [modes, setModes] = useState<string[]>([]);
  const [maps, setMaps] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState('');
  const [selectedMap, setSelectedMap] = useState('');
  const [stats, setStats] = useState<BrawlerStat[]>([]);
  const [selectedBrawler, setSelectedBrawler] = useState<string | null>(null);
  const [matchups, setMatchups] = useState<MatchupStat[]>([]);
  const [brawlerImages, setBrawlerImages] = useState<Record<string, string>>({});
  const [mapImages, setMapImages] = useState<Record<string, string>>({});
  const [transMap, setTransMap] = useState<TranslationMap>({});
  const [lang, setLang] = useState<'ko' | 'en' | 'ja'>('ko');

  const normalizeName = (name: string) => name?.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '';

  // === 초기화 (데이터 로딩) ===
  useEffect(() => {
    async function init() {
      try {
        const trData = await loadTranslations();
        setTransMap(trData);

        let allModes: any[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase.from('brawler_stats').select('mode').range(from, from + 999);
          if (error) throw error;
          if (data && data.length > 0) {
            allModes = [...allModes, ...data];
            hasMore = data.length === 1000;
            from += 1000;
          } else { hasMore = false; }
        }
        setModes(Array.from(new Set(allModes.map((d: any) => d.mode))).sort());

        const { data: bImg } = await supabase.from('image_brawlers').select('name, image_url').limit(1000);
        if (bImg) {
          const bMap: any = {};
          bImg.forEach(i => bMap[normalizeName(i.name)] = i.image_url);
          setBrawlerImages(bMap);
        }
        const { data: mImg } = await supabase.from('image_maps').select('name, image_url').limit(1000);
        if (mImg) {
          const mMap: any = {};
          mImg.forEach(i => mMap[normalizeName(i.name)] = i.image_url);
          setMapImages(mMap);
        }
      } catch (err) {
        console.error("Initialization Error:", err);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (selectedMode) {
      async function fetchMaps() {
        let allMaps: any[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data } = await supabase.from('brawler_stats').select('map').eq('mode', selectedMode).range(from, from + 999);
          if (data && data.length > 0) {
            allMaps = [...allMaps, ...data];
            hasMore = data.length === 1000;
            from += 1000;
          } else { hasMore = false; }
        }
        setMaps(Array.from(new Set(allMaps.map((d: any) => d.map))).sort());
      }
      fetchMaps();
    }
    setSelectedMap(''); setStats([]); setSelectedBrawler(null); setMatchups([]);
  }, [selectedMode]);

  useEffect(() => {
    if (selectedMode && selectedMap) {
      supabase.from('brawler_stats').select('*').eq('mode', selectedMode).eq('map', selectedMap)
        .order('total_score', { ascending: false }).then(({ data }) => setStats(data as BrawlerStat[] || []));
    }
    setSelectedBrawler(null);
  }, [selectedMode, selectedMap]);

  const fetchMatchups = async (brawlerName: string) => {
    setSelectedBrawler(brawlerName);
    const { data } = await supabase.from('brawler_matchups')
      .select('opponent_name, match_count, win_rate')
      .eq('mode', selectedMode).eq('map', selectedMap).eq('brawler_name', brawlerName)
      .order('match_count', { ascending: false });
    setMatchups(data as MatchupStat[] || []);
  };

  const getTierStyle = (score: number) => {
    if (score >= 3) return { l: 'OP', row: 'bg-[#581c87] border-purple-500/50' };
    if (score >= 2.5) return { l: 'S', row: 'bg-[#064e3b] border-emerald-500/50' };
    if (score >= 1.5) return { l: 'A', row: 'bg-[#15803d] border-green-500/50' };
    if (score >= 0.0) return { l: 'B', row: 'bg-[#4d7c0f] border-lime-500/50' };
    if (score >= -1.0) return { l: 'C', row: 'bg-[#a16207] border-yellow-600/50' };
    if (score >= -1.5) return { l: 'D', row: 'bg-[#c2410c] border-orange-500/50' };
    return { l: 'F', row: 'bg-[#b91c1c] border-red-600/50' };
  };

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return 'bg-[#064e3b]/80 border-emerald-500/40 text-emerald-300';
    if (rate >= 52) return 'bg-[#14532d]/60 border-green-600/30 text-green-300';
    if (rate >= 48) return 'bg-[#27272a]/60 border-zinc-700 text-zinc-300';
    if (rate >= 40) return 'bg-[#451a03]/60 border-orange-800/30 text-orange-300';
    return 'bg-[#450a0a]/80 border-red-900/40 text-red-300';
  };

  const getBrawlerImg = (name: string) => brawlerImages[normalizeName(name)] || null;
  const getMapImg = (name: string) => mapImages[normalizeName(name)] || null;

  // === 화면 렌더링 ===
  return (
    // 'desktop-container': PC에서 가로 배치 강제
    <div className="desktop-container h-screen md:h-[98vh] w-full max-w-[1920px] bg-zinc-950 text-white flex flex-col overflow-hidden font-sans m-auto md:mt-[1vh] border-none md:border border-white/5 rounded-none md:rounded-3xl shadow-2xl">
      
      {/* ================= 왼쪽 섹션 ================= 
         'desktop-left': PC에서 너비 53% 강제
      */}
      <section className={`w-full flex-col border-r border-white/5 bg-[#080808] h-full overflow-hidden desktop-left ${selectedBrawler ? 'hidden' : 'flex'}`}>
        
        {/* 헤더 */}
        <div className="p-4 md:p-6 space-y-4 md:space-y-5 border-b border-white/5 bg-zinc-900/30 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 md:gap-4">
              <img 
                src="/icons/logo.png" 
                alt="Logo" 
                className="w-[40px] h-[40px] min-w-[40px] min-h-[40px] object-contain drop-shadow-md hover:scale-110 transition-transform duration-300"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              <h1 className="text-xl md:text-2xl font-black italic tracking-tighter text-yellow-400 uppercase leading-none">
                {lang === 'ko' ? '브롤 경쟁전 메타' : lang === 'ja' ? 'ブロスタ ガチバトル メタ' : 'Brawl Ranked Meta'}
              </h1>
            </div>

            <div className="flex gap-1">
               {(['ko', 'en', 'ja'] as const).map((l) => (
                 <button 
                   key={l} onClick={() => setLang(l)}
                   className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${lang === l ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}
                 >
                   {l === 'ko' ? 'KR' : l === 'en' ? 'EN' : 'JP'}
                 </button>
               ))}
            </div>
          </div>
          
          {/* 필터 */}
          <div className="flex gap-2 md:gap-3 items-end">
            <select 
              className="w-full max-w-[160px] bg-zinc-900 border border-zinc-700 px-4 py-3.5 rounded-2xl font-black text-[11px] outline-none focus:border-yellow-400 text-center cursor-pointer appearance-none uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95" 
              value={selectedMode} 
              onChange={(e) => setSelectedMode(e.target.value)}
            >
              <option value="">-- MODE --</option>
              {modes.map(m => <option key={m} value={m}>{t(transMap, m, lang)}</option>)}
            </select>
            <select 
              className="w-full max-w-[180px] bg-zinc-900 border border-zinc-700 px-4 py-3.5 rounded-2xl font-black text-[11px] outline-none disabled:opacity-20 focus:border-yellow-400 text-center cursor-pointer appearance-none uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95" 
              disabled={!selectedMode} 
              value={selectedMap} 
              onChange={(e) => setSelectedMap(e.target.value)}
            >
              <option value="">-- MAP --</option>
              {maps.map(m => <option key={m} value={m}>{t(transMap, m, lang)}</option>)}
            </select>

            <div className="ml-auto pb-1 text-[9px] text-zinc-500 font-medium text-right whitespace-nowrap opacity-80 tracking-tight">
              * {UI_TEXT[lang].score_desc}
            </div>
          </div>
        </div>

        {/* 리스트 헤더 */}
        <div className="grid grid-cols-12 px-3 md:px-5 py-3 md:py-4 bg-zinc-900/90 text-[10px] font-black text-zinc-500 uppercase tracking-widest sticky top-0 z-10 border-b border-white/5 shrink-0">
          <div className="col-span-1 text-center hidden sm:block">#</div>
          {/* [수정] 티어 칸 비율 조정 (1칸) */}
          <div className="col-span-2 sm:col-span-1 text-center">{UI_TEXT[lang].tier}</div>
          <div className="col-span-1"></div>
          {/* [수정] 브롤러 이름 칸 4->3 줄임 */}
          <div className="col-span-3 text-center">{UI_TEXT[lang].brawler}</div>
          {/* [수정] 매치 칸 항상 보임 (2칸) */}
          <div className="col-span-2 text-center">{UI_TEXT[lang].match}</div>
          {/* [수정] 승률 칸 3->2 줄임 */}
          <div className="col-span-2 text-center">{UI_TEXT[lang].win}</div>
          <div className="col-span-2 text-center">{UI_TEXT[lang].score}</div>
        </div>

        {/* 리스트 본문 */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-2.5 custom-scrollbar overflow-x-hidden min-h-0">
          {stats.map((row, idx) => {
            const style = getTierStyle(row.total_score);
            const isActive = selectedBrawler === row.brawler_name;
            return (
              <div key={row.brawler_name} onClick={() => fetchMatchups(row.brawler_name)} className={`grid grid-cols-12 items-center px-2 md:px-4 py-3 rounded-2xl border transition-all duration-200 cursor-pointer ${style.row} ${isActive ? 'ring-2 ring-yellow-400 scale-[1.01] brightness-125 shadow-lg' : 'active:scale-95 md:active:scale-100 md:hover:brightness-110'}`}>
                <div className="col-span-1 text-center font-black italic text-white/50 text-[10px] hidden sm:block">#{idx + 1}</div>
                <div className="col-span-2 sm:col-span-1 text-center font-black text-[16px] md:text-[18px] text-white">{style.l}</div>
                
                <div className="col-span-1 flex justify-center">
                  <div className="w-[32px] h-[32px] md:w-[40px] md:h-[40px] overflow-hidden rounded-lg bg-zinc-900">
                    <img 
                      src={getBrawlerImg(row.brawler_name) || ''} 
                      className="w-full h-full object-cover"
                      alt="" 
                    />
                  </div>
                </div>

                <div className="col-span-3 text-center font-black uppercase text-[10px] md:text-[11px] truncate px-1 text-white">
                  {t(transMap, row.brawler_name, lang)}
                </div>
                <div className="col-span-2 text-center text-[12px] font-bold text-white/90">{row.match_count}</div>
                <div className="col-span-2 text-center text-[11px] md:text-[12px] font-black text-white">{row.win_rate}%</div>
                <div className="col-span-2 text-center font-black text-[11px] md:text-[12px] text-white italic">{Number(row.total_score).toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= 오른쪽 섹션: 상세 정보 ================= 
         'desktop-right': PC에서 너비 47% 강제
      */}
      <section className={`w-full bg-[#020202] flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden border-l border-white/5 h-full desktop-right ${selectedBrawler ? 'flex' : 'hidden'}`}>
        {!selectedMap ? (
          <div className="h-full flex items-center justify-center text-zinc-900 font-black text-[50px] md:text-[100px] opacity-5 transform -rotate-12 uppercase tracking-tighter select-none">Brawl Meta</div>
        ) : !selectedBrawler ? (
          <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-700 overflow-hidden">
            <div className="w-full flex items-center justify-center gap-2 md:gap-3 px-4 mb-4">
              {selectedMode && MODE_ICONS[selectedMode] && (
                <img 
                  src={MODE_ICONS[selectedMode]} 
                  alt={selectedMode} 
                  className="w-[30px] h-[30px] min-w-[30px] min-h-[30px] object-contain drop-shadow-lg"
                />
              )}
              <h3 className="text-xl md:text-3xl font-black italic text-yellow-400 uppercase tracking-[0.2em] md:tracking-[0.4em] drop-shadow-2xl text-center">
                {t(transMap, selectedMap, lang)}
              </h3>
            </div>
            <div className="relative w-[90%] md:w-[85%] h-[60%] md:h-[75%] flex items-center justify-center">
              {getMapImg(selectedMap) && <img src={getMapImg(selectedMap)!} alt={selectedMap} className="w-full h-full object-contain" />}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col animate-in slide-in-from-right-8 duration-500 z-20 pt-2 md:pt-4">
            <div className="flex flex-col items-center border-b border-white/10 pb-4 md:pb-6 mb-4 md:mb-6 shrink-0">
              <div className="w-[100px] h-[100px] md:w-[120px] md:h-[120px] overflow-hidden rounded-2xl bg-zinc-900 border border-white/10 shadow-xl mb-3 flex items-center justify-center">
                <img 
                  src={getBrawlerImg(selectedBrawler) || ''} 
                  className="w-full h-full object-cover" 
                  alt={selectedBrawler || ''} 
                />
              </div>
              <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-yellow-400 leading-none mb-4 text-center">
                {t(transMap, selectedBrawler, lang)}
              </h2>
              <button 
                onClick={() => setSelectedBrawler(null)} 
                className="bg-yellow-400 text-black px-8 py-3 md:px-10 md:py-4 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:scale-105 active:scale-95 transition-all"
              >
                ← {UI_TEXT[lang].back}
              </button>
            </div>

            <div className="grid grid-cols-12 px-2 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 mb-3 shrink-0 w-full">
              <div className="col-span-1"></div>
              <div className="col-span-1"></div>
              <div className="col-span-4 pl-3">{UI_TEXT[lang].opponent}</div>
              <div className="col-span-3 text-center">{UI_TEXT[lang].win}</div>
              <div className="col-span-2 text-right pr-2">{UI_TEXT[lang].match}</div>
              <div className="col-span-1"></div>
            </div>

            <div className="flex-1 w-full overflow-y-auto space-y-1.5 pr-1 custom-scrollbar pb-10 overflow-x-hidden min-h-0">
              {matchups.map((m) => {
                const heatStyle = getWinRateColor(m.win_rate);
                return (
                  <div key={m.opponent_name} className={`grid grid-cols-12 items-center py-2 md:py-2.5 rounded-xl border transition-all duration-200 ${heatStyle}`}>
                    <div className="col-span-1"></div>
                    <div className="col-span-1 flex justify-center">
                      <div className="w-[30px] h-[30px] md:w-[40px] md:h-[40px] overflow-hidden rounded-lg bg-black/30 shadow-sm">
                          <img 
                          src={getBrawlerImg(m.opponent_name) || ''} 
                          className="w-full h-full object-cover"
                          alt="" 
                        />
                      </div>
                    </div>
                    <div className="col-span-4 pl-3 flex items-center">
                      <span className="font-black text-[10px] uppercase truncate text-white tracking-tight">
                        {t(transMap, m.opponent_name, lang)}
                      </span>
                    </div>
                    <div className="col-span-3 text-center">
                      <span className="font-black italic text-[12px] md:text-[14px]">{m.win_rate}%</span>
                    </div>
                    <div className="col-span-2 text-right pr-2">
                      <span className="font-black italic text-[12px] md:text-[14px]">{m.match_count}</span>
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* [중요] PC 화면(768px 이상) 강제 레이아웃 지정 */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        body { overflow: hidden; background-color: #09090b; }

        @media (min-width: 768px) {
          .desktop-container {
            display: flex !important;
            flex-direction: row !important;
          }
          .desktop-left {
            display: flex !important;
            width: 53% !important;
          }
          .desktop-right {
            display: flex !important;
            width: 47% !important;
          }
        }
      `}</style>
    </div>
  );
}