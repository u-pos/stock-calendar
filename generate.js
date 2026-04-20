import axios from "axios";
import fs from "fs";
import xml2js from "xml2js";

/* =========================
   JST日付
========================= */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getFullYear()}-${String(jst.getMonth()+1).padStart(2,"0")}-${String(jst.getDate()).padStart(2,"0")}`;
}

/* =========================
   RSS取得
========================= */
async function getInvesting() {
  const res = await axios.get("https://www.investing.com/rss/news_25.rss", {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const parsed = await new xml2js.Parser().parseStringPromise(res.data);
  return parsed.rss.channel[0].item.map(i => i.title[0]);
}

/* =========================
   NewsAPI
========================= */
async function getNewsAPI() {
  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "economy OR Fed OR inflation OR war OR oil OR interest rate OR Trump",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 50,
      apiKey: process.env.NEWS_API_KEY
    }
  });
  return res.data.articles.map(a => a.title);
}

/* =========================
   フィルタ
========================= */
function filterNews(titles) {
  const include = ["fed","inflation","cpi","rate","war","oil","trump","central bank","economy"];
  const exclude = ["insider","review","top 10","product","buy","sell","earnings"];

  return titles.filter(t=>{
    const low = t.toLowerCase();
    return include.some(k=>low.includes(k)) && !exclude.some(k=>low.includes(k));
  });
}

/* =========================
   クラスタリング（超重要）
========================= */
function clusterNews(titles) {
  const groups = {};

  for (let t of titles) {
    const low = t.toLowerCase();

    let key = "other";

    if (low.includes("iran") || low.includes("middle east") || low.includes("war")) key = "war";
    else if (low.includes("oil") || low.includes("crude")) key = "oil";
    else if (low.includes("fed") || low.includes("interest") || low.includes("rate")) key = "rate";
    else if (low.includes("inflation") || low.includes("cpi")) key = "inflation";
    else if (low.includes("trump")) key = "trump";

    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  return Object.values(groups).map(g => g[0]); // 各グループ1件だけ
}

/* =========================
   原因文に変換（重要）
========================= */
async function convertToCause(news) {
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          contents:[{
            parts:[{
              text:`
以下のニュースを「市場の原因となる一文」に変換せよ。
日本語で出力。

${news.join("\n")}
`
            }]
          }]
        })
      }
    );

    const json = await res.json();

    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    // ★ここが重要（落ちないようにする）
    if (!text) {
      console.log("Gemini empty response");
      return news;
    }

    const lines = text.split("\n").filter(l=>l.trim());

    return lines.length ? lines : news;

  } catch (e) {
    console.log("Gemini error:", e);
    return news;
  }
}
/* =========================
   AI最終選別
========================= */
async function pickTop3(news) {
  if (news.length <=3) return news;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        contents:[{
          parts:[{
            text:`
以下から最も重要な3つを選べ。
番号のみ答えろ。

${news.map((n,i)=>`${i+1}. ${n}`).join("\n")}
`
          }]
        }]
      })
    }
  );

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const nums = text.match(/\d+/g);
  if (!nums) return news.slice(0,3);

  return nums.map(n=>news[Number(n)-1]);
}

/* =========================
   日経
========================= */
async function getNikkei() {
  const res = await axios.get("https://query1.finance.yahoo.com/v8/finance/chart/^N225");
  const m = res.data.chart.result[0].meta;

  return {
    close: Math.round(m.regularMarketPrice),
    change_pct: Number(((m.regularMarketPrice - m.previousClose)/m.previousClose*100).toFixed(2))
  };
}

/* =========================
   メイン
========================= */
async function main() {
  try {
    const date = getDateJST();

    console.log("STEP1: fetching news");

    const a = await getInvesting();
    const b = await getNewsAPI();

    console.log("STEP2: merging");

    let merged = [...a, ...b];

    console.log("STEP3: filtering");

    merged = filterNews(merged);

    console.log("STEP4: clustering");

    merged = clusterNews(merged);

    console.log("STEP5: convertToCause");

    let causes = await convertToCause(merged);

    console.log("STEP6: pickTop3");

    const selected = await pickTop3(causes);

    console.log("STEP7: nikkei");

    const nikkei = await getNikkei();

    const data = {
      date,
      nikkei,
      news: selected.map(t => ({ title: t }))
    };

    fs.mkdirSync("./data", { recursive: true });
    fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));

    console.log("SUCCESS", data);

  } catch (e) {
    console.log("🔥 ERROR LOCATION:", e);
    process.exit(1);
  }
}
main();
