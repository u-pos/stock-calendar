let current = new Date();
let cache = {};

function format(d) {
  return d.toISOString().split("T")[0];
}

function getMonthKey(y, m) {
  return `${y}-${m}`;
}

async function loadMonth() {
  const grid = document.getElementById("grid");

  const y = current.getFullYear();
  const m = current.getMonth();
  const key = getMonthKey(y, m);

  document.getElementById("title").innerText = `${y}-${m + 1}`;

  // ▼キャッシュがあれば再描画しない
  if (cache[key]) {
    grid.innerHTML = cache[key];
    return;
  }

  // ▼ローディング表示
  grid.innerHTML = "<div>Loading...</div>";

  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);

  let html = "";

  for (let i = 1; i <= last.getDate(); i++) {
    const d = new Date(y, m, i);
    const dateStr = format(d);

    try {
      const res = await fetch(`data/${dateStr}.json`);
      const data = await res.json();

      const cls = data.nikkei.change_pct >= 0 ? "up" : "down";

      html += `
        <div class="cell">
          <div class="date">${i}</div>
          <div class="${cls}">
            ${data.nikkei.close} (${data.nikkei.change_pct}%)
          </div>
          <ul>
            ${data.news.map(n =>
              `<li title="${n.summary}">${n.title}</li>`
            ).join("")}
          </ul>
        </div>
      `;
    } catch {
      html += `<div class="cell"><div class="date">${i}</div></div>`;
    }
  }

  // ▼キャッシュ保存
  cache[key] = html;

  grid.innerHTML = html;
}

function prev() {
  current.setMonth(current.getMonth() - 1);
  loadMonth();
}

function next() {
  current.setMonth(current.getMonth() + 1);
  loadMonth();
}

loadMonth();
