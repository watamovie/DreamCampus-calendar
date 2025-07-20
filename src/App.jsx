import React, { useState, useEffect, useRef } from 'react';
import { buildICS, downloadICS } from './utils/icsHelpers.js';
import { classifyTag, extractLocation } from './utils/parsers.js';

/* 1) 型定義的な初期値 -------------- */
const BLANK_EVENT = {
  id: '', date: '', start: '', end: '',
  summary: '', description: '',
  tag: '', location: ''
};

/* 2) UI レイヤー ------------------- */
export default function App () {
  /* 2-1. ステート */
  const [rows, setRows]       = useState([]);
  const [rawInput, setRawInput] = useState('');
  const [errors, setErrors]   = useState([]);
  const [warnings, setWarnings] = useState([]);
  const rowsRef = useRef([]);

  /* 2-2. クリップボード読み取りボタン */
  async function handleReadClipboard () {
    try {
      const text = await navigator.clipboard.readText();
      setRawInput(text);
      parseJson(text);
    } catch (err) {
      alert('クリップボード読み取りに失敗しました。\n手動貼り付けしてください。');
    }
  }

  /* 2-3. JSON 解析 */
  function parseJson (text, showAlert = true) {
    try {
      // 先頭/末尾のゴミ除去
      const cleaned = text.trim().replace(/^[^\[]*/, '').replace(/[^\]]*$/, '');
      const arr = JSON.parse(cleaned);

      const mapped = arr.map(ev => {
        const tag = classifyTag(ev.description || '');
        const location = extractLocation(ev.description || '');
        return {
          id: (crypto.randomUUID?.() || Math.random().toString(36).slice(2)),
          date: ev.date || '',
          start: ev.start || '',
          end: ev.end || '',
          summary: ev.summary || '',
          description: ev.description || '',
          tag,
          location
        };
      });
      setRows(mapped);
      rowsRef.current = mapped;
      setErrors([]);
      setWarnings([]);
    } catch (e) {
      if (showAlert) alert('JSON 解析に失敗しました');
      console.error(e);
      // 入力中の一時的な構文エラーではテーブルを消さない
      if (!showAlert) return;
      setRows([]);
      rowsRef.current = [];
    }
  }

  /* 2-4. 行編集ハンドラ */
  function updateRow (id, field, value) {
    setRows(prev => {
      const next = prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'description') {
          updated.tag = classifyTag(value);
          updated.location = extractLocation(value);
        }
        return updated;
      });
      rowsRef.current = next;
      return next;
    });
  }

  /* 2-5. バリデーション */
  useEffect(() => {
    rowsRef.current = rows;
    const errs = [];
    const warns = [];
    rows.forEach(r => {
      const elist = [];
      const wlist = [];
      if (!r.date) elist.push('日付未入力');
      if (!/^\d{2}:\d{2}$/.test(r.start)) elist.push('開始時刻不正');
      if (!/^\d{2}:\d{2}$/.test(r.end)) elist.push('終了時刻不正');
      if (!r.tag) elist.push('分類タグ未入力');
      if (r.tag === '対面' && !r.location) wlist.push('対面なのに場所が空');
      if (elist.length) errs.push({ id: r.id, list: elist });
      if (wlist.length) warns.push({ id: r.id, list: wlist });
    });
    setErrors(errs);
    setWarnings(warns);
  }, [rows]);

  const isValid = errors.length === 0 && rows.length > 0;

  // 自動読込機能は廃止

  /* 2-6. ICS 生成 */
  function handleGenerate () {
    const cur = rowsRef.current;
    const icsText = buildICS(cur);
    const first = cur[0].date;
    const last  = cur.at(-1).date;
    const filename = `schedule_${first}_to_${last}.ics`;
    downloadICS(icsText, filename);
  }

  /* 2-7. 描画 */
  return (
    <div className="container">
      <h1>DreamCampus Calendar Maker</h1>

      <div className="button-row">
        <button onClick={handleReadClipboard}>ペースト</button>
        <button disabled={!isValid} onClick={handleGenerate}>ICS 生成</button>
        <a href="./howto.html" className="button-link">使い方</a>
      </div>

      <textarea
        autoFocus
        placeholder="ここにイベント JSON を貼り付けてください"
        style={{ width: '100%', minHeight: '6rem', marginTop: '0.5rem' }}
        value={rawInput}
        onInput={e => { const txt = e.target.value; setRawInput(txt); parseJson(txt, false); }}
      />

      {/* エラー一覧 */}
      {errors.length > 0 && (
        <ul className="error-list">
          {errors.map(er => (
            <li key={er.id}>
              行 {rows.findIndex(r => r.id === er.id) + 1}: {er.list.join(' / ')}
            </li>
          ))}
        </ul>
      )}

      {/* 警告一覧 */}
      {warnings.length > 0 && (
        <ul className="warning-list">
          {warnings.map(wr => (
            <li key={wr.id}>
              行 {rows.findIndex(r => r.id === wr.id) + 1}: {wr.list.join(' / ')}
            </li>
          ))}
        </ul>
      )}

      {/* 編集テーブル */}
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>日付</th><th>開始</th><th>終了</th><th>科目</th>
              <th>分類</th><th>場所</th><th>DESCRIPTION</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const invalidDate = !r.date;
              const invalidStart = !/^\d{2}:\d{2}$/.test(r.start);
              const invalidEnd = !/^\d{2}:\d{2}$/.test(r.end);
              const invalidTag = !r.tag;
              const warnLoc = r.tag === '対面' && !r.location;
              return (
              <tr key={r.id}>
                {/* date */}
                <td>
                  <input type="date" value={r.date}
                    className={invalidDate ? 'invalid' : ''}
                    onChange={e => updateRow(r.id, 'date', e.target.value)} />
                </td>

                {/* start */}
                <td>
                  <input type="time" value={r.start}
                    className={invalidStart ? 'invalid' : ''}
                    onChange={e => updateRow(r.id, 'start', e.target.value)} />
                </td>

                {/* end */}
                <td>
                  <input type="time" value={r.end}
                    className={invalidEnd ? 'invalid' : ''}
                    onChange={e => updateRow(r.id, 'end', e.target.value)} />
                </td>

                {/* summary */}
                <td>
                  <input value={r.summary}
                    onChange={e => updateRow(r.id, 'summary', e.target.value)} />
                </td>

                {/* tag */}
                <td>
                  <select value={r.tag}
                    className={invalidTag ? 'invalid' : ''}
                    onChange={e => updateRow(r.id, 'tag', e.target.value)}>
                    <option value="">選択</option>
                    <option value="対面">対面</option>
                    <option value="zoom">zoom</option>
                    <option value="オンデマ">オンデマ</option>
                    <option value="見学">見学</option>
                  </select>
                </td>

                {/* location */}
                <td>
                  <input value={r.location}
                    className={warnLoc ? 'warning' : ''}
                    onChange={e => updateRow(r.id, 'location', e.target.value)} />
                </td>

                {/* description */}
                <td>
                  <textarea rows={2} value={r.description}
                    onChange={e => updateRow(r.id, 'description', e.target.value)} />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}

    </div>
  );
}