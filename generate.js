import axios from "axios";
import fs from "fs";

/* JST日付 */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/* 重複削除 */
function dedupeTitles(titles) {
  const seen = new Set();

  return titles.filter(t => {
    const key = t
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(" ")
      .slice(0, 8)
      .join(" ");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ニュース取得（超重要：質を強制） */
async function getNews() {
  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "(inflation OR Fed OR interest rate OR CPI OR recession OR central bank OR geopolitics OR oil OR war)",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 50,
      apiKey: process.env.NEWS_API_KEY,

      // ▼ここが最重要（質の担保）
      domains: "bloomberg.com,reuters.com,wsj.com,cnbc.com"
    }
  });

  const titles = res.data.articles.map(a => a.title);

  return dedupeTitles(titles);
}

/* 日経 */
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

/* Gemini */
async function summarize(newsTitles) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
以下のニュースから「株価に直接影響するマクロ要因のみ」を3つ選べ。

ルール:
- 金利・インフレ・中央銀行・戦争・エネルギーのみ対象
- エンタメ・レビュー・ランキングは禁止
- 同じ内容は1つに統合

JSONのみで出力:
[
 {"title":"","summary":"","importance":0.9}
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

  text = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1) return [];

  const jsonStr = text.substring(start, end + 1);

  try {
    return JSON.parse(jsonStr).slice(0, 3);
  } catch {
    return [];
  }
}

/* メイン */
async function main() {
  const date = getDateJST();

  const news = await getNews();
  const nikkei = await getNikkei();
  const selected = await summarize(news);

  const fallback = news.slice(0, 3).map(t => ({
    title: t,
    summary: "",
    importance: 0.5
  }));

  const data = {
    date,
    nikkei,
    news: selected.length > 0 ? selected : fallback
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));
}

main();
