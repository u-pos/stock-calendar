let current = new Date();
let cache = {};

function format(d) {
  return d.toISOString().split("T")[0];
}

async function loadMonth() {
  const grid = document.getElementById("grid");

  if (!grid) return;

  const y = current.getFullYear();
  const m = current.getMonth();

  document.getElementById("title").innerText = `${y}-${m + 1}`;

  const key = `${y}-${m}`;
  if (cache[key]) {
    grid.innerHTML = cache[key];
    return;
  }

  let html = "";

  // ▼曜日ヘッダー
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  days.forEach((d, i) => {
    let cls = "week";
    if (i === 0) cls = "sun";
    if (i === 6) cls = "sat";

    html += `<div class="cell header ${cls}">${d}</div>`;
  });

  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const last = new Date(y, m + 1, 0);

  // ▼空白
  for (let i = 0; i < startDay; i++) {
    html += `<div class="cell"></div>`;
  }

  for (let i = 1; i <= last.getDate(); i++) {
    const d = new Date(y, m, i);
    const dateStr = format(d);

    let data = null;

    try {
      const res = await fetch(`data/${dateStr}.json`);
      if (res.ok) data = await res.json();
    } catch {}

    if (data) {
      const pct = data.nikkei.change_pct;
      const cls = pct >= 0 ? "up" : "down";

      html += `
        <div class="cell">
          <div class="date">
            ${i}
            <span class="nikkei ${cls}">
              日経${data.nikkei.close}円(${pct}%)
            </span>
          </div>
          <ul>
            ${data.news.map(n =>
              `<li title="${n.summary}">${n.title}</li>`
            ).join("")}
          </ul>
        </div>
      `;
    } else {
      html += `<div class="cell"><div class="date">${i}</div></div>`;
    }
  }

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
