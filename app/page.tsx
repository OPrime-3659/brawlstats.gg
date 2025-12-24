'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 체크 (브라우저 콘솔에서 에러 확인용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MODE_NAMES: Record<string, string> = {
  brawlBall: 'Brawl Ball', gemGrab: 'Gem Grab', hotZone: 'Hot Zone',
  knockout: 'Knockout', heist: 'Heist', bounty: 'Bounty'
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

  const normalizeName = (name: string) => name?.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '';

  // 1. 초기 데이터 로드 (무한 루프 방지 및 1000개 제한 우회)
  useEffect(() => {
    async function init() {
      try {
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

  // 2. 모드 선택 시 맵 로드
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

  // 3. 맵 선택 시 티어 통계 로드
  useEffect(() => {
    if (selectedMode && selectedMap) {
      supabase.from('brawler_stats').select('*').eq('mode', selectedMode).eq('map', selectedMap)
        .order('total_score', { ascending: false }).then(({ data }) => setStats(data as BrawlerStat[] || []));
    }
    setSelectedBrawler(null);
  }, [selectedMode, selectedMap]);

  // 4. 브롤러 클릭 시 카운터 데이터 로드
  const fetchMatchups = async (brawlerName: string) => {
    setSelectedBrawler(brawlerName);
    const { data } = await supabase.from('brawler_matchups')
      .select('opponent_name, match_count, win_rate')
      .eq('mode', selectedMode).eq('map', selectedMap).eq('brawler_name', brawlerName)
      .order('match_count', { ascending: false });
    setMatchups(data as MatchupStat[] || []);
  };

  const getTierStyle = (score: number) => {
    if (score >= 1.5) return { l: 'S', row: 'bg-[#064e3b] border-emerald-500/50' };
    if (score >= 1.0) return { l: 'A', row: 'bg-[#15803d] border-green-500/50' };
    if (score >= 0.5) return { l: 'B', row: 'bg-[#4d7c0f] border-lime-500/50' };
    if (score >= 0.0) return { l: 'C', row: 'bg-[#a16207] border-yellow-600/50' };
    if (score >= -0.5) return { l: 'D', row: 'bg-[#c2410c] border-orange-500/50' };
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
            <h1 className="text-2xl font-black italic tracking-tighter text-yellow-400 uppercase leading-none">
              Brawl Meta <span className="text-white">Analysis</span>
            </h1>
            
            <div className="flex gap-3">
              <select className="w-full max-w-[160px] bg-zinc-900 border border-zinc-700 px-4 py-3.5 rounded-2xl font-black text-[11px] outline-none focus:border-yellow-400 text-center cursor-pointer appearance-none uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95" value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)}>
                <option value="">-- MODE --</option>
                {modes.map(m => <option key={m} value={m}>{MODE_NAMES[m] || m}</option>)}
              </select>
              <select className="w-full max-w-[180px] bg-zinc-900 border border-zinc-700 px-4 py-3.5 rounded-2xl font-black text-[11px] outline-none disabled:opacity-20 focus:border-yellow-400 text-center cursor-pointer appearance-none uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95" disabled={!selectedMode} value={selectedMap} onChange={(e) => setSelectedMap(e.target.value)}>
                <option value="">-- MAP --</option>
                {maps.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-12 px-5 py-4 bg-zinc-900/90 text-[10px] font-black text-zinc-500 uppercase tracking-widest sticky top-0 z-10 border-b border-white/5">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-1 text-center">Tier</div>
            <div className="col-span-1"></div>
            <div className="col-span-3 text-center">Brawler</div>
            <div className="col-span-2 text-center">Match</div>
            <div className="col-span-2 text-center">Win%</div>
            <div className="col-span-2 text-center">Score</div>
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
                    <img src={getBrawlerImg(row.brawler_name) || ''} className="w-8 h-8 min-w-[32px] max-w-[32px] object-contain rounded-lg" alt="" />
                  </div>
                  <div className="col-span-3 text-center font-black uppercase text-[11px] truncate px-1 text-white">{row.brawler_name}</div>
                  <div className="col-span-2 text-center text-[12px] font-bold text-white/90">{row.match_count}</div>
                  <div className="col-span-2 text-center text-[12px] font-black text-white">{row.win_rate}%</div>
                  <div className="col-span-2 text-center font-black text-[12px] text-white italic">{Number(row.total_score).toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 오른쪽 섹션: 중앙 집중 레이아웃 */}
        <section className="w-[47%] bg-[#020202] flex flex-col items-center justify-center p-6 relative overflow-hidden border-l border-white/5">
          {!selectedMap ? (
            <div className="h-full flex items-center justify-center text-zinc-900 font-black text-[100px] opacity-5 transform -rotate-12 uppercase tracking-tighter select-none">Brawl Meta</div>
          ) : !selectedBrawler ? (
            <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-700 overflow-hidden">
              <div className="absolute top-10 w-full text-center z-10 px-4">
                <h3 className="text-3xl font-black italic text-yellow-400 uppercase tracking-[0.4em] drop-shadow-2xl">{selectedMap}</h3>
              </div>
              <div className="relative w-[85%] h-[75%] flex items-center justify-center mt-12">
                {getMapImg(selectedMap) && <img src={getMapImg(selectedMap)!} alt={selectedMap} className="w-full h-full object-contain" />}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col animate-in slide-in-from-right-8 duration-500 z-20 pt-4">
              <div className="flex flex-col items-center border-b border-white/10 pb-6 mb-6">
                <img src={getBrawlerImg(selectedBrawler) || ''} className="w-16 h-16 object-contain rounded-2xl bg-zinc-900 p-2 border border-white/10 shadow-xl mb-3" alt="" />
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-yellow-400 leading-none">{selectedBrawler}</h2>
                
                {/* Back to Map 버튼 수정 (태그 불일치 오류 해결) */}
                <button 
                  onClick={() => setSelectedBrawler(null)} 
                  className="mt-6 bg-yellow-400 text-black px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:scale-105 active:scale-95 transition-all"
                >
                  ← Back to Map View
                </button>
              </div>

              <div className="grid grid-cols-12 px-2 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 mb-3">
                <div className="col-span-1"></div> 
                <div className="col-span-5 pl-2">Opponent</div>
                <div className="col-span-3 text-center">Win %</div>
                <div className="col-span-2 text-right pr-2">Matches</div>
                <div className="col-span-1"></div> 
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar pb-10 overflow-x-hidden">
                {matchups.map((m) => {
                  const heatStyle = getWinRateColor(m.win_rate);
                  return (
                    <div key={m.opponent_name} className={`grid grid-cols-12 items-center py-2.5 rounded-xl border transition-all duration-200 ${heatStyle}`}>
                      <div className="col-span-1"></div> 
                      <div className="col-span-5 flex items-center gap-3">
                        <img src={getBrawlerImg(m.opponent_name) || ''} className="w-8 h-8 min-w-[32px] max-w-[32px] object-contain rounded-lg bg-black/30" alt="" />
                        <span className="font-black text-[10px] uppercase truncate text-white tracking-tight">{m.opponent_name}</span>
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