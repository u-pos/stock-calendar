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

async function getNews() {
  try {
    const res = await axios.get(
      "https://www.investing.com/rss/news_25.rss",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(res.data);

    const items = parsed.rss.channel[0].item;

    const titles = items.map(i => i.title[0]);

    // ゆるめフィルタ
    const keywords = [
      "fed","rate","inflation","cpi","jobs","war",
      "oil","economy","central bank","earnings"
    ];

    let filtered = titles.filter(t =>
      keywords.some(k => t.toLowerCase().includes(k))
    );

    // ★ここが重要
    if (filtered.length < 3) {
      filtered = titles;
    }

    // 重複除去
    const seen = new Set();
    const unique = filtered.filter(t => {
      const key = t.slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.slice(0, 3);

  } catch (e) {
    console.log("news error:", e.message);
    return [];
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

  const newsTitles = await getNews();
  const nikkei = await getNikkei();

  const news = newsTitles.map(t => ({
    title: t,
    summary: ""
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
