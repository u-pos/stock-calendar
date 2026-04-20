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
   RSS取得（最大100件）
========================= */
async function getNewsRaw() {
  const res = await axios.get(
    "https://www.investing.com/rss/news_25.rss",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );

  const parser = new xml2js.Parser();
  const parsed = await parser.parseStringPromise(res.data);

  const items = parsed.rss.channel[0].item;

  return items.map(i => i.title[0]).slice(0, 100);
}

/* =========================
   フィルタ（重要）
========================= */
function filterNews(titles) {
  const include = [
    "fed","rate","inflation","cpi","jobs","unemployment",
    "central bank","war","conflict","oil","crude",
    "interest","economy","recession"
  ];

  const exclude = [
    "insider","review","tested","top 10","roundup",
    "earnings call","product","launch","buy","sell"
  ];

  return titles.filter(t => {
    const low = t.toLowerCase();

    const ok = include.some(k => low.includes(k));
    const ng = exclude.some(k => low.includes(k));

    return ok && !ng;
  });
}

/* =========================
   重複削除
========================= */
function dedupe(news) {
  const seen = new Set();

  return news.filter(t => {
    const key = t.slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* =========================
   AI選別（番号のみ）
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
以下のニュースから「市場全体に影響が大きいもの」を3つ選べ。

最優先：
・金利 / CPI / 雇用
・戦争 / 地政学
・中央銀行発言

除外：
・個別企業ニュース
・株価上昇/下落だけの記事

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
   日経平均
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

  let raw = await getNewsRaw();
  let filtered = filterNews(raw);
  let unique = dedupe(filtered).slice(0, 30);

  const selected = await pickTop3(unique);
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
