const grid = document.getElementById("grid");
const title = document.getElementById("title");

let current = new Date();

/* キャッシュ */
const cache = {};

/* ローカルメモ */
const MEMO_KEY = "stock_calendar_memos";

/* JST */
function getJSTParts(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return {
    y: jst.getFullYear(),
    m: jst.getMonth(),
    d: jst.getDate()
  };
}

function formatDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* メモ取得 */
function getMemos() {
  try {
    return JSON.parse(localStorage.getItem(MEMO_KEY) || "{}");
  } catch {
    return {};
  }
}

/* メモ保存 */
function saveMemo(date, text) {
  const memos = getMemos();
  memos[date] = text;

  localStorage.setItem(MEMO_KEY, JSON.stringify(memos));
}

/* 月単位先読み */
async function preloadMonth(y, m) {

  const last = new Date(y, m + 1, 0).getDate();

  const promises = [];

  for (let d = 1; d <= last; d++) {

    const dateStr = formatDate(y, m, d);

    if (cache[dateStr]) continue;

    promises.push(
      fetch(`./data/${dateStr}.json`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) cache[dateStr] = data;
        })
        .catch(() => {})
    );
  }

  await Promise.all(promises);
}

/* 描画 */
async function render() {

  grid.innerHTML = "";

  const { y, m } = getJSTParts(current);

  title.textContent = `${y}-${m + 1}`;

  await preloadMonth(y, m);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  days.forEach((d, i) => {

    const div = document.createElement("div");

    div.className =
      "header " +
      (i == 0 ? "sun" : i == 6 ? "sat" : "week");

    div.textContent = d;

    grid.appendChild(div);
  });

  const first = new Date(y, m, 1).getDay();
  const last = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < first; i++) {
    grid.appendChild(document.createElement("div"));
  }

  const memos = getMemos();

  for (let d = 1; d <= last; d++) {

    const cell = document.createElement("div");

    cell.className = "cell";

    const dateStr = formatDate(y, m, d);

    const data = cache[dateStr];

    const dow = new Date(y, m, d).getDay();

    const isWeekend = (dow === 0 || dow === 6);

    const memoText = memos[dateStr] || "";

    cell.innerHTML = `
      <div class="date">${d}</div>
    `;

    /* 日経 */
    if (data && data.nikkei && !isWeekend) {

      const up = data.nikkei.change_pct >= 0;

      cell.innerHTML += `
        <div class="nikkei ${up ? "up" : "down"}">
          ${data.nikkei.close}円(${up ? "+" : ""}${data.nikkei.change_pct}%)
        </div>
      `;
    }

    /* メモUI */
    cell.innerHTML += `
      <div class="memo-wrap">

        <textarea
          class="memo-input"
          id="memo-${dateStr}"
          disabled
        >${memoText}</textarea>

        <div class="memo-buttons">
          <button onclick="editMemo('${dateStr}')">
            編集
          </button>

          <button onclick="saveMemoUI('${dateStr}')">
            保存
          </button>
        </div>

      </div>
    `;

    grid.appendChild(cell);
  }
}

/* 編集 */
function editMemo(date) {

  const el = document.getElementById(`memo-${date}`);

  el.disabled = false;

  el.focus();
}

/* 保存 */
function saveMemoUI(date) {

  const el = document.getElementById(`memo-${date}`);

  saveMemo(date, el.value);

  el.disabled = true;
}

/* 月移動 */
function prev() {

  current.setMonth(current.getMonth() - 1);

  render();
}

function next() {

  current.setMonth(current.getMonth() + 1);

  render();
}

window.prev = prev;
window.next = next;
window.editMemo = editMemo;
window.saveMemoUI = saveMemoUI;

render();
