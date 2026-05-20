const grid = document.getElementById("grid");
const title = document.getElementById("title");

let current = new Date();

/* JST */
function getJSTParts(date){
  const jst = new Date(date.getTime() + 9*60*60*1000);

  return {
    y:jst.getFullYear(),
    m:jst.getMonth(),
    d:jst.getDate()
  };
}

function formatDate(y,m,d){
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

/* localStorage */
function getMemo(dateStr){
  return localStorage.getItem("memo_" + dateStr) || "";
}

function saveMemo(dateStr, text){
  localStorage.setItem("memo_" + dateStr, text);
}

/* 描画 */
function render(){

  grid.innerHTML = "";

  const {y,m} = getJSTParts(current);

  title.textContent = `${y}年${m+1}月`;

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  days.forEach((d,i)=>{
    const div = document.createElement("div");

    div.className =
      "header " +
      (i===0 ? "sun" :
      i===6 ? "sat" :
      "week");

    div.textContent = d;

    grid.appendChild(div);
  });

  const first = new Date(y,m,1).getDay();
  const last = new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++){
    grid.appendChild(document.createElement("div"));
  }

  for(let d=1; d<=last; d++){

    const dateStr = formatDate(y,m,d);

    const cell = document.createElement("div");
    cell.className = "cell";

    const memo = getMemo(dateStr);

    cell.innerHTML = `
      <div class="date">${d}</div>

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

/* 編集 */
function editMemo(dateStr){

  const memoDiv = document.getElementById("memo-" + dateStr);

  const currentText =
    localStorage.getItem("memo_" + dateStr) || "";

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

/* 保存 */
function saveMemoAndRender(dateStr){

  const textarea =
    document.getElementById("textarea-" + dateStr);

  const text = textarea.value;

  saveMemo(dateStr, text);

  render();
}

/* 月移動 */
function prev(){
  current.setMonth(current.getMonth()-1);
  render();
}

function next(){
  current.setMonth(current.getMonth()+1);
  render();
}

render();

window.prev = prev;
window.next = next;
window.editMemo = editMemo;
window.saveMemoAndRender = saveMemoAndRender;
