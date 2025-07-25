import React, { useState, useEffect, useRef } from 'react';
import { DateTime } from 'luxon';
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
  const [autoReadError, setAutoReadError] = useState(false);

  /* 2-1-b. 自動読込フラグ */
  const needsAutoRead = useRef(true);

  /* 2-2. クリップボード読み取りボタン */
  async function handleReadClipboard () {
    try {
      const text = await navigator.clipboard.readText();
      parseJson(text);
    } catch (err) {
      alert('クリップボード読み取りに失敗しました。\n手動貼り付けしてください。');
    }
  }

  /* 2-3. JSON 解析 */
  function parseJson (text) {
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
      setErrors([]);
    } catch (e) {
      alert('JSON 解析に失敗しました');
      console.error(e);
    }
  }

  /* 2-4. 行編集ハンドラ */
  function updateRow (id, field, value) {
    setRows(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  /* 2-5. バリデーション */
  useEffect(() => {
    const errs = rows.flatMap(r => {
      const list = [];
      if (!r.date) list.push('日付未入力');
      if (!/^\d{2}:\d{2}$/.test(r.start)) list.push('開始時刻不正');
      if (!/^\d{2}:\d{2}$/.test(r.end)) list.push('終了時刻不正');
      if (!r.tag) list.push('分類タグ未入力');
      if (r.tag === '対面' && !r.location) list.push('対面なのに場所が空');
      return list.length ? { id: r.id, list } : [];
    });
    setErrors(errs);
  }, [rows]);

  const isValid = errors.length === 0 && rows.length > 0;

  /* 2-5-b. 最初のタップで自動読込 */
  useEffect(() => {
    function handleFirstPointer () {
      if (!needsAutoRead.current) return;
      needsAutoRead.current = false;
      document.body.removeEventListener('pointerdown', handleFirstPointer);
      autoReadClipboard();
    }
    document.body.addEventListener('pointerdown', handleFirstPointer, { once: true });

    return () => {
      document.body.removeEventListener('pointerdown', handleFirstPointer);
    };
  }, []);

  /* 自動クリップボード読込本体 */
  async function autoReadClipboard () {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt.trim().startsWith('[')) {
        parseJson(txt);
        return;
      }
      throw new Error('JSON らしい文字列ではなかった');
    } catch (e) {
      console.warn('auto clipboard read failed:', e);
      setAutoReadError(true);
    }
  }

  /* 2-6. ICS 生成 */
  function handleGenerate () {
    const icsText = buildICS(rows);
    const first = rows[0].date;
    const last  = rows.at(-1).date;
    const filename = `schedule_${first}_to_${last}.ics`;
    downloadICS(icsText, filename);
  }

  /* 2-7. 描画 */
  return (
    <div>
      <h1>DreamCampus Calendar Maker</h1>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={handleReadClipboard}>クリップ読み込み</button>
        <button onClick={() => parseJson(rawInput)}>貼り付け → 解析</button>
        <button disabled={!isValid} onClick={handleGenerate}>ICS 生成</button>
      </div>

      {autoReadError && (
        <p style={{ color: 'orange' }}>
          クリップボードの自動取得に失敗しました。<br />
          上の <b>「クリップ読み込み」</b> ボタンを押してください。
        </p>
      )}

      {/* 保険のテキストエリア */}
      <textarea
        placeholder="Clipboard が読めない環境用"
        style={{ width: '100%', minHeight: '6rem', marginTop: '0.5rem' }}
        value={rawInput}
        onChange={e => setRawInput(e.target.value)}
      />

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
            {rows.map(r => (
              <tr key={r.id}>
                {/* date */}
                <td>
                  <input type="date" value={r.date}
                    onChange={e => updateRow(r.id, 'date', e.target.value)} />
                </td>

                {/* start */}
                <td>
                  <input type="time" value={r.start}
                    onChange={e => updateRow(r.id, 'start', e.target.value)} />
                </td>

                {/* end */}
                <td>
                  <input type="time" value={r.end}
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
                    onChange={e => updateRow(r.id, 'location', e.target.value)} />
                </td>

                {/* description */}
                <td>
                  <textarea rows={2} value={r.description}
                    onChange={e => updateRow(r.id, 'description', e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* エラー一覧 */}
      {errors.length > 0 && (
        <ul style={{ color: 'red' }}>
          {errors.map(er => (
            <li key={er.id}>
              行 {rows.findIndex(r => r.id === er.id) + 1}: {er.list.join(' / ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}