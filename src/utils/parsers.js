/* DESCRIPTION から分類タグ推定 */
export function classifyTag (desc) {
    if (!desc) return '';
    if (/非同期/.test(desc)) return 'オンデマ';
    if (/遠隔授業.*同期/.test(desc) || /Zoom/i.test(desc)) return 'zoom';
    return /遠隔授業/.test(desc) ? 'オンデマ' : '対面';
  }
  
/* DESCRIPTION から場所を抽出 */
export function extractLocation(desc) {
  if (!desc) return '';
  // 教員名 "(○○)" の後ろを優先的に拾う
  let m = desc.match(/\/\s*\([^/]*\)\s*\/\s*([^/]+?)(?:\s*\/|$)/);
  if (m) return m[1].trim();

  // 従来どおり「○○室」パターンも許可 (末尾に英字が付く場合も考慮)
  m = desc.match(/\/\s*([^/]*?室[^/]*)\s*(?:\/|$)/);
  return m ? m[1].trim() : '';
}
