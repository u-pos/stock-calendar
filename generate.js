import axios from "axios";
import fs from "fs";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

async function getNews() {
  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "economy OR inflation OR Fed OR war OR interest rate OR central bank",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 40,
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

必ずJSON配列で返す:
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

  // ▼ここ重要（まずログ）
  console.log("Gemini response:", JSON.stringify(json));

  // ▼安全に取り出す
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("Geminiレスポンス異常");
    return [];
  }

  // JSON抽出
  const match = text.match(/\[.*\]/s);

  if (!match) {
    console.error("JSON抽出失敗:", text);
    return [];
  }

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error("JSONパース失敗:", match[0]);
    return [];
  }
}
async function main() {
  const date = getDateJST();

  const news = await getNews();
  const nikkei = await getNikkei();
  const selected = await summarize(news);

  const data = {
    date,
    nikkei,
    news: selected
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));
}

main();
