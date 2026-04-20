import axios from "axios";
import fs from "fs";

/* ===== JST日付 ===== */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/* ===== ニュース取得（多めに取る） ===== */
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
  pageSize: 100,
  apiKey: process.env.NEWS_API_KEY
}
  });

  return res.data.articles.map(a => a.title);
}

/* ===== AIでスコア評価 ===== */
async function scoreNews(titles) {
  if (!process.env.GEMINI_API_KEY || titles.length === 0) {
    return titles.slice(0, 3).map(t => ({ title: t, score: 0.5 }));
  }

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
以下のニュースタイトルを評価してください。

目的：
「その日の株価に影響した原因」を特定する

評価基準：
・その日の市場を動かした可能性（0〜1）
・原因ニュースか（結果や解説は低評価）
・長期テーマや雑談は低評価

最優先：
・地政学（戦争・中東・原油）
・金利・インフレ・中央銀行
・為替・エネルギー

低評価：
・AIやテックの長期テーマ
・個別企業ニュース
・雑談・評論・社会ニュース

必ずJSONで返答：
[
 { "i":1, "score":0.9 },
 { "i":2, "score":0.1 }
]

ニュース一覧：
${titles.map((t,i)=>`${i+1}. ${t}`).join("\n")}
`
          }]
        }]
      })
    }
  );

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const match = text.match(/\[.*\]/s);
  if (!match) return titles.map(t => ({ title: t, score: 0 }));

  let scores;
  try {
    scores = JSON.parse(match[0]);
  } catch {
    return titles.map(t => ({ title: t, score: 0 }));
  }

  return scores.map(s => ({
    title: titles[s.i - 1],
    score: s.score
  }));
}

/* ===== 上位3件抽出 ===== */
function pickTop3(scored) {
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.title);
}
function removeDuplicateThemes(news) {
  const seen = new Set();

  return news.filter(t => {
    const low = t.toLowerCase();

    let key = "other";

    if (low.includes("iran") || low.includes("oil") || low.includes("energy")) {
      key = "energy-war";
    } else if (low.includes("inflation")) {
      key = "inflation";
    } else if (low.includes("interest") || low.includes("bank")) {
      key = "rate";
    }

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const scored = await scoreNews(titles);
  const selected = pickTop3(scored);

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
