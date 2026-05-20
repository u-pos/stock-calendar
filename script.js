const grid = document.getElementById("grid");
const title = document.getElementById("title");

let current = new Date();

/* JST */
function getJSTParts(date){

  const jst =
    new Date(date.getTime() + 9*60*60*1000);

  return {
    y:jst.getFullYear(),
    m:jst.getMonth(),
    d:jst.getDate()
  };
}

function formatDate(y,m,d){
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

/* ===== 日経取得 ===== */
async function getNikkei(){

  try{

    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/^N225"
    );

    const json = await res.json();

    if(
      !json.chart ||
      !json.chart.result ||
      !json.chart.result[0]
    ){
      return null;
    }

    const meta =
      json.chart.result[0].meta;

    const close =
      Math.round(meta.regularMarketPrice);

    const prev =
      meta.previousClose;

    const pct =
      ((close - prev) / prev) * 100;

    return {
      close,
      pct:Number(pct.toFixed(2))
    };

  }catch(e){

    console.log("日経取得失敗", e);

    return null;
  }
}

/* ===== localStorage ===== */

function getMemo(dateStr){
  return localStorage.getItem("memo_" + dateStr) || "";
}

function saveMemo(dateStr,text){
  localStorage.setItem("memo_" + dateStr,text);
}

/* ===== 描画 ===== */

async function render(){

  grid.innerHTML = "";

  const now =
    getJSTParts(new Date());

  const currentParts =
    getJSTParts(current);

  const y = currentParts.y;
  const m = currentParts.m;

  title.textContent =
    `${y}年${m+1}月`;

  const nikkei =
    await getNikkei();

  const days =
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  /* 曜日 */
  days.forEach((d,i)=>{

    const div =
      document.createElement("div");

    div.className =
      "header " +
      (
        i===0 ? "sun" :
        i===6 ? "sat" :
        "week"
      );

    div.textContent = d;

    grid.appendChild(div);
  });

  /* 空白 */
  const first =
    new Date(y,m,1).getDay();

  const last =
    new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++){

    grid.appendChild(
      document.createElement("div")
    );
  }

  /* 日付 */
  for(let d=1; d<=last; d++){

    const dateStr =
      formatDate(y,m,d);

    const memo =
      getMemo(dateStr);

    const cell =
      document.createElement("div");

    cell.className = "cell";

    /* 今日だけ日経表示 */
    let nikkeiHTML = "";

    const isToday =
      (
        y === now.y &&
        m === now.m &&
        d === now.d
      );

    if(isToday && nikkei){

      const cls =
        nikkei.pct >= 0
        ? "up"
        : "down";

      nikkeiHTML = `
        <div class="nikkei ${cls}">
          日経 ${nikkei.close}円
          (${nikkei.pct >=0 ? "+" : ""}${nikkei.pct}%)
        </div>
      `;
    }

    cell.innerHTML = `
      <div class="date">${d}</div>

      ${nikkeiHTML}

      <div class="memo" id="memo-${dateStr}">
        ${memo.replace(/\n/g,"<br>")}
      </div>

      <div class="actions">
        <button onclick="editMemo('${dateStr}')">
          編集
        </button>
      </div>
    `;

    grid.appendChild(cell);
  }
}

/* ===== 編集 ===== */

function editMemo(dateStr){

  const memoDiv =
    document.getElementById("memo-" + dateStr);

  const currentText =
    getMemo(dateStr);

  memoDiv.innerHTML = `
    <textarea id="textarea-${dateStr}">${currentText}</textarea>

    <div class="actions" style="margin-top:4px;">

      <button onclick="saveMemoAndRender('${dateStr}')">
        保存
      </button>

      <button onclick="render()">
        キャンセル
      </button>

    </div>
  `;
}

/* ===== 保存 ===== */

function saveMemoAndRender(dateStr){

  const textarea =
    document.getElementById(
      "textarea-" + dateStr
    );

  saveMemo(
    dateStr,
    textarea.value
  );

  render();
}

/* ===== 月移動 ===== */

function prev(){

  current.setMonth(
    current.getMonth()-1
  );

  render();
}

function next(){

  current.setMonth(
    current.getMonth()+1
  );

  render();
}

/* 初回描画 */
render();

/* グローバル化 */
window.prev = prev;
window.next = next;
window.editMemo = editMemo;
window.saveMemoAndRender =
  saveMemoAndRender;
