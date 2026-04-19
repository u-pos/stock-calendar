import axios from "axios";
import fs from "fs";

/* 日付 */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/* ニュース取得 */
async function getNews() {
  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "(inflation OR CPI OR Fed OR interest rate OR central bank OR war OR semiconductor OR Trump OR Powell)",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 50,
      apiKey: process.env.NEWS_API_KEY,
      domains: "bloomberg.com,reuters.com,wsj.com,cnbc.com"
    }
  });

  return res.data.articles.map(a => a.title);
}

/* 重要ニュース抽出 */
function extractImportant(news) {
  const keywords = [
    "inflation","cpi","fed","interest rate",
    "central bank","powell","trump",
    "war","oil","geopolitics",
    "semiconductor","earnings"
  ];

  return news
    .filter(n => keywords.some(k => n.toLowerCase().includes(k)))
    .slice(0, 5);
}

/* 日経 */
async function getNikkei() {
  const res = await axios.get("https://query1.finance.yahoo.com/v8/finance/chart/^N225");
  const meta = res.data.chart.result[0].meta;

  return {
    close: Math.round(meta.regularMarketPrice),
    change_pct: Number(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2))
  };
}

/* AI処理（翻訳＋要約） */
async function summarize(newsTitles) {
  if (newsTitles.length === 0) return [];

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
以下の英語ニュースを日本語に翻訳し、
「株価に影響するイベント」として簡潔にまとめてください。

条件:
- 1件につき1〜2行
- 因果関係（なぜ株に影響するか）を含める
- そのままメモとして使える文章にする

JSON形式:
[
 {"title":"","summary":""}
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
    let text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) return [];

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    if (start === -1 || end === -1) return [];

    return JSON.parse(text.substring(start, end + 1)).slice(0, 3);

  } catch {
    return [];
  }
}

/* メイン */
async function main() {
  const date = getDateJST();

  const rawNews = await getNews();
  const important = extractImportant(rawNews);
  const nikkei = await getNikkei();
  const summarized = await summarize(important);

  const fallback = important.slice(0, 3).map(t => ({
    title: t,
    summary: "（要約なし）"
  }));

  const data = {
    date,
    nikkei,
    news: summarized.length > 0 ? summarized : fallback
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));
}

main();
