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
      pageSize: 100,
      apiKey: process.env.NEWS_API_KEY
    }
  });

  return res.data.articles.map(a => a.title);
}

/* ===== AIスコア ===== */
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
以下のニュースから「市場を動かした原因」をスコア化せよ。

JSONで返答：
[{ "i":1, "score":0.9 }]

ニュース：
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

  try {
    const scores = JSON.parse(match[0]);
    return scores.map(s => ({
      title: titles[s.i - 1],
      score: s.score
    }));
  } catch {
    return titles.map(t => ({ title: t, score: 0 }));
  }
}

/* ===== 上位抽出 ===== */
function pickTop3(scored) {
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5) // ←少し多めに
    .map(x => x.title);
}

/* ===== 重複排除 ===== */
function removeDuplicateThemes(news) {
  const seen = new Set();

  return news.filter(t => {
    const low = t.toLowerCase();
    let key = "other";

    if (low.includes("iran") || low.includes("oil") || low.includes("energy")) key = "energy";
    else if (low.includes("inflation")) key = "inflation";
    else if (low.includes("rate") || low.includes("bank")) key = "rate";

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ===== 要約＆翻訳（完全版） ===== */
async function summarizeNews(news) {
  if (!process.env.GEMINI_API_KEY || news.length === 0) {
    return news.map(t => "■" + t);
  }

  const fixed = [];

  for (let item of news) {

    // ★最初から翻訳前提にする（ここが重要）
    const trans = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
以下の英文を日本語で「株価に影響した原因」として1行に要約せよ。

ルール：
・必ず日本語（英語禁止）
・短く1行
・先頭に■

${item}
`
            }]
          }]
        })
      }
    );

    const j = await trans.json();
    let txt = j?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // ★日本語が含まれているかチェック
    const hasJP = /[ぁ-んァ-ン一-龯]/.test(txt);

    if (!hasJP) {
      // 再翻訳（強制）
      const retry = await fetch(
        "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `
この英文を日本語だけで書き直せ：

${item}
`
              }]
            }]
          })
        }
      );

      const r = await retry.json();
      txt = r?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    const clean = txt.replace(/^■+/, "").trim();

    fixed.push(clean ? "■" + clean : "■" + item);
  }

  return fixed.slice(0, 3);
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

  const picked = pickTop3(scored);
  const unique = removeDuplicateThemes(picked);
  const summarized = await summarizeNews(unique);

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
