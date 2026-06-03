import axios from "axios";
import fs from "fs";

/* JST現在時刻 */
function getJSTNow() {

  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Tokyo"
    })
  );
}

/* YYYY-MM-DD */
function formatDate(date) {

  return date.toISOString().split("T")[0];
}

/* 平日判定 */
function isWeekday(date) {

  const day = date.getDay();

  return day >= 1 && day <= 5;
}

/* 15:30以降 */
function isAfter1530(date) {

  const hour = date.getHours();
  const min = date.getMinutes();

  return (
    hour > 15 ||
    (hour === 15 && min >= 30)
  );
}

/* 日経取得 */
async function getNikkei() {

  const res = await axios.get(
    "https://query1.finance.yahoo.com/v8/finance/chart/^N225"
  );

  const meta = res.data.chart.result[0].meta;

  const close = meta.regularMarketPrice;

  const prev = meta.previousClose;

  const pct = ((close - prev) / prev) * 100;

  return {
    close: Math.round(close),
    change_pct: Number(pct.toFixed(2))
  };
}

/* メイン */
async function main() {

  const now = getJSTNow();
　console.log("JST:", now.toString());
  /* 土日スキップ */
  if (!isWeekday(now)) {

    console.log("土日はスキップ");

    return;
  }

  /* 15:30前ならスキップ */
  if (!isAfter1530(now)) {
  
    console.log("15:30前なのでスキップ");
    console.log("現在時刻:", now.toString());
  
    return;
  }


  console.log("15:30以降なので取得開始");

  const date = formatDate(now);

  const nikkei = await getNikkei();

  console.log("取得結果:", nikkei);

  const data = {
    date,
    nikkei
  };

  fs.mkdirSync("./data", {
    recursive: true
  });

  fs.writeFileSync(
    `./data/${date}.json`,
    JSON.stringify(data, null, 2)
  );

  console.log("保存完了:", data);
}

main().catch(err => {

  console.error(err);

  process.exit(1);
});
