'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
// ▼ [추가 1] 번역 헬퍼 함수 가져오기 (경로가 다르면 수정해주세요)
import { loadTranslations, t, TranslationMap } from '@/utils/translationHelper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// (MODE_NAMES는 번역 테이블에 모드명이 있다면 굳이 필요 없지만, 혹시 몰라 둡니다)
const MODE_NAMES: Record<string, string> = {
  brawlBall: 'Brawl Ball', gemGrab: 'Gem Grab', hotZone: 'Hot Zone',
  knockout: 'Knockout', heist: 'Heist', bounty: 'Bounty'
};

// ▼ [추가 2] UI 고정 텍스트 번역을 위한 간단한 로컬 사전
const UI_TEXT = {
  ko: { tier: '티어', brawler: '브롤러', match: '매치', win: '승률', score: '점수', opponent: '상대', back: '뒤로가기' },
  en: { tier: 'Tier', brawler: 'Brawler', match: 'Match', win: 'Win%', score: 'Score', opponent: 'Opponent', back: 'Back' },
  ja: { tier: 'ティア', brawler: 'キャラ', match: '対戦数', win: '勝率', score: 'スコア', opponent: '相手', back: '戻る' },
};

interface BrawlerStat {
  brawler_name: string; match_count: number; win_count: number;
  win_rate: number; pick_rate: number; total_score: number;
}

interface MatchupStat {
  opponent_name: string; match_count: number; win_rate: number;
}

export default function BrawlMetaDashboard() {
  const [modes, setModes] = useState<string[]>([]);
  const [maps, setMaps] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState('');
  const [selectedMap, setSelectedMap] = useState('');
  const [stats, setStats] = useState<BrawlerStat[]>([]);
  const [selectedBrawler, setSelectedBrawler] = useState<string | null>(null);
  const [matchups, setMatchups] = useState<MatchupStat[]>([]);
  const [brawlerImages, setBrawlerImages] = useState<Record<string, string>>({});
  const [mapImages, setMapImages] = useState<Record<string, string>>({});

  // ▼ [추가 3] 번역 관련 State 추가
  const [transMap, setTransMap] = useState<TranslationMap>({});
  const [lang, setLang] = useState<'ko' | 'en' | 'ja'>('ko'); // 기본 언어

  const normalizeName = (name: string) => name?.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '';

  useEffect(() => {
    async function init() {
      try {
        // ▼ [추가 4] 번역 데이터 가져오기 (병렬 처리 권장하나, 기존 흐름 유지)
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

  return (
    <div className="h-[98vh] bg-zinc-950 text-white flex flex-col overflow-hidden font-sans m-auto mt-[1vh] border border-white/5 rounded-3xl shadow-2xl">
      <main className="flex-1 flex overflow-hidden">
        
        {/* 왼쪽 섹션: 티어 리스트 */}
        <section className="w-[53%] flex flex-col border-r border-white/5 bg-[#080808]">
          <div className="p-6 space-y-5 border-b border-white/5 bg-zinc-900/30">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-black italic tracking-tighter text-yellow-400 uppercase leading-none">
               {/* 예: lang이 'ko'면 '브롤 메타', 'en'이면 'Brawl Meta' */}
                {lang === 'ko' ? '브롤 경쟁전 메타' : lang === 'ja' ? 'ブロスタ ガチバトル メタ' : 'Brawl Ranked Meta'}
              </h1>
              {/* ▼ [추가 5] 언어 변경 버튼 */}
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
            
            <div className="flex gap-3">
              <select 
                className="w-full max-w-[160px] bg-zinc-900 border border-zinc-700 px-4 py-3.5 rounded-2xl font-black text-[11px] outline-none focus:border-yellow-400 text-center cursor-pointer appearance-none uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95" 
                value={selectedMode} 
                onChange={(e) => setSelectedMode(e.target.value)}
              >
                <option value="">-- MODE --</option>
                {/* ▼ [추가 6] 모드 이름 번역 적용 */}
                {modes.map(m => <option key={m} value={m}>{t(transMap, m, lang)}</option>)}
              </select>
              <select 
                className="w-full max-w-[180px] bg-zinc-900 border border-zinc-700 px-4 py-3.5 rounded-2xl font-black text-[11px] outline-none disabled:opacity-20 focus:border-yellow-400 text-center cursor-pointer appearance-none uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95" 
                disabled={!selectedMode} 
                value={selectedMap} 
                onChange={(e) => setSelectedMap(e.target.value)}
              >
                <option value="">-- MAP --</option>
                {/* ▼ [추가 7] 맵 이름 번역 적용 */}
                {maps.map(m => <option key={m} value={m}>{t(transMap, m, lang)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-12 px-5 py-4 bg-zinc-900/90 text-[10px] font-black text-zinc-500 uppercase tracking-widest sticky top-0 z-10 border-b border-white/5">
            <div className="col-span-1 text-center">#</div>
            {/* ▼ [추가 8] UI 헤더 번역 */}
            <div className="col-span-1 text-center">{UI_TEXT[lang].tier}</div>
            <div className="col-span-1"></div>
            <div className="col-span-3 text-center">{UI_TEXT[lang].brawler}</div>
            <div className="col-span-2 text-center">{UI_TEXT[lang].match}</div>
            <div className="col-span-2 text-center">{UI_TEXT[lang].win}</div>
            <div className="col-span-2 text-center">{UI_TEXT[lang].score}</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar overflow-x-hidden">
            {stats.map((row, idx) => {
              const style = getTierStyle(row.total_score);
              const isActive = selectedBrawler === row.brawler_name;
              return (
                <div key={row.brawler_name} onClick={() => fetchMatchups(row.brawler_name)} className={`grid grid-cols-12 items-center px-4 py-3 rounded-2xl border transition-all duration-200 cursor-pointer ${style.row} ${isActive ? 'ring-2 ring-yellow-400 scale-[1.01] brightness-125 shadow-lg' : 'hover:brightness-110'}`}>
                  <div className="col-span-1 text-center font-black italic text-white/50 text-[10px]">#{idx + 1}</div>
                  <div className="col-span-1 text-center font-black text-[18px] text-white">{style.l}</div>
                  
                  <div className="col-span-1 flex justify-center">
                    <div style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px' }} className="overflow-hidden rounded-lg bg-zinc-900">
                      {/* 이미지는 원본 영어 이름(ID)으로 찾습니다 */}
                      <img 
                        src={getBrawlerImg(row.brawler_name) || ''} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        alt="" 
                      />
                    </div>
                  </div>

                  {/* ▼ [추가 9] 리스트의 브롤러 이름 번역 */}
                  <div className="col-span-3 text-center font-black uppercase text-[11px] truncate px-1 text-white">
                    {t(transMap, row.brawler_name, lang)}
                  </div>
                  <div className="col-span-2 text-center text-[12px] font-bold text-white/90">{row.match_count}</div>
                  <div className="col-span-2 text-center text-[12px] font-black text-white">{row.win_rate}%</div>
                  <div className="col-span-2 text-center font-black text-[12px] text-white italic">{Number(row.total_score).toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 오른쪽 섹션 */}
        <section className="w-[47%] bg-[#020202] flex flex-col items-center justify-center p-6 relative overflow-hidden border-l border-white/5">
          {!selectedMap ? (
            <div className="h-full flex items-center justify-center text-zinc-900 font-black text-[100px] opacity-5 transform -rotate-12 uppercase tracking-tighter select-none">Brawl Meta</div>
          ) : !selectedBrawler ? (
            <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-700 overflow-hidden">
              <div className="absolute top-10 w-full text-center z-10 px-4">
                {/* ▼ [추가 10] 선택된 맵 이름 번역 */}
                <h3 className="text-3xl font-black italic text-yellow-400 uppercase tracking-[0.4em] drop-shadow-2xl">
                  {t(transMap, selectedMap, lang)}
                </h3>
              </div>
              <div className="relative w-[85%] h-[75%] flex items-center justify-center mt-12">
                {getMapImg(selectedMap) && <img src={getMapImg(selectedMap)!} alt={selectedMap} className="w-full h-full object-contain" />}
              </div>
            </div>
          ) : (
            /* 카운터 데이터 분석 영역 */
            <div className="w-full h-full flex flex-col animate-in slide-in-from-right-8 duration-500 z-20 pt-4">
              <div className="flex flex-col items-center border-b border-white/10 pb-6 mb-6">
                
                <div 
                  style={{ width: '120px', height: '120px', minWidth: '120px', minHeight: '120px' }} 
                  className="overflow-hidden rounded-2xl bg-zinc-900 border border-white/10 shadow-xl mb-3 flex items-center justify-center"
                >
                  <img 
                    src={getBrawlerImg(selectedBrawler) || ''} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    alt={selectedBrawler || ''} 
                  />
                </div>

                {/* ▼ [추가 11] 선택된 브롤러 이름 번역 */}
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-yellow-400 leading-none">
                  {t(transMap, selectedBrawler, lang)}
                </h2>
                <button 
                  onClick={() => setSelectedBrawler(null)} 
                  className="mt-6 bg-yellow-400 text-black px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:scale-105 active:scale-95 transition-all"
                >
                  {/* ▼ [추가 12] 뒤로가기 버튼 번역 */}
                  ← {UI_TEXT[lang].back}
                </button>
              </div>

              {/* 헤더 */}
              <div className="grid grid-cols-12 px-2 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 mb-3">
                <div className="col-span-1"></div>
                <div className="col-span-1"></div>
                {/* ▼ [추가 13] 상대편 헤더 번역 */}
                <div className="col-span-4 pl-3">{UI_TEXT[lang].opponent}</div>
                <div className="col-span-3 text-center">{UI_TEXT[lang].win}</div>
                <div className="col-span-2 text-right pr-2">{UI_TEXT[lang].match}</div>
                <div className="col-span-1"></div>
              </div>

              {/* 리스트 본문 */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar pb-10 overflow-x-hidden">
                {matchups.map((m) => {
                  const heatStyle = getWinRateColor(m.win_rate);
                  return (
                    <div key={m.opponent_name} className={`grid grid-cols-12 items-center py-2.5 rounded-xl border transition-all duration-200 ${heatStyle}`}>
                      <div className="col-span-1"></div>
                      
                      <div className="col-span-1 flex justify-center">
                        <div 
                          style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px' }} 
                          className="overflow-hidden rounded-lg bg-black/30 shadow-sm"
                        >
                           <img 
                            src={getBrawlerImg(m.opponent_name) || ''} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            alt="" 
                          />
                        </div>
                      </div>
                      
                      <div className="col-span-4 pl-3 flex items-center">
                        {/* ▼ [추가 14] 상대방 브롤러 이름 번역 */}
                        <span className="font-black text-[10px] uppercase truncate text-white tracking-tight">
                          {t(transMap, m.opponent_name, lang)}
                        </span>
                      </div>
                      <div className="col-span-3 text-center">
                        <span className="font-black italic text-[14px]">{m.win_rate}%</span>
                      </div>
                      <div className="col-span-2 text-right pr-2">
                        <span className="font-black italic text-[14px]">{m.match_count}</span>
                      </div>
                      <div className="col-span-1"></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        body { overflow: hidden; background-color: #09090b; }
      `}</style>
    </div>
  );
}