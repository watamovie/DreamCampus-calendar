import { createEvents } from "ics";        // ← これだけ
import { DateTime } from "luxon";

/* rows[] -> ics 文字列 */
export function buildICS(rows) {
  // createEvents は [VEVENT, …] 配列を受け取る
  const events = rows.map(r => {
    if (!r.summary.trim())      throw new Error("行「" + r.date + "」: 科目が空です");
    if (!r.description.trim())  throw new Error("行「" + r.date + "」: DESCRIPTION が空です");

    const [y,m,d] = r.date.split("-").map(Number);
    const [sh,sm] = r.start.split(":").map(Number);
    const [eh,em] = r.end.split(":").map(Number);
    const now = DateTime.utc();
    const ts  = [now.year, now.month, now.day, now.hour, now.minute];

    // ★ タグ表記を「オンデバ → オンデマ」に補正
    const tag = r.tag === 'オンデバ' ? 'オンデマ' : r.tag;

    return {
      title      : tag ? `【${tag}】${r.summary}` : r.summary,
      description: r.description,
      location   : r.location,
      categories : tag ? [tag] : undefined,
      start      : [y,m,d,sh,sm],
      end        : [y,m,d,eh,em],
      uid        : `${r.id}@dreamcampus`,
      productId  : "-//DreamCampus//Calendar//JP",
      created     : ts,              // ✅ 配列形式
      lastModified: ts               // ✅ 正しいキー名
    };
  });

  const { error, value } = createEvents(events);
  if (error) {
    console.table(error.errors);                        // コンソールで一覧
    const msg = error.errors
      .map(e => `${e.path || 'unknown'}: «${e.value}» (${e.type})`)
      .join('\n');
    alert(`ICS 生成でエラーが発生しました:\n${msg}`);
    throw error;
  }
  return value;                    // ← 完成した .ics テキスト
}

/* -------- ダウンロード util -------- */
export function downloadICS(text, filename) {
  const blob = new Blob([text], { type: "text/calendar" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}