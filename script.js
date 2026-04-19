let current = new Date();

function format(d) {
  return d.toISOString().split("T")[0];
}

async function loadMonth() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const y = current.getFullYear();
  const m = current.getMonth();

  document.getElementById("title").innerText = `${y}-${m+1}`;

  const first = new Date(y, m, 1);
  const last = new Date(y, m+1, 0);

  for (let i = 1; i <= last.getDate(); i++) {
    const d = new Date(y, m, i);
    const dateStr = format(d);

    const cell = document.createElement("div");
    cell.className = "cell";

    try {
      const res = await fetch(`data/${dateStr}.json`);
      const data = await res.json();

      const cls = data.nikkei.change_pct >= 0 ? "up" : "down";

      cell.innerHTML = `
        <div class="date">${i}</div>
        <div class="${cls}">
          ${data.nikkei.close} (${data.nikkei.change_pct}%)
        </div>
        <ul>
          ${data.news.map(n =>
            `<li title="${n.summary}">${n.title}</li>`
          ).join("")}
        </ul>
      `;
    } catch {
      cell.innerHTML = `<div class="date">${i}</div>`;
    }

    grid.appendChild(cell);
  }
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
