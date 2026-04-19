import axios from "axios";
import fs from "fs";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

async function getNews() {
  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "economy OR inflation OR Fed OR war OR interest rate OR central bank",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 40,
      apiKey: process.env.NEWS_API_KEY
    }
  });
  return res.data.articles.map(a => a.title);
}

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

async function summarize(newsTitles) {
  const prompt = `
以下のニュースから株式市場に影響が大きいものを3つ選び、日本語で要約してください。

条件:
- マクロ経済、金融政策、戦争、資源優先
- 個別企業ニュースは禁止
- 各タイトル20文字以内
- 要約30文字以内
- 上げ要因か下げ要因を判定

JSONのみで出力:
[
 {"title":"","summary":"","importance":0.9,"bias":"bullish","tag":"金融政策"}
]
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt + newsTitles.join("\n") }]
  });

  return JSON.parse(res.choices[0].message.content);
}

async function main() {
  const date = getDateJST();

  const news = await getNews();
  const nikkei = await getNikkei();
  const selected = await summarize(news);

  const data = {
    date,
    nikkei,
    news: selected
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(`./data/${date}.json`, JSON.stringify(data, null, 2));
}

main();
