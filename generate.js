import axios from "axios";
import fs from "fs";

/* =========================
   JST日付
========================= */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/* =========================
   nikkei225jp取得
========================= */
async function getNews() {
  try {
    const res = await axios.get("https://nikkei225jp.com/news/");
    const html = res.data;

    const matches = [...html.matchAll(/<a href="\/news\/.*?">(.*?)<\/a>/g)];

    const titles = matches.map(m =>
      m[1].replace(/<[^>]+>/g, "").trim()
    );

    return titles.slice(0, 30);

  } catch (e) {
    console.log("取得失敗");
    return [];
  }
}

/* =========================
   重複削除
========================= */
function dedupe(news) {
  const seen = new Set();

  return news.filter(t => {
    const key = t.slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* =========================
   AIで3つ選ぶ
========================= */
async function pickTop3(news) {
  if (news.length === 0) return [];

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
以下のニュースから「日経平均に影響が大きいもの」を3つ選べ。

ルール:
- 金利・インフレ・日銀・戦争・原油・トランプ氏の発言・その他要人発言を優先
- 同じ内容は1つとしてカウントする

番号だけ答えろ（例: 1,3,5）

ニュース:
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
    if (!nums) return [];

    return nums.map(n => news[Number(n)-1]).slice(0,3);

  } catch {
    return [];
  }
}

/* =========================
   日経平均
========================= */
async function getNikkei() {
  const res = await axios.get("https://query1.finance.yahoo.com/v8/finance/chart/^N225");
  const meta = res.data.chart.result[0].meta;

  return {
    close: Math.round(meta.regularMarketPrice),
    change_pct: Number(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2))
  };
}

/* =========================
   メイン
========================= */
async function main() {
  const date = getDateJST();

  let news = await getNews();

  news = dedupe(news).slice(0, 15);

  const picked = await pickTop3(news);

  const nikkei = await getNikkei();

  const fallback = news.slice(0, 3);

  const finalNews = (picked.length > 0 ? picked : fallback).map(t => ({
    title: t,
    summary: ""
  }));

  const data = {
    date,
    nikkei,
    news: finalNews
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));
}

main();
