import axios from "axios";
import fs from "fs";
import xml2js from "xml2js";

/* =========================
   JST日付
========================= */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, "0");
  const d = String(jst.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

/* =========================
   Investing RSS
========================= */
async function getInvesting() {
  try {
    const res = await axios.get(
      "https://www.investing.com/rss/news_25.rss",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(res.data);

    return parsed.rss.channel[0].item.map(i => i.title[0]);

  } catch {
    return [];
  }
}

/* =========================
   NewsAPI
========================= */
async function getNewsAPI() {
  try {
    const res = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q: "economy OR inflation OR Fed OR war OR oil OR interest rate",
        language: "en",
        sortBy: "publishedAt",
        pageSize: 50,
        apiKey: process.env.NEWS_API_KEY
      }
    });

    return res.data.articles.map(a => a.title);

  } catch {
    return [];
  }
}

/* =========================
   フィルタ
========================= */
function filterNews(titles) {
  const include = [
    "fed","rate","inflation","cpi","jobs","war","oil","interest","economy"
  ];

  const exclude = [
    "insider","review","top 10","roundup","product","buy","sell"
  ];

  return titles.filter(t => {
    const low = t.toLowerCase();
    return include.some(k => low.includes(k)) &&
           !exclude.some(k => low.includes(k));
  });
}

/* =========================
   同一テーマ削除（重要）
========================= */
function removeSameTopic(news) {
  const themes = [];

  return news.filter(t => {
    const key =
      t.includes("Iran") ? "IRAN" :
      t.includes("oil") ? "OIL" :
      t.includes("Fed") ? "FED" :
      t.includes("inflation") ? "INF" :
      t.includes("war") ? "WAR" :
      t.slice(0,20);

    if (themes.includes(key)) return false;

    themes.push(key);
    return true;
  });
}

/* =========================
   AI選別
========================= */
async function pickTop3(news) {
  if (news.length === 0) return [];

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
以下のニュースから「市場の原因となる重要ニュース」を3つ選べ。

ルール：
・同じテーマは1つにまとめる
・株価上下だけの記事は禁止
・必ず原因を選ぶ

番号だけ答えろ（例: 1,3,5）

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
    if (!nums) return news.slice(0,3);

    return nums.map(n => news[Number(n)-1]).slice(0,3);

  } catch {
    return news.slice(0,3);
  }
}

/* =========================
   日経
========================= */
async function getNikkei() {
  const res = await axios.get(
    "https://query1.finance.yahoo.com/v8/finance/chart/^N225"
  );
  const meta = res.data.chart.result[0].meta;

  return {
    close: Math.round(meta.regularMarketPrice),
    change_pct: Number(
      ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2)
    )
  };
}

/* =========================
   メイン
========================= */
async function main() {
  const date = getDateJST();

  const a = await getInvesting();
  const b = await getNewsAPI();

  let merged = [...a, ...b];

  merged = filterNews(merged);
  merged = removeSameTopic(merged).slice(0, 30);

  const selected = await pickTop3(merged);
  const nikkei = await getNikkei();

  const news = selected.map(t => ({ title: t }));

  const data = {
    date,
    nikkei,
    news
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));

  console.log("generated:", data);
}

main();
