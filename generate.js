import axios from "axios";
import fs from "fs";

/* JST日時取得 */
function getJSTNow() {

  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Tokyo"
    })
  );
}
/* YYYY-MM-DD */
function getDateString(date) {

  return date.toISOString().split("T")[0];
}

/* 平日判定 */
/* JST平日判定 */
function isWeekdayJST(date) {

  const day = date.getDay();

  return day >= 1 && day <= 5;
}

/* JST 15:40以降判定 */
function isAfter1540JST(date) {

  const hour = date.getHours();

  const min = date.getMinutes();

  return (
    hour > 15 ||
    (hour === 15 && min >= 40)
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

  /* 土日スキップ */
  if (!isWeekdayJST(now))

    console.log("土日はスキップ");

    return;
  }

  /* 15:40前ならスキップ */
  if (!isAfter1540JST(now))

    console.log("15:40前なのでスキップ");

    return;
  }

  const date = getDateString(now);

  const nikkei = await getNikkei();

  const data = {
    date,
    nikkei
  };

  fs.mkdirSync("./data", { recursive: true });

  fs.writeFileSync(
    `./data/${date}.json`,
    JSON.stringify(data, null, 2)
  );

  console.log("保存完了:", data);
}

main();
