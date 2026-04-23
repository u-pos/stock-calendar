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
/* ===== 要約＆翻訳（完全安定版） ===== */
async function summarizeNews(news) {
  if (!process.env.GEMINI_API_KEY || news.length === 0) {
    return news.slice(0, 3).map(t => "■" + t);
  }

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
以下のニュースから「株価に影響した原因」を3つ選び、日本語で短く1行に要約せよ。

ルール：
・必ず日本語
・1行
・必ず3件
・JSON配列のみで返す（説明禁止）

例：
["■原油高でインフレ加速","■利上げ観測で株下落","■戦争リスクで市場不安"]

ニュース：
${news.map((n,i)=>`${i+1}. ${n}`).join("\n")}
`
            }]
          }]
        })
      }
    );

    const json = await res.json();

    console.log("FULL RESPONSE:", JSON.stringify(json, null, 2));

    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("AI raw:", text);

    const match = text.match(/\[.*\]/s);

    /* ===== フォーマット崩壊 ===== */
    if (!match) {
      console.log("AIフォーマット崩壊 → fallback");
      return news.slice(0, 3).map(t => "■" + t);
    }

    let arr;

    try {
      arr = JSON.parse(match[0]);
    } catch (e) {
      console.log("JSONパース失敗 → fallback");
      return news.slice(0, 3).map(t => "■" + t);
    }

    /* ===== 空配列対策 ===== */
    if (!Array.isArray(arr) || arr.length === 0) {
      console.log("AI空配列 → fallback");
      return news.slice(0, 3).map(t => "■" + t);
    }

    /* ===== 日本語チェック ===== */
    const hasJP = (s) => /[ぁ-んァ-ン一-龯]/.test(s);

    const cleaned = arr
      .map(s => s.trim())
      .filter(s => s.length > 0);

    /* 日本語じゃない場合 fallback */
    if (!cleaned.some(hasJP)) {
      console.log("日本語なし → fallback");
      return news.slice(0, 3).map(t => "■" + t);
    }

    return cleaned.slice(0, 3);

  } catch (e) {
    console.log("APIエラー → fallback", e);
    return news.slice(0, 3).map(t => "■" + t);
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
