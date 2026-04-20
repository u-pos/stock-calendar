import axios from "axios";
import fs from "fs";
import xml2js from "xml2js";

function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, "0");
  const d = String(jst.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

async function getNewsRaw() {
  const res = await axios.get(
    "https://www.investing.com/rss/news_25.rss",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );

  const parser = new xml2js.Parser();
  const parsed = await parser.parseStringPromise(res.data);

  const items = parsed.rss.channel[0].item;

  return items.map(i => i.title[0]).slice(0, 10);
}

/* ★ここが重要：AI選別 */
async function pickImportant(newsTitles) {
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
以下のニュースから「株価に影響が大きいもの」を3つだけ選べ。

条件：
・マクロ（金利、CPI、戦争、要人発言など）を優先
・個別企業や雑ニュースは除外
・日本語に翻訳して出力

出力形式（JSONのみ）：
["ニュース1","ニュース2","ニュース3"]

ニュース一覧：
${newsTitles.join("\n")}
`
            }]
          }]
        })
      }
    );

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    const match = text.match(/\[.*\]/s);
    if (!match) return newsTitles.slice(0,3);

    return JSON.parse(match[0]);

  } catch {
    return newsTitles.slice(0,3);
  }
}

async function getNikkei() {
  const res = await axios.get(
    "https://query1.finance.yahoo.com/v8/finance/chart/^N225"
  );
  const meta = res.data.chart.result[0].meta;

  return {
    close: Math.round(meta.regularMarketPrice),
    change_pct: Number(
      ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2)
    )
  };
}

async function main() {
  const date = getDateJST();

  const raw = await getNewsRaw();
  const selected = await pickImportant(raw);
  const nikkei = await getNikkei();

  const news = selected.map(t => ({
    title: t
  }));

  const data = {
    date,
    nikkei,
    news
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));

  console.log("generated:", JSON.stringify(data, null, 2));
}

main();
