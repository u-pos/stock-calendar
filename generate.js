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

/* ===== AIで重要ニュース抽出（シンプル版） ===== */
async function pickImportantNews(titles) {
  if (!process.env.GEMINI_API_KEY || titles.length === 0) {
    return titles.slice(0, 3);
  }

const res = await fetch(
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
次のニュースの中から、株価に影響した重要なニュースを3つ選び、日本語でわかりやすく説明してください。


ニュース：
${titles.map((t,i)=>`${i+1}. ${t}`).join("\n")}
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

  let lines = text
    .split("\n")
    .map(t => t.replace(/^[-・\d. ]*/, "").trim())
    .filter(t => t);

  // fallback
  if (lines.length === 0) {
    console.log("AI失敗 → fallback");
    return titles.slice(0, 3);
  }

  return lines.slice(0, 3);
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

  console.log("GEMINI:", process.env.GEMINI_API_KEY ? "OK" : "NG");

  const titles = (await getNews()).slice(0, 15);

  console.log("ニュース件数:", titles.length);

  const selected = await pickImportantNews(titles);

  const nikkei = await getNikkei();

  const data = {
    date,
    nikkei,
    news: selected.map(t => ({ title: t }))
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));

  console.log("DONE:", data);
}

main();
