const grid = document.getElementById("grid");
const title = document.getElementById("title");

let current = new Date();

/* JST日付取得 */
function getJSTDateString(date) {
  const jst = new Date(date.getTime() + 9*60*60*1000);
  const y = jst.getFullYear();
  const m = String(jst.getMonth()+1).padStart(2,"0");
  const d = String(jst.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

/* 月描画 */
async function render() {
  grid.innerHTML = "";

  const year = current.getFullYear();
  const month = current.getMonth();

  title.textContent = `${year}-${month+1}`;

  /* 曜日ヘッダー */
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  days.forEach((d,i)=>{
    const div = document.createElement("div");
    div.className = "header " + (i==0?"sun":i==6?"sat":"week");
    div.textContent = d;
    grid.appendChild(div);
  });

  const first = new Date(year, month, 1).getDay();
  const last = new Date(year, month+1, 0).getDate();

  /* 空白 */
  for(let i=0;i<first;i++){
    grid.appendChild(document.createElement("div"));
  }

  for(let d=1; d<=last; d++){

    const cell = document.createElement("div");
    cell.className = "cell";

    const dateObj = new Date(year, month, d);
    const dateStr = getJSTDateString(dateObj);

    cell.innerHTML = `<div class="date">${d}</div>`;

    try {
      const res = await fetch(`./data/${dateStr}.json`);
      if(res.ok){
        const data = await res.json();

        if(data.nikkei){
          const cls = data.nikkei.change_pct >=0 ? "up":"down";

          cell.innerHTML += `
            <div class="nikkei ${cls}">
              日経${data.nikkei.close}円(${data.nikkei.change_pct}%)
            </div>
          `;
        }

        if(data.news && data.news.length){
          cell.innerHTML += "<ul>";
          data.news.forEach(n=>{
            cell.innerHTML += `<li>${n.title}</li>`;
          });
          cell.innerHTML += "</ul>";
        }
      }
    } catch {}

    grid.appendChild(cell);
  }
}

/* 前後移動 */
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
