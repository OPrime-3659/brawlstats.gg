// 파일 위치: utils/translationHelper.ts
import { supabase } from './supabase'; // 기존에 있는 supabase 설정 파일 import

// 번역 데이터 타입 정의 (TypeScript용)
export interface TranslationMap {
  [key: string]: {
    ko: string;
    en: string;
    ja: string;
  };
}

// 1. DB에서 번역 데이터를 가져와서 '사전(Object)' 형태로 만드는 함수
export async function loadTranslations(): Promise<TranslationMap> {
  const { data, error } = await supabase.from('game_translations').select('*');
  
  if (error) {
    console.error('번역 로딩 실패:', error);
    return {};
  }

  // 배열을 객체로 변환: 검색 속도를 획기적으로 높임
  const transMap: TranslationMap = {};
  if (data) {
    data.forEach((row: any) => {
      transMap[row.item_key] = {
        ko: row.ko,
        en: row.en,
        ja: row.ja,
      };
    });
  }
  return transMap;
}

// 2. 실제 화면에서 글자를 바꿔주는 함수
export function t(transMap: TranslationMap, key: string, lang: 'ko' | 'en' | 'ja') {
  // 번역 데이터가 없거나, 해당 키가 없으면 -> 원래 영어 키(key) 반환
  if (!transMap || !transMap[key]) return key;
  
  // 해당 언어 번역이 있으면 반환, 없으면 원래 키 반환
  return transMap[key][lang] || key;
}