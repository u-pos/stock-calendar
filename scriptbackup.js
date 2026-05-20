const grid = document.getElementById("grid");
const title = document.getElementById("title");

let current = new Date();

/* キャッシュ */
const cache = {};

/* JST */
function getJSTParts(date) {
  const jst = new Date(date.getTime() + 9*60*60*1000);
  return {
    y: jst.getFullYear(),
    m: jst.getMonth(),
    d: jst.getDate()
  };
}

function formatDate(y,m,d){
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

/* ★月単位で先読み（高速化） */
async function preloadMonth(y, m){
  const last = new Date(y, m+1, 0).getDate();
  const promises = [];

  for(let d=1; d<=last; d++){
    const dateStr = formatDate(y,m,d);

    if(cache[dateStr]) continue;

    promises.push(
      fetch(`./data/${dateStr}.json`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if(data) cache[dateStr] = data; })
        .catch(()=>{})
    );
  }

  await Promise.all(promises);
}

/* 描画 */
async function render() {
  grid.innerHTML = "";

  const {y, m} = getJSTParts(current);
  title.textContent = `${y}-${m+1}`;

  await preloadMonth(y, m);

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  days.forEach((d,i)=>{
    const div = document.createElement("div");
    div.className = "header " + (i==0?"sun":i==6?"sat":"week");
    div.textContent = d;
    grid.appendChild(div);
  });

  const first = new Date(y, m, 1).getDay();
  const last = new Date(y, m+1, 0).getDate();

  for(let i=0;i<first;i++){
    grid.appendChild(document.createElement("div"));
  }

  for(let d=1; d<=last; d++){

    const cell = document.createElement("div");
    cell.className = "cell";

    const dateStr = formatDate(y,m,d);
    const data = cache[dateStr];

    const dow = new Date(y,m,d).getDay();
    const isWeekend = (dow === 0 || dow === 6);

    cell.innerHTML = `<div class="date">${d}</div>`;

    if(data){

      /* ★日経（平日のみ） */
      if(data.nikkei && !isWeekend){
        const up = data.nikkei.change_pct >= 0;

        cell.innerHTML += `
          <div class="nikkei ${up ? "up":"down"}">
            ${data.nikkei.close}円(${up?"+":""}${data.nikkei.change_pct}%)
          </div>
        `;
      }

      /* ★ニュース（1行連結表示） */
      if(data.news && data.news.length){

        const text = data.news
          .map(n => n.title)
          .join("　"); // ←全角スペースで見やすく

        cell.innerHTML += `
          <div class="news" title="${text}">
            ${text}
          </div>
        `;
      }
    }

    grid.appendChild(cell);
  }
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
