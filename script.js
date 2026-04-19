let current = new Date();
let cache = {};

function format(d) {
  return d.toISOString().split("T")[0];
}

async function loadMonth() {
  const grid = document.getElementById("grid");

  if (!grid) {
    console.error("grid not found");
    return;
  }

  const y = current.getFullYear();
  const m = current.getMonth();

  document.getElementById("title").innerText = `${y}-${m + 1}`;

  const key = `${y}-${m}`;
  if (cache[key]) {
    grid.innerHTML = cache[key];
    return;
  }

  let html = "";

  // 曜日
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  days.forEach(d => {
    html += `<div class="cell header">${d}</div>`;
  });

  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const last = new Date(y, m + 1, 0);

  // 空白
  for (let i = 0; i < startDay; i++) {
    html += `<div class="cell"></div>`;
  }

  for (let i = 1; i <= last.getDate(); i++) {
    const d = new Date(y, m, i);
    const dateStr = format(d);

    let data = null;

    try {
      const res = await fetch(`data/${dateStr}.json`);
      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      console.log("fetch error:", dateStr);
    }

    if (data) {
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
