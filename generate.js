import axios from "axios";
import fs from "fs";

/* =========================
   JST日付 & 15:30固定
========================= */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

function getToTimeISO() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  // 今日の15:30 JST
  jst.setHours(15, 30, 0, 0);

  return jst.toISOString();
}

/* =========================
   ニュース取得（Reuters日本語）
========================= */
async function getNews() {
  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "株 OR 金利 OR インフレ OR 日銀 OR FRB OR 原油 OR 戦争",
      language: "ja",
      sortBy: "publishedAt",
      pageSize: 50,
      apiKey: process.env.NEWS_API_KEY,
      domains: "jp.reuters.com",
      to: getToTimeISO()
    }
  });

  return res.data.articles.map(a => a.title);
}

/* =========================
   重要候補抽出（ルール）
========================= */
function filterImportant(news) {
  const keywords = [
    "日銀","FRB","金利","インフレ","CPI",
    "戦争","原油","市場","株","経済"
  ];

  return news.filter(n =>
    keywords.some(k => n.includes(k))
  );
}

/* =========================
   重複削除
========================= */
function dedupe(news) {
  const seen = new Set();
  const result = [];

  for (let t of news) {
    const key = t.slice(0, 25);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }

  return result;
}

/* =========================
   AIで3つ選ぶ（重要）
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
以下のニュースから「株価に最も影響が大きいもの」を3つ選べ。

ルール:
- 金利・インフレ・中央銀行・戦争を優先
- 同じ内容は1つにする
- 出力は番号だけ（例: 1,3,5）

ニュース:
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
    if (!nums) return [];

    return nums.map(n => news[Number(n)-1]).slice(0,3);

  } catch {
    return [];
  }
}

/* =========================
   日経平均
========================= */
async function getNikkei() {
  const res = await axios.get("https://query1.finance.yahoo.com/v8/finance/chart/^N225");
  const meta = res.data.chart.result[0].meta;

  return {
    close: Math.round(meta.regularMarketPrice),
    change_pct: Number(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2))
  };
}

/* =========================
   メイン
========================= */
async function main() {
  const date = getDateJST();

  let news = await getNews();
  news = filterImportant(news);
  news = dedupe(news).slice(0, 10);

  const picked = await pickTop3(news);

  const nikkei = await getNikkei();

  const fallback = news.slice(0,3);

  const finalNews = (picked.length > 0 ? picked : fallback).map(t => ({
    title: t,
    summary: ""
  }));

  const data = {
    date,
    nikkei,
    news: finalNews
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));
}

main();
