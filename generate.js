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

    return titles.slice(0, 3);

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
