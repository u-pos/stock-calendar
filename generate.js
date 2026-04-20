import axios from "axios";
import fs from "fs";

/* ===== JST日付 ===== */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/* ===== ニュース取得 ===== */
async function getNews() {
  if (!process.env.NEWS_API_KEY) {
    console.log("NEWS_API_KEY missing");
    return [];
  }

  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "economy OR inflation OR Fed OR war OR oil OR Trump",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 80,
      apiKey: process.env.NEWS_API_KEY
    }
  });

  return res.data.articles.map(a => a.title);
}

/* ===== フィルタ ===== */
function filterNews(titles) {
  const include = [
    "fed","inflation","cpi","rate","war","oil","iran",
    "middle east","economy"
  ];

  const exclude = [
    "insider","review","top","product","buy","sell",
    "flight","ticket","deal","roundtrip","sale",
    "guide","hotel","travel"
  ];

 return titles.filter(t => {
  const low = t.toLowerCase();

  const ok = include.some(k => low.includes(k));
  const ng = exclude.some(k => low.includes(k));

  // ★ここ追加
  const isTrumpValid =
    low.includes("trump") &&
    (
      low.includes("war") ||
      low.includes("oil") ||
      low.includes("tariff") ||
      low.includes("china") ||
      low.includes("economy")
    );

  const isResult =
    /(stocks?|shares?|markets?|futures?|equities)/.test(low) &&
    /(fall|fell|slip|slipped|edge|decline|declined|drop|dropped|retreat|weaken|lower)/.test(low);

  return (ok || isTrumpValid) && !ng && !isResult;
});

/* ===== 重複統合 ===== */
function clusterNews(titles) {
  const groups = {};

  for (let t of titles) {
    const low = t.toLowerCase();
    let key = "other";

    if (low.includes("iran") || low.includes("middle east") || low.includes("war") || low.includes("oil")) {
      key = "war-oil";
    } else if (low.includes("fed") || low.includes("rate") || low.includes("interest")) {
      key = "rate";
    } else if (low.includes("inflation") || low.includes("cpi")) {
      key = "inflation";
    } else if (low.includes("trump")) {
      key = "trump";
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  return Object.values(groups).map(g => g[0]);
}

/* ===== AI選別 ===== */
async function pickTop3(news) {
  if (!process.env.GEMINI_API_KEY || news.length === 0) return news.slice(0, 3);

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
以下のニュースから「株価に影響した原因」を最大3つ選べ

ルール：
・同じテーマは1つ
・株価の結果ニュースは禁止
・原因のみ選べ

番号だけ答えろ（例: 1,3）

${news.map((n,i)=>`${i+1}. ${n}`).join("\n")}
`
          }]
        }]
      })
    }
  );

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const nums = text.match(/\d+/g);
  if (!nums) return news.slice(0, 3);

  return nums.map(n => news[n - 1]).filter(Boolean);
}

/* ===== 日経 ===== */
async function getNikkei() {
  const res = await axios.get("https://query1.finance.yahoo.com/v8/finance/chart/^N225");
  const meta = res.data.chart.result[0].meta;

  const close = meta.regularMarketPrice;
  const prev = meta.previousClose;
  const pct = ((close - prev) / prev) * 100;

  return {
    close: Math.round(close),
    change_pct: Number(pct.toFixed(2))
  };
}

/* ===== メイン ===== */
async function main() {
  const date = getDateJST();

  const rawNews = await getNews();
  const filtered = filterNews(rawNews);
  const clustered = clusterNews(filtered);
  const selected = await pickTop3(clustered);

  const nikkei = await getNikkei();

  const data = {
    date,
    nikkei,
    news: selected.map(t => ({ title: t }))
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));

  console.log("DONE:", data);
}

main();
