/* DESCRIPTION から分類タグ推定 */
export function classifyTag (desc) {
    if (/非同期/.test(desc)) return 'オンデマ';
    if (/遠隔授業.*同期/.test(desc) || /Zoom/i.test(desc)) return 'zoom';
    return /遠隔授業/.test(desc) ? 'オンデマ' : '対面';
  }
  
  /* DESCRIPTION から「○○室」パターンを抽出 */
  export function extractLocation (desc) {
    const m = desc.match(/\/\s*([^/]*?室)\s*\//)
    return m ? m[1] : ''
  }