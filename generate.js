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
      q: "Fed OR inflation OR CPI OR interest rate OR oil OR Iran OR Middle East OR central bank OR recession OR tariff OR China",
      language: "en",
      sortBy: "relevancy",
      pageSize: 50,
      apiKey: process.env.NEWS_API_KEY
    }
  });

  return res.data.articles.map(a => a.title);
}

/* ===== AI要約（最重要） ===== */
async function summarizeNews(titles) {
  if (!process.env.GEMINI_API_KEY || titles.length === 0) {
    return [];
  }

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
以下のニュースから「株価に影響した原因」を3つ選び、
必ず日本語で1行に要約せよ。

【絶対ルール】
・JSON配列のみで返答
・解説禁止
・英語禁止
・必ず3件
・各要約は30文字以内
・重要度の高い順

【形式】
["■要約1","■要約2","■要約3"]

ニュース：
${titles.map((t,i)=>`${i+1}. ${t}`).join("\n")}
`
          }]
        }]
      })
    }
  );

  const json = await res.json();

  // デバッグ（残してOK）
  console.log("FULL RESPONSE:", JSON.stringify(json, null, 2));

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  console.log("AI raw:", text);

  // JSON部分だけ抜く
  const match = text.match(/\[.*\]/s);

  if (!match) {
    console.log("AIフォーマット崩壊");
    return [];
  }

  try {
    const arr = JSON.parse(match[0]);
    return arr.slice(0, 3);
  } catch (e) {
    console.log("JSONパース失敗");
    return [];
  }
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

  const titles = await getNews();
  console.log("ニュース件数:", titles.length);

  const summarized = await summarizeNews(titles);

  const nikkei = await getNikkei();

  const data = {
    date,
    nikkei,
    news: summarized.map(t => ({ title: t }))
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));

  console.log("DONE:", data);
}

main();
