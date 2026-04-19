import axios from "axios";
import fs from "fs";

/* =========================
   日付（JST）
========================= */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/* =========================
   ニュース取得
========================= */
async function getNews() {
  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "(inflation OR CPI OR Fed OR interest rate OR central bank OR war OR semiconductor OR Trump OR Powell)",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 50,
      apiKey: process.env.NEWS_API_KEY,
      domains: "bloomberg.com,reuters.com,wsj.com,cnbc.com"
    }
  });

  return res.data.articles.map(a => a.title);
}

/* =========================
   重要イベント抽出（ここが核心）
========================= */
function extractImportant(news) {
  const keywords = [
    "cpi",
    "inflation",
    "fed",
    "interest rate",
    "central bank",
    "powell",
    "trump",
    "war",
    "geopolitics",
    "oil",
    "semiconductor",
    "earnings",
    "nvidia",
    "tsmc"
  ];

  const filtered = news.filter(n =>
    keywords.some(k => n.toLowerCase().includes(k))
  );

  // ▼重複っぽいもの削除
  const unique = [];
  const seen = new Set();

  for (let t of filtered) {
    const key = t.toLowerCase().slice(0, 40);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }

  return unique.slice(0, 5); // AIに渡す最大数
}

/* =========================
   日経平均
========================= */
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

/* =========================
   Gemini要約（選定はしない）
========================= */
async function summarize(newsTitles) {
  if (newsTitles.length === 0) return [];

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
以下のニュースを「株価に影響するイベント」として日本語で簡潔にまとめてください。

・1つのニュースにつき1〜2行
・そのままメモとして使える文章にする
・JSON形式で出力

[
 {"title":"","summary":""}
]

ニュース:
${newsTitles.join("\n")}
`
            }]
          }]
        })
      }
    );

    const json = await res.json();

    let text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) return [];

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    if (start === -1 || end === -1) return [];

    return JSON.parse(text.substring(start, end + 1)).slice(0, 3);

  } catch {
    return [];
  }
}

/* =========================
   メイン
========================= */
async function main() {
  const date = getDateJST();

  const rawNews = await getNews();
  const important = extractImportant(rawNews);
  const nikkei = await getNikkei();
  const summarized = await summarize(important);

  const fallback = important.slice(0, 3).map(t => ({
    title: t,
    summary: "（要約なし）"
  }));

  const data = {
    date,
    nikkei,
    news: summarized.length > 0 ? summarized : fallback
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));
}

main();
