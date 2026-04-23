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
/* ===== 要約＆翻訳（英語排除版） ===== */
async function summarizeNews(news) {
  if (!process.env.GEMINI_API_KEY || news.length === 0) {
    return fallbackJP(news);
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
以下のニュースから「株価に影響した原因」を3つ選び、日本語で1行に要約せよ。

ルール：
・必ず日本語
・必ず3件
・JSON配列のみ
・英語禁止

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
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const match = text.match(/\[.*\]/s);
    if (!match) return fallbackJP(news);

    let arr;
    try {
      arr = JSON.parse(match[0]);
    } catch {
      return fallbackJP(news);
    }

    // 日本語チェック
    const hasJP = s => /[ぁ-んァ-ン一-龯]/.test(s);

    const valid = arr.filter(s => hasJP(s));

    if (valid.length < 2) {
      return fallbackJP(news);
    }

    return valid.slice(0,3);

  } catch {
    return fallbackJP(news);
  }
}
/* ===== 重複除去＋不足補充（完全版） ===== */
function removeDuplicateThemes(news, original) {
  const seen = new Set();
  const result = [];

  for (let t of news) {
    let key = "other";

    if (t.includes("イラン") || t.includes("戦争")) key = "war";
    else if (t.includes("インフレ")) key = "inflation";
    else if (t.includes("利上げ") || t.includes("金利")) key = "rate";

    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }

  // ★不足分を元ニュースから補充
  let i = 0;
  while (result.length < 3 && i < original.length) {
    const fallback = simpleJP(original[i]) || null;

    if (fallback && !result.includes(fallback)) {
      result.push(fallback);
    }
    i++;
  }

  return result.slice(0, 3);
}
/* ===== fallback（日本語強制） ===== */
function fallbackJP(news) {
  return news
    .slice(0,5)
    .map(t => simpleJP(t))
    .filter(Boolean)
    .slice(0,3);
}

/* ===== 超簡易翻訳（最低限） ===== */
function simpleJP(text) {
  if (!text) return null;

  let t = text.toLowerCase();

  if (t.includes("oil") || t.includes("iran"))
    return "■中東情勢で原油価格変動";

  if (t.includes("inflation"))
    return "■インフレ動向が市場に影響";

  if (t.includes("rate") || t.includes("fed"))
    return "■金利政策への警戒";

  return null; // 不明は捨てる
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

  // ① ニュース取得
  const titles = await getNews();

  // ② AI要約
  const summarized = await summarizeNews(titles);

  // ③ 重複除去＋不足分補充（removeDuplicateThemesは別途定義済み前提）
  const final = removeDuplicateThemes(summarized, titles);

  // ④ ■を必ず付与（ここで統一）
  const cleaned = final.map(t => t.startsWith("■") ? t : "■" + t);

  // ⑤ 日経取得
  const nikkei = await getNikkei();

  // ⑥ JSON生成（★ここで cleaned を使う）
  const data = {
    date,
    nikkei,
    news: cleaned.map(t => ({ title: t }))
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));

  console.log("DONE:", data);
}

main();
