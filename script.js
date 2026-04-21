const grid = document.getElementById("grid");
const title = document.getElementById("title");

let current = new Date();
const cache = {}; // ★キャッシュ

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

async function loadData(dateStr){
  if(cache[dateStr]) return cache[dateStr];

  try {
    const res = await fetch(`./data/${dateStr}.json`);
    if(res.ok){
      const data = await res.json();
      cache[dateStr] = data; // ★保存
      return data;
    }
  } catch {}

  return null;
}

async function render() {
  grid.innerHTML = "";

  const {y, m} = getJSTParts(current);
  title.textContent = `${y}-${m+1}`;

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

    cell.innerHTML = `<div class="date">${d}</div>`;

    const data = await loadData(dateStr);

    if(data){
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

    grid.appendChild(cell);
  }
}

function prev(){ current.setMonth(current.getMonth()-1); render(); }
function next(){ current.setMonth(current.getMonth()+1); render(); }

render();
window.prev = prev;
window.next = next;
