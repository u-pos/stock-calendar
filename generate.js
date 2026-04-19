import axios from "axios";
import fs from "fs";

function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

async function getNews() {
  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "economy OR inflation OR Fed OR war OR interest rate",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 30,
      apiKey: process.env.NEWS_API_KEY
    }
  });
  return res.data.articles.map(a => a.title);
}

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
以下のニュースから株に影響が大きいものを3つ選び、日本語で要約してください。

必ずJSONのみで出力してください（説明文は禁止）:
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

  // ▼ログ（重要）
  console.log("Gemini raw:", JSON.stringify(json));

  let text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("Gemini text empty");
    return [];
  }

  // ▼余計な装飾除去
  text = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  // ▼JSON配列だけ抽出
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1) {
    console.error("JSON not found:", text);
    return [];
  }

  const jsonStr = text.substring(start, end + 1);

  try {
    const parsed = JSON.parse(jsonStr);

    // ▼最大3件制限（AIが暴走した場合対策）
    return parsed.slice(0, 3);

  } catch (e) {
    console.error("JSON parse error:", jsonStr);
    return [];
  }
}

async function main() {
  const date = getDateJST();

  const news = await getNews();
  const nikkei = await getNikkei();
  const selected = await summarize(news);

  // ▼フェイルセーフ（AI失敗時）
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
