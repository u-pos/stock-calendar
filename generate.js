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
   タイトル重複削除
========================= */
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

/* =========================
   ニュース取得
========================= */
async function getNews() {
  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "(economy OR inflation OR Fed OR interest rate OR recession OR CPI OR central bank OR geopolitics)",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 40,
      apiKey: process.env.NEWS_API_KEY,
      sources: "bloomberg,reuters,the-wall-street-journal"
    }
  });

  const titles = res.data.articles.map(a => a.title);

  return dedupeTitles(titles);
}

  const titles = res.data.articles.map(a => a.title);

  return dedupeTitles(titles);
}

/* =========================
   日経平均取得
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
   Gemini要約（安定版）
========================= */
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
以下のニュースから「株価に影響するマクロ要因のみ」を選べ。

重要:
- 金融政策、インフレ、戦争、金利のみ対象
- 個別株・ランキング・特集記事は禁止
- 同じ内容は統合

必ずJSONのみで出力:
[
 {"title":"","summary":"","importance":0.9}
]

ニュース:
${newsTitles.join("\n")}
`
`
          }]
        }]
      })
    }
  );

  const json = await res.json();

  console.log("Gemini raw:", JSON.stringify(json));

  let text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("Gemini text empty");
    return [];
  }

  // ▼装飾除去
  text = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  // ▼JSON部分抽出
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1) {
    console.error("JSON not found:", text);
    return [];
  }

  const jsonStr = text.substring(start, end + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    return parsed.slice(0, 3);
  } catch (e) {
    console.error("JSON parse error:", jsonStr);
    return [];
  }
}

/* =========================
   メイン処理
========================= */
async function main() {
  const date = getDateJST();

  const news = await getNews();
  const nikkei = await getNikkei();
  const selected = await summarize(news);

  // ▼AI失敗時フォールバック
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
