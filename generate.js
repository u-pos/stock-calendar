import axios from "axios";
import fs from "fs";

/* JST日付 */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, '0');
  const d = String(jst.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/* nikkei225jp取得（確実版） */
async function getNews() {
  try {
    const res = await axios.get("https://nikkei225jp.com/news/");
    const html = res.data;

    // シンプルに「news/」リンクを全部拾う
    const matches = [...html.matchAll(/href="(\/news\/[^"]+)"/g)];

    const urls = matches.map(m => m[1]);

    const titles = [];

    for (let url of urls.slice(0,10)) {
      try {
        const page = await axios.get("https://nikkei225jp.com" + url);
        const h1 = page.data.match(/<h1[^>]*>(.*?)<\/h1>/);

        if (h1) {
          const title = h1[1].replace(/<[^>]+>/g, "").trim();
          titles.push(title);
        }
      } catch {}
    }

    return titles;

  } catch (e) {
    console.log("取得失敗", e.message);
    return [];
  }
}

/* 重複削除 */
function dedupe(news) {
  const seen = new Set();
  return news.filter(t => {
    const key = t.slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* AI選択 */
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
以下から重要ニュースを3つ選べ。
番号だけ答えろ。

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

/* 日経 */
async function getNikkei() {
  const res = await axios.get("https://query1.finance.yahoo.com/v8/finance/chart/^N225");
  const meta = res.data.chart.result[0].meta;

  return {
    close: Math.round(meta.regularMarketPrice),
    change_pct: Number(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2))
  };
}

/* メイン */
async function main() {
  const date = getDateJST();

  let news = await getNews();
  news = dedupe(news);

  const picked = await pickTop3(news);
  const nikkei = await getNikkei();

  const finalNews = (picked.length > 0 ? picked : news.slice(0,3)).map(t => ({
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
