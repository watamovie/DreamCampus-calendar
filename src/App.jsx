import React, { useState, useEffect, useRef } from 'react';
import { buildICS, downloadICS } from './utils/icsHelpers.js';
import { classifyTag, extractLocation } from './utils/parsers.js';

const REMINDER_SHORTCUT_NAME = 'DreamCampus Reminders';

function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function combinedText(row) {
  return [row.summary, row.description, row.location, row.tag]
    .filter(Boolean)
    .join(' ');
}

const REMINDER_KEYWORD_PRESETS = [
  {
    key: '合格',
    label: '「合格」を含む予定',
    defaultSelected: false,
    test: (row) => combinedText(row).includes('合格')
  },
  {
    key: '実施済',
    label: '「実施済」など完了済みを含む予定',
    defaultSelected: false,
    test: (row) => /実施済み?/.test(combinedText(row))
  },
  {
    key: '完了',
    label: '「完了」を含む予定',
    defaultSelected: true,
    test: (row) => combinedText(row).includes('完了')
  },
  {
    key: '提出済',
    label: '「提出済」など提出済みを含む予定',
    defaultSelected: true,
    test: (row) => /提出済/.test(combinedText(row))
  }
];

function buildReminderPayload(rows) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    items: rows.map(row => ({
      title: row.summary,
      dueDate: row.date,
      dueTime: row.start,
      endTime: row.end,
      notes: row.description,
      location: row.location,
      tag: row.tag
    }))
  };
}

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
  const rowsRef = useRef([]);
  const [rawInput, setRawInput] = useState('');
  const [errors, setErrors]   = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState('');
  const [historyIndex, setHistoryIndex] = useState(0);
  const [maxHistory, setMaxHistory] = useState(0);
  const histRef = useRef(0);
  const [autoDownloadPending, setAutoDownloadPending] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderFilter, setReminderFilter] = useState(null);
  const [reminderPresets, setReminderPresets] = useState([]);

  // 初回マウント時にローカル保存を復元し履歴を初期化
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem('savedRows');
    } catch (e) {
      console.error('failed to access localStorage', e);
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRows(parsed);
        rowsRef.current = parsed;
      } catch (e) {
        console.error('failed to load saved data', e);
      }
    }
    window.history.replaceState({ rows: rowsRef.current, index: 0 }, '');
    histRef.current = 0;
    setHistoryIndex(0);
    setMaxHistory(0);
    const handler = (e) => {
      const st = e.state;
      if (st && Array.isArray(st.rows)) {
        setRows(st.rows);
        rowsRef.current = st.rows;
        setHistoryIndex(st.index);
        setMaxHistory((m) => Math.max(m, st.index));
        setEditingId(null);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  function sortRows (arr) {
    return [...arr].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      return 0;
    });
  }

  function groupRowsByDate(arr) {
    const groups = [];
    sortRows(arr).forEach(r => {
      const last = groups.at(-1);
      if (!last || last.date !== r.date) {
        groups.push({ date: r.date, items: [r] });
      } else {
        last.items.push(r);
      }
    });
    return groups;
  }

  function getIssues(r) {
    const errors = [];
    const warns = [];
    if (!r.date) errors.push('日付未入力');
    if (!r.start) errors.push('開始時刻未入力');
    else if (!/^\d{2}:\d{2}$/.test(r.start)) errors.push('開始時刻形式不正');
    if (!r.end) errors.push('終了時刻未入力');
    else if (!/^\d{2}:\d{2}$/.test(r.end)) errors.push('終了時刻形式不正');
    if (!r.summary.trim()) errors.push('科目名未入力');
    if (!r.tag) warns.push('分類タグ未入力');
    if (!r.description.trim()) warns.push('説明未入力');
    if (r.tag === '対面' && !r.location) warns.push('対面なのに場所が空');
    return { errors, warns };
  }

  function pushHistory(newRows) {
    histRef.current += 1;
    const idx = histRef.current;
    window.history.pushState({ rows: newRows, index: idx }, '');
    setHistoryIndex(idx);
    setMaxHistory(idx);
  }

  function addRow () {
    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const newRow = { ...BLANK_EVENT, id };
    const next = sortRows([...rowsRef.current, newRow]);
    setRows(next);
    rowsRef.current = next;
    pushHistory(next);
    setEditingId(id);
  }

  function deleteRow (id) {
    const next = sortRows(rowsRef.current.filter(r => r.id !== id));
    setRows(next);
    rowsRef.current = next;
    pushHistory(next);
    if (editingId === id) {
      setEditingId(null);
    }
  }

  function startEdit(id) {
    setEditingId(id);
  }

  function cancelEdit() {
    setEditingId(null);
  }


  function clearAll () {
    if (!confirm('全てのデータを削除しますか？')) return;
    const next = [];
    setRows(next);
    rowsRef.current = next;
    pushHistory(next);
    setRawInput('');
    setErrors([]);
    setWarnings([]);
    setAutoDownloadPending(false);
    setReminderModalOpen(false);
    try {
      localStorage.removeItem('savedRows');
    } catch (e) {
      console.error('failed to clear saved data', e);
    }
  }

  /* 2-2. クリップボード読み取りボタン */
  async function handleReadClipboard (silent = false) {
    setAutoDownloadPending(false);
    try {
      const text = await navigator.clipboard.readText();
      setRawInput(text);
      parseJson(text);
    } catch (err) {
      if (!silent) {
        alert('クリップボード読み取りに失敗しました。\n手動貼り付けしてください。');
        setToast('クリップボード読込に失敗しました');
        setTimeout(() => setToast(''), 3000);
      }
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
      const sorted = sortRows(mapped);
      setRows(sorted);
      rowsRef.current = sorted;
      if (showAlert) pushHistory(sorted);
      setErrors([]);
      setWarnings([]);
    } catch (e) {
      if (showAlert) alert('JSON 解析に失敗しました');
      console.error(e);
      // 入力中の一時的な構文エラーではテーブルを消さない
      if (!showAlert) return;
      setRows([]);
      rowsRef.current = [];
      setToast('JSON 読み込みエラー');
      setTimeout(() => setToast(''), 3000);
    }
  }

  /* 2-4. 行編集ハンドラ */
  function updateRow (id, field, value) {
    const updatedRows = rowsRef.current.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'description') {
        updated.tag = classifyTag(value);
        updated.location = extractLocation(value);
      }
      return updated;
    });
    const next = sortRows(updatedRows);
    setRows(next);
    rowsRef.current = next;
    pushHistory(next);
  }

  /* 2-5. バリデーション */
  useEffect(() => {
    const errs = [];
    const warns = [];
    rows.forEach(r => {
      const { errors: elist, warns: wlist } = getIssues(r);
      if (elist.length) errs.push({ id: r.id, list: elist });
      if (wlist.length) warns.push({ id: r.id, list: wlist });
    });
    setErrors(errs);
    setWarnings(warns);
    rowsRef.current = rows;
    try {
      localStorage.setItem('savedRows', JSON.stringify(rows));
    } catch (e) {
      console.error('failed to save data', e);
    }
  }, [rows]);

  const isValid = errors.length === 0 && rows.length > 0;
  const isComplete = errors.length === 0 && warnings.length === 0 && rows.length > 0;

  // クエリ取得時に欠損が無ければ自動で ICS を生成
  useEffect(() => {
    if (autoDownloadPending && isComplete) {
      handleGenerate();
      setAutoDownloadPending(false);
    }
  }, [autoDownloadPending, isComplete]);

  // ショートカットキー
  useEffect(() => {
    function onKeyDown(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (isValid) handleGenerate();
      } else if (mod && e.key === 'n') {
        e.preventDefault();
        addRow();
      } else if (mod && e.key.toLowerCase() === 'd' && e.shiftKey) {
        e.preventDefault();
        clearAll();
      } else if (mod && e.key.toLowerCase() === 'v' && e.shiftKey) {
        e.preventDefault();
        handleReadClipboard();
      } else if (e.key === 'Escape') {
        if (reminderModalOpen) {
          e.preventDefault();
          setReminderModalOpen(false);
        } else if (editingId !== null) {
          e.preventDefault();
          cancelEdit();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isValid, editingId, reminderModalOpen]);

  // ページ読み込み時に URL パラメータまたはクリップボードから読込
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('data');
    if (encoded) {
      try {
        // "+" が空白に変換されるケースに対応
        const fixed = encoded.replace(/\s/g, '+');
        const bytes = Uint8Array.from(atob(fixed), c => c.charCodeAt(0));
        const text = new TextDecoder().decode(bytes);
        setRawInput(text);
        parseJson(text);
        setAutoDownloadPending(true);
        return;
      } catch (e) {
        console.error('failed to parse data parameter', e);
      }
    }
    handleReadClipboard(true);
  }, []);

  /* 2-6. ICS 生成 */
  function handleGenerate () {
    try {
      const cur = sortRows(rowsRef.current);
      rowsRef.current = cur;
      const icsText = buildICS(cur);
      const first = cur[0].date;
      const last  = cur.at(-1).date;
      const filename = `schedule_${first}_to_${last}.ics`;
      downloadICS(icsText, filename);
      setToast('ICSファイルをダウンロードしました');
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      alert('ICSファイルの生成に失敗しました');
      console.error('failed to generate ICS', e);
    }
  }

  function openReminderModal() {
    const currentRows = rowsRef.current;
    if (currentRows.length === 0) return;
    const tagState = {};
    currentRows.forEach(r => {
      const key = r.tag || '';
      if (!(key in tagState)) tagState[key] = true;
    });
    const availablePresets = REMINDER_KEYWORD_PRESETS.filter(preset =>
      currentRows.some(row => preset.test(row))
    );
    const keywordState = {};
    availablePresets.forEach(preset => {
      keywordState[preset.key] = preset.defaultSelected;
    });
    setReminderPresets(availablePresets);
    setReminderFilter({
      tags: tagState,
      keywords: keywordState,
      sortBy: 'date',
      sortDir: 'asc'
    });
    setReminderModalOpen(true);
  }

  function toggleReminderTag(tagKey) {
    setReminderFilter(prev => ({
      ...prev,
      tags: {
        ...prev.tags,
        [tagKey]: !(prev.tags?.[tagKey] ?? true)
      }
    }));
  }

  function toggleReminderKeyword(keywordKey) {
    setReminderFilter(prev => ({
      ...prev,
      keywords: {
        ...prev.keywords,
        [keywordKey]: !(prev.keywords?.[keywordKey] ?? true)
      }
    }));
  }

  function changeReminderSort(sortBy) {
    setReminderFilter(prev => ({
      ...prev,
      sortBy
    }));
  }

  function changeReminderSortDir(sortDir) {
    setReminderFilter(prev => ({
      ...prev,
      sortDir
    }));
  }

  function getReminderCandidates() {
    if (!reminderFilter) return [];
    let filtered = [...rowsRef.current];
    filtered = filtered.filter(row => {
      const tagKey = row.tag || '';
      if (reminderFilter.tags && Object.keys(reminderFilter.tags).length) {
        const allowed = reminderFilter.tags[tagKey];
        if (allowed === false) return false;
      }
      for (const preset of reminderPresets) {
        if (!reminderFilter.keywords?.[preset.key] && preset.test(row)) {
          return false;
        }
      }
      return true;
    });

    const sortBy = reminderFilter.sortBy ?? 'date';
    const sortDir = reminderFilter.sortDir ?? 'asc';
    if (sortBy === 'summary') {
      filtered.sort((a, b) => a.summary.localeCompare(b.summary, 'ja'));
    } else if (sortBy === 'tag') {
      filtered.sort((a, b) => {
        const tagA = a.tag || '';
        const tagB = b.tag || '';
        if (tagA !== tagB) return tagA.localeCompare(tagB, 'ja');
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        if (a.start !== b.start) return a.start < b.start ? -1 : 1;
        return 0;
      });
    } else {
      filtered = sortRows(filtered);
    }

    if (sortDir === 'desc') {
      filtered.reverse();
    }
    return filtered;
  }

  function launchReminderShortcut() {
    const candidates = getReminderCandidates();
    if (candidates.length === 0) {
      alert('リマインダーに送る予定が選択されていません');
      return;
    }
    const payload = buildReminderPayload(candidates);
    const json = JSON.stringify(payload);
    const base64 = encodeBase64Utf8(json);
    const shortcutName = encodeURIComponent(REMINDER_SHORTCUT_NAME);
    const textParam = encodeURIComponent(base64);
    const shortcutUrl = `shortcuts://x-callback-url/run-shortcut?name=${shortcutName}&input=text&text=${textParam}`;
    setReminderModalOpen(false);
    setToast('リマインダー用ショートカットを開きます');
    setTimeout(() => setToast(''), 3000);
    setTimeout(() => {
      window.location.href = shortcutUrl;
    }, 120);
  }

  function renderRow(r, idx = 0, arr = []) {
    const invalidDate = !r.date;
    const invalidStart = !/^\d{2}:\d{2}$/.test(r.start);
    const invalidEnd = !/^\d{2}:\d{2}$/.test(r.end);
    const invalidSummary = !r.summary.trim();
    const warnTag = !r.tag;
    const warnDesc = !r.description.trim();
    const warnLoc = r.tag === '対面' && !r.location;
    const isNewDay = arr.length && idx > 0 && r.date !== arr[idx-1].date;
    return (
      <tr key={r.id} className={isNewDay ? 'new-day' : ''}>
        <td data-label="日付">
          <input type="date" value={r.date}
            className={invalidDate ? 'invalid' : ''}
            onChange={e => updateRow(r.id, 'date', e.target.value)} />
        </td>
        <td data-label="開始">
          <input type="time" value={r.start}
            className={invalidStart ? 'invalid' : ''}
            onChange={e => updateRow(r.id, 'start', e.target.value)} />
        </td>
        <td data-label="終了">
          <input type="time" value={r.end}
            className={invalidEnd ? 'invalid' : ''}
            onChange={e => updateRow(r.id, 'end', e.target.value)} />
        </td>
        <td data-label="科目">
          <input value={r.summary}
            className={invalidSummary ? 'invalid' : ''}
            onChange={e => updateRow(r.id, 'summary', e.target.value)} />
        </td>
        <td data-label="分類">
          <select value={r.tag}
            className={warnTag ? 'warning' : ''}
            onChange={e => updateRow(r.id, 'tag', e.target.value)}>
            <option value="">選択</option>
            <option value="対面">対面</option>
            <option value="zoom">zoom</option>
            <option value="オンデマ">オンデマ</option>
            <option value="見学">見学</option>
          </select>
        </td>
        <td data-label="場所">
          <input value={r.location}
            className={warnLoc ? 'warning' : ''}
            onChange={e => updateRow(r.id, 'location', e.target.value)} />
        </td>
        <td data-label="説明">
          <textarea rows={2} value={r.description}
            className={warnDesc ? 'warning' : ''}
            onChange={e => updateRow(r.id, 'description', e.target.value)} />
        </td>
        <td data-label="操作">
          <button onClick={() => deleteRow(r.id)}>削除</button>
        </td>
      </tr>
    );
  }

  /* 2-7. 描画 */
  return (
    <>
    <div className="container">
      <h1>DreamCampus to Calendar</h1>

      {editingId === null && (
        rows.length === 0 ? (
          <div className="button-row action-group">
            <button onClick={handleReadClipboard}>ペースト</button>
            <a href="./howto.html" className="button-link">使い方</a>
          </div>
        ) : (
          <>
            <div className="button-row action-group">
              <a href="./howto.html" className="button-link">使い方</a>
            </div>
            <div className="button-row" style={{marginTop: '0.5rem'}}>
              <button className="primary" disabled={!isValid} onClick={handleGenerate}>カレンダーに追加</button>
              <button disabled={rows.length === 0} onClick={openReminderModal}>リマインダーに追加</button>
            </div>
          </>
        )
      )}

      <textarea
        autoFocus
        placeholder="ここにイベント JSON を貼り付けてください"
        style={{ width: '100%', minHeight: '6rem', marginTop: '0.5rem' }}
        value={rawInput}
        onInput={e => { const txt = e.target.value; setRawInput(txt); parseJson(txt, false); }}
      />

      {rows.length > 0 && editingId === null && (
        <div className="button-row" style={{marginTop: '0.5rem'}}>
          <button onClick={clearAll}>クリア</button>
          <button onClick={openReminderModal} disabled={rows.length === 0}>リマインダーに追加</button>
        </div>
      )}

      {/* エラー一覧 */}
      {errors.length > 0 && (
        <ul className="error-list">
          {errors.map(er => (
            <li key={er.id}>
              <button onClick={() => startEdit(er.id)}>{er.list.join(' / ')}</button>
            </li>
          ))}
        </ul>
      )}

      {/* 警告一覧 */}
      {warnings.length > 0 && (
        <ul className="warning-list">
          {warnings.map(wr => (
            <li key={wr.id}>
              <button onClick={() => startEdit(wr.id)}>{wr.list.join(' / ')}</button>
            </li>
          ))}
        </ul>
      )}

      {/* 編集テーブル */}
      {rows.length > 0 && (
        <>
        <table className="desktop-table">
          <thead>
            <tr>
              <th>日付</th><th>開始</th><th>終了</th><th>科目</th>
              <th>分類</th><th>場所</th><th>説明</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sortRows(rows).map((r, idx, arr) => renderRow(r, idx, arr))}
          </tbody>
        </table>
        <div className="mobile-cards">
          {editingId === null ? (
            <>
              {groupRowsByDate(rows).map(g => (
                <div key={g.date} className="day-group">
                  <div className="day-header">{g.date}</div>
                  <div className="card-grid">
                    {g.items.map(r => {
                      const iss = getIssues(r);
                      const cls = iss.errors.length ? 'invalid' : (iss.warns.length ? 'warning' : '');
                      return (
                        <button key={r.id} className={`card ${cls}`} onClick={() => startEdit(r.id)}>
                          <div className="card-title">{r.tag ? `【${r.tag}】` : ''}{r.summary}</div>
                          <div className="card-sub">
                            {r.location && <span className="loc">{r.location}</span>}
                            <span className="time">{r.start}-{r.end}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="button-row" style={{marginTop: '0.5rem'}}>
                <button onClick={addRow}>追加</button>
              </div>
            </>
          ) : (
            <div className="edit-screen">
              <button onClick={cancelEdit} style={{marginBottom: '0.5rem'}}>戻る</button>
              <table className="mobile-edit">
                <tbody>
                  {renderRow(rows.find(r => r.id === editingId) ?? BLANK_EVENT)}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {rows.length > 0 && editingId === null && (
          <div className="button-row desktop-only" style={{marginTop: '0.5rem'}}>
            <button onClick={addRow}>追加</button>
          </div>
        )}
        </>
      )}

    </div>
    {toast && <div className="toast">{toast}</div>}
    {reminderModalOpen && reminderFilter && (
      <div className="modal-backdrop" role="presentation" onClick={() => setReminderModalOpen(false)}>
        <div className="modal" role="dialog" aria-modal="true" aria-label="リマインダーに追加" onClick={e => e.stopPropagation()}>
          <h2>リマインダーに追加</h2>
          <p className="modal-description">
            iPhone のリマインダーに追加したい予定を選び、並び順を確認してください。<br />
            合致する項目がショートカット <code>{REMINDER_SHORTCUT_NAME}</code> に送信されます。
          </p>
          <div className="modal-section">
            <h3>ソート条件</h3>
            <div className="modal-sort">
              <label>
                <input
                  type="radio"
                  name="reminder-sort"
                  checked={(reminderFilter.sortBy ?? 'date') === 'date'}
                  onChange={() => changeReminderSort('date')}
                /> 日付順
              </label>
              <label>
                <input
                  type="radio"
                  name="reminder-sort"
                  checked={reminderFilter.sortBy === 'summary'}
                  onChange={() => changeReminderSort('summary')}
                /> 科目名順
              </label>
              <label>
                <input
                  type="radio"
                  name="reminder-sort"
                  checked={reminderFilter.sortBy === 'tag'}
                  onChange={() => changeReminderSort('tag')}
                /> タグ順
              </label>
              <label>
                <span>→</span>
                <select
                  value={reminderFilter.sortDir}
                  onChange={e => changeReminderSortDir(e.target.value)}
                >
                  <option value="asc">昇順</option>
                  <option value="desc">降順</option>
                </select>
              </label>
            </div>
          </div>

          <div className="modal-section">
            <h3>タグで絞り込み</h3>
            <div className="modal-checkbox-grid">
              {Object.entries(reminderFilter.tags).map(([tagKey, enabled]) => (
                <label key={tagKey || 'untagged'}>
                  <input
                    type="checkbox"
                    checked={enabled !== false}
                    onChange={() => toggleReminderTag(tagKey)}
                  />
                  {tagKey ? tagKey : 'タグ未設定'}
                </label>
              ))}
            </div>
          </div>

          {reminderPresets.length > 0 && (
            <div className="modal-section">
              <h3>完了済みなどのキーワード</h3>
              <p className="modal-subtext">チェックを外したキーワードを含む予定は除外されます。</p>
              <div className="modal-checkbox-grid">
                {reminderPresets.map(preset => (
                  <label key={preset.key}>
                    <input
                      type="checkbox"
                      checked={reminderFilter.keywords?.[preset.key] !== false}
                      onChange={() => toggleReminderKeyword(preset.key)}
                    />
                    {preset.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="modal-section">
            <h3>プレビュー ({getReminderCandidates().length} 件)</h3>
            <div className="modal-preview">
              {getReminderCandidates().length === 0 ? (
                <p>条件に一致する予定がありません。</p>
              ) : (
                <ul>
                  {getReminderCandidates().map(ev => (
                    <li key={ev.id}>
                      <span className="preview-date">{ev.date} {ev.start}-{ev.end}</span>
                      <span className="preview-summary">{ev.summary}</span>
                      {ev.tag && <span className="preview-tag">[{ev.tag}]</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={() => setReminderModalOpen(false)}>キャンセル</button>
            <button
              className="primary"
              disabled={getReminderCandidates().length === 0}
              onClick={launchReminderShortcut}
            >
              リマインダーに送信
            </button>
          </div>
          <p className="modal-footnote">※ iPhone / iPad の Safari で開くとショートカットが起動します。</p>
        </div>
      </div>
    )}
    </>
  );
}
