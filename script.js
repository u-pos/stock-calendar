











































3.動作確認方法ですが、このページであってる？Workflow実行はどこ？

リポジトリにworkflowはありますが、/.github/workflows/はないですね。

これであってる？

この画面で合ってる？そしてこれで成功してるかわかる？

多分エラーになってます

結果はこうなってました。

GeminiのウェブサイトでAPIキーを取得しようとするとこんな画面になるんだけどどうしたらいい？

無事API取得して、OPENAIのAPIKEYを削除してGeminiのAPIキーを新たに登録しましたが、テストを実行したらこのような画面になりました。

UPDATEでテストしたらまたエラー出てる。
カレンダーの描写については一気に枠を読み込むようになりましたが、上部に曜日を固定してほしいです（現在は常にどの月も左上に1日が来てる）。

ちょっと違うエラーが出るようになりました

結果が成功になりました！これで次に進んでいいですか？


データが本当に生成されているか確認

１も２も大丈夫でした。3でなぜかカレンダーの枠すらも表示されなくなっていました。

Consoleタブにはこのような表示になっていました。

indexの中に<div id="grid" class="grid"></div>という表記はありました。

UPDATE実行したらエラー出ました

本日15時半に自動的に取得しにいってカレンダーに記載するはずが何もできていませんでした。日経平均の数字ですら取得していないし、私が渡したニュースサイトのニュースも一切取得できていません。しかもなぜか4月21日に日経平均だけ書いてあります。原因を特定して修正してください。(添付画像は本日のカレンダー画面）

ACTION UPDATE実行したらこんなエラー出てる

エラー出てるけど

エラーがでてるわ

error出てるね

再度実行したけど、errorがめっちゃ長いから1ページに収まらない。最後らへんのエラーメッセージだけみせるわね


エラーの行は減ったけどまだエラー出てる。最後らへんだけのスクショだけど送ります

エラー出てる

今のコードこんな感じだけど、構文とかは間違ってない？エラーでてるけど。
import axios from "axios";
import fs from "fs";

/* ===== JST日付 ===== */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/* ===== ニュース取得 ===== */
async function getNews() {
  if (!process.env.NEWS_API_KEY) {
    console.log("NEWS_API_KEY missing");
    return [];
  }

  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "economy OR inflation OR Fed OR war OR oil OR Trump",
      language: "en",
      sortBy: "publishedAt",
      pageSize: 80,
      apiKey: process.env.NEWS_API_KEY
    }
  });

  return res.data.articles.map(a => a.title);
}

/* ===== フィルタ ===== */
function filterNews(titles) {
  const include = [
    "fed","inflation","cpi","rate","war","oil","iran",
    "middle east","economy"
  ];

  const exclude = [
    "insider","review","top","product","buy","sell",
    "flight","ticket","deal","roundtrip","sale",
    "guide","hotel","travel"
  ];

 return titles.filter(t => {
  const low = t.toLowerCase();

  const ok = include.some(k => low.includes(k));
  const ng = exclude.some(k => low.includes(k));

  // ★ここ追加
  const isTrumpValid =
    low.includes("trump") &&
    (
      low.includes("war") ||
      low.includes("oil") ||
      low.includes("tariff") ||
      low.includes("china") ||
      low.includes("economy")
    );

  const isResult =
    /(stocks?|shares?|markets?|futures?|equities)/.test(low) &&
    /(fall|fell|slip|slipped|edge|decline|declined|drop|dropped|retreat|weaken|lower)/.test(low);

  return (ok || isTrumpValid) && !ng && !isResult;
});

/* ===== 重複統合 ===== */
function clusterNews(titles) {
  const groups = {};

  for (let t of titles) {
    const low = t.toLowerCase();
    let key = "other";

    if (low.includes("iran") || low.includes("middle east") || low.includes("war") || low.includes("oil")) {
      key = "war-oil";
    } else if (low.includes("fed") || low.includes("rate") || low.includes("interest")) {
      key = "rate";
    } else if (low.includes("inflation") || low.includes("cpi")) {
      key = "inflation";
    } else if (low.includes("trump")) {
      key = "trump";
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  return Object.values(groups).map(g => g[0]);
}

/* ===== AI選別 ===== */
async function pickTop3(news) {
  if (!process.env.GEMINI_API_KEY || news.length === 0) return news.slice(0, 3);

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 
以下のニュースから「株価に影響した原因」を最大3つ選べ

ルール：
・同じテーマは1つ
・株価の結果ニュースは禁止
・原因のみ選べ

番号だけ答えろ（例: 1,3）

${news.map((n,i)=>${i+1}. ${n}).join("\n")}

          }]
        }]
      })
    }
  );

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const nums = text.match(/\d+/g);
  if (!nums) return news.slice(0, 3);

  return nums.map(n => news[n - 1]).filter(Boolean);
}

/* ===== 日経 ===== */
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

/* ===== メイン ===== */
async function main() {
  const date = getDateJST();

  const rawNews = await getNews();
  const filtered = filterNews(rawNews);
  const clustered = clusterNews(filtered);
  const selected = await pickTop3(clustered);

  const nikkei = await getNikkei();

  const data = {
    date,
    nikkei,
    news: selected.map(t => ({ title: t }))
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(./data/${date}.json, JSON.stringify(data, null, 2));

  console.log("DONE:", data);
}

main();


generate.js
JavaScript
あかん、結果はこんな感じや。

{
  "date": "2026-04-21",
  "nikkei": {
    "close": 58825,
    "change_pct": 0.6
  },
  "news": [
    {
      "title": "■Inflation rose in March to the highest rate in 2 years as the Iran war lifted energy prices"
    },
    {
      "title": "■Bank of England boss tells BBC he won't rush interest rate rises"
    }
  ]
}

ちなみに今のコードはこうなってる


貼り付けられたテキスト（1 点）.txt
ドキュメント
何のエラーか分かる？構文エラーがないかチェックしてみて。


👉 GitHub Actionsログを開いて→これどこをみればいいの？スクショ送ります


JSON パース失敗ってなってたわ

ちょっとJSONの結果が変わったわ。これみて

これが今回の結果です

15にしてもいっしょですね

こんな結果が返ってきました

たしかにこの辺が原因っぽいけど、今回latestでもあかんかったみたい。この正しい名前ってどこで調べれるんだろ？

また間違ってるっぽいけど、ちゃんとそのリンクがあってるのか調べてきた？


貼り付けられたテキスト（1 点）.txt
ドキュメント
URL打ち込んだらこの結果が出てきたわ

これはかなり成功に近いのでは！？ちなみにこれって毎日15時半に自動で更新されるようになってるの？
あとスクショ見てもらったら分かると思うけど、カレンダーのレイアウトが変です。曜日の行の縦幅は最小限にして、日付の縦幅も均等にしてください。あとすでに読み込んだものはメモリーして、読み込むたびに出力(描写）しないようにしてください。


ニュース件数: 50
FULL RESPONSE: {
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "[\"■イラン戦争で原油高騰しインフレ加速\",\"■米国の終戦計画で原油下落し株価急騰\",\"■イランが米主要企業への攻撃を脅迫\"]"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 1054,
    "candidatesTokenCount": 45,
    "totalTokenCount": 4070,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 1054
      }
    ],
    "thoughtsTokenCount": 2971
  },
  "modelVersion": "gemini-2.5-flash",
  "responseId": "I0Hnae6OBrPc_uMPodaCkQI"
}
AI raw: ["■イラン戦争で原油高騰しインフレ加速","■米国の終戦計画で原油下落し株価急騰","■イランが米主要企業への攻撃を脅迫"]
DONE: {
  date: '2026-04-21',
  nikkei: { close: 59349, change_pct: 0.89 },
  news: [
    { title: '■イラン戦争で原油高騰しインフレ加速' },
    { title: '■米国の終戦計画で原油下落し株価急騰' },
    { title: '■イランが米主要企業への攻撃を脅迫' }
  ]
}

カレンダーでF5押すたびに1マスずつ1から描写してるのをやめてほしい。すでに読み込んだデータはキャッシュとかに保存できないの？ちなみに土日は日経は不要だけどニュースも欲しい。また、日経の終値と%の表示は少しだけ大きくして、例えば58995円(+0.56%)みたいに＋の時は緑に表示、－の時は赤で表示してほしい。もしこれでうまくいけば、次はマウスホバーで全文表示したい。ちなみに↓の部分同じこと書いてるだけだけど意味あるの？(うまく動いてる？）

AI raw: ["■米国が戦争終結計画を発表","■イラン戦争で原油高騰しインフレ","■イランが米国企業や施設を攻撃"]
DONE: {
  date: '2026-04-21',
  nikkei: { close: 59349, change_pct: 0.89 },
  news: [
    { title: '■米国が戦争終結計画を発表' },
    { title: '■イラン戦争で原油高騰しインフレ' },
    { title: '■イランが米国企業や施設を攻撃' }
  ]
}

有れ？カレンダーで文章が途中で消えるようになった。前はそんなことなかったのに。

なんか水曜日だけニュース出てない。ちなみに今日は主導でUPDATE↓

import axios from "axios";
import fs from "fs";

/* ===== JST日付 ===== */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/* ===== ニュース取得 ===== */
async function getNews() {
  if (!process.env.NEWS_API_KEY) {
    console.log("NEWS_API_KEY missing");
    return [];
  }

  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "Fed OR inflation OR CPI OR interest rate OR oil OR Iran OR Middle East OR central bank OR recession OR tariff OR China",
      language: "en",
      sortBy: "relevancy",
      pageSize: 50,
      apiKey: process.env.NEWS_API_KEY
    }
  });

  return res.data.articles.map(a => a.title);
}

/* ===== AI要約（最重要） ===== */
/* ===== 要約＆翻訳（完全安定版） ===== */
/* ===== 要約＆翻訳（英語排除版） ===== */
async function summarizeNews(news) {
  if (!process.env.GEMINI_API_KEY || news.length === 0) {
    return fallbackJP(news);
  }

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 
以下のニュースから「株価に影響した原因」を3つ選び、日本語で1行に要約せよ。

ルール：
・必ず日本語
・必ず3件
・JSON配列のみ
・英語禁止

例：
["■原油高でインフレ加速","■利上げ観測で株下落","■戦争リスクで市場不安"]

ニュース：
${news.map((n,i)=>${i+1}. ${n}).join("\n")}

            }]
          }]
        })
      }
    );

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const match = text.match(/\[.*\]/s);
    if (!match) return fallbackJP(news);

    let arr;
    try {
      arr = JSON.parse(match[0]);
    } catch {
      return fallbackJP(news);
    }

    // 日本語チェック
    const hasJP = s => /[ぁ-んァ-ン一-龯]/.test(s);

    const valid = arr.filter(s => hasJP(s));

    if (valid.length < 2) {
      return fallbackJP(news);
    }

    return valid.slice(0,3);

  } catch {
    return fallbackJP(news);
  }
}

/* ===== fallback（日本語強制） ===== */
function fallbackJP(news) {
  return news
    .slice(0,5)
    .map(t => simpleJP(t))
    .filter(Boolean)
    .slice(0,3);
}

/* ===== 超簡易翻訳（最低限） ===== */
function simpleJP(text) {
  if (!text) return null;

  let t = text.toLowerCase();

  if (t.includes("oil") || t.includes("iran"))
    return "■中東情勢で原油価格変動";

  if (t.includes("inflation"))
    return "■インフレ動向が市場に影響";

  if (t.includes("rate") || t.includes("fed"))
    return "■金利政策への警戒";

  return null; // 不明は捨てる
}
/* ===== 日経 ===== */
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

/* ===== メイン ===== */
/* ===== メイン ===== */
/* ===== メイン ===== */
async function main() {
  const date = getDateJST();

  // ① ニュース取得
  const titles = await getNews();

  // ② AI要約
  const summarized = await summarizeNews(titles);

  // ③ 重複除去＋不足分補充（removeDuplicateThemesは別途定義済み前提）
  const final = removeDuplicateThemes(summarized, titles);

  // ④ ■を必ず付与（ここで統一）
  const cleaned = final.map(t => t.startsWith("■") ? t : "■" + t);

  // ⑤ 日経取得
  const nikkei = await getNikkei();

  // ⑥ JSON生成（★ここで cleaned を使う）
  const data = {
    date,
    nikkei,
    news: cleaned.map(t => ({ title: t }))
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(./data/${date}.json, JSON.stringify(data, null, 2));

  console.log("DONE:", data);
}

main();

ほぼ完成で実用レベルになりました。ちなみに4月23日のニュースは私が今UPDATEを押して手動で取得して現時点でのベスト3を選んでると思いますが、本日15時半にまた自動で取得しにいくようになっていますか？またその際にもっと重要なニュースが出ていたらニュースは書き換えられるようになっていますか？

生成された画像：カレンダーと株価チャートのアイコン


編集


{
  "date": "2026-05-04",
  "nikkei": {
    "close": 59513,
    "change_pct": 0.38
  },
  "news": [
    {
      "title": "■金利政策への警戒"
    },
    {
      "title": "■中東情勢で原油価格変動"
    },
    {


      "title": "■インフレ動向が市場に影響"
    }
  ]
}


{
  "date": "2026-05-05",
  "nikkei": {
    "close": 59513,
    "change_pct": 0.38
  },
  "news": [
    {
      "title": "■金利政策への警戒"
    },
    {
      "title": "■中東情勢で原油価格変動"
    },
    {
      "title": "■インフレ動向が市場に影響"
    }
  ]
}

同じニュースばかり流れる。ニュースの精度をもう少しあげてほしい

今の状態だと、fallbackJP() が発動しすぎていて、
毎回「テンプレ3兄弟」になっています。

■金利政策への警戒
■中東情勢で原油価格変動
■インフレ動向が市場に影響
これは AI が失敗した時の保険としては優秀ですが、
“毎日同じ” になりやすいです。

【原因】
今の simpleJP() が雑すぎます。

例えば：

if (t.includes("oil") || t.includes("iran"))
  return "■中東情勢で原油価格変動";
👉 oil が含まれるニュース全部これになる

【改善方針】
今回は「AI強化」より、

fallbackを賢くする
方が安定します。

【おすすめ修正版】
この関数を丸ごと入れ替え
function simpleJP(text) {
  if (!text) return null;

  const t = text.toLowerCase();

  /* ===== 中東・戦争 ===== */
  if (t.includes("iran") && t.includes("oil")) {
    return "■イラン情勢で原油価格が上昇";
  }

  if (t.includes("ceasefire")) {
    return "■停戦期待で市場がリスクオン";
  }

  if (t.includes("attack") || t.includes("missile")) {
    return "■中東の軍事リスクで市場警戒";
  }

  /* ===== インフレ ===== */
  if (t.includes("inflation") || t.includes("cpi")) {
    return "■インフレ指標を受け利上げ警戒";
  }

  /* ===== 金利 ===== */
  if (t.includes("rate") || t.includes("fed")) {
    return "■金利政策への思惑で市場変動";
  }

  if (t.includes("central bank")) {
    return "■中央銀行の政策姿勢に注目";
  }

  /* ===== 景気 ===== */
  if (t.includes("recession")) {
    return "■景気後退懸念で株価下落";
  }

  /* ===== 関税 ===== */
  if (t.includes("tariff") || t.includes("china")) {
    return "■米中関係への警戒で市場不安";
  }

  return null;
}
【これで何が変わる？】
今：

毎日ほぼ同じ
改善後：

■停戦期待で市場がリスクオン
■景気後退懸念で株価下落
■米中関係への警戒で市場不安
みたいに変化が出る

【さらに重要】
今の検索条件：

q: "Fed OR inflation OR CPI OR interest rate OR oil OR Iran ..."
これだと、

いつも同じテーマを取りに行く
ので、

【おすすめ検索ワード改善】
これに変更推奨：

q: `
(stock OR market OR shares)
AND
(Fed OR inflation OR CPI OR oil OR Iran OR tariff OR recession OR earnings OR war OR bond OR yield)
`,
【なぜこれが効く？】
今：

テーマ固定
改善後：

市場ニュース優先
になる

【実は一番効く改善】
sortBy: "relevancy"

これを：

sortBy: "publishedAt"
にすると、

最新ニュース優先
になります。

【おすすめ最終形】
sortBy: "publishedAt",
pageSize: 30,
👉 これかなり効きます

【優先順位】
まずこれだけでOK：

① simpleJP差し替え
② sortBy を publishedAt
これでかなり変わります。

【結論】
今の問題は：

AIの精度不足
↓
fallback多発
↓
fallbackが雑
です。

なので、

fallbackを強化する
のが最も効果的です。


fallbackって記事要約失敗のときに使う代替手段だよね？それよりも記事要約ができていないことが問題だと思う

その認識で正しいです。
今回の本質はまさにそこです。

fallback が悪い
というより、

AI要約が失敗して fallback に逃げている
のが根本原因です。

【今起きている流れ】
現在：

NewsAPI
↓
Geminiで3件要約
↓
JSONパース失敗 or 形式ズレ
↓
fallbackJP発動
↓
毎回似た文
【つまり本当に直すべき場所】
👉 summarizeNews()

です。

【なぜAI失敗してる？】
今のGemini返答はかなり長文化しやすいです。

例えば以前のログ：

ご提示いただいたニュースの中から...
### 選んだ3つの重要なニュース
...
👉 本当は欲しいのは：

["■原油高でインフレ加速","■停戦期待で株上昇"]
だけ。

【つまり問題は】
AIが「説明モード」に入っている
ことです。

【最重要改善】
Geminiに「絶対JSONだけ返せ」を徹底する
今よりもっと厳しくします。

【summarizeNews のプロンプトだけ差し替え】
この text: の中身を丸ごとこれに変更してください。

text: `
次のニュースから、株価に影響した重要ニュースを3つ選べ。

出力ルール：
・必ず日本語
・必ず3件
・1行15文字前後
・JSON配列のみ返答
・説明禁止
・前置き禁止
・Markdown禁止
・コードブロック禁止
・英語禁止

正しい例：
["■原油高でインフレ加速","■停戦期待で株上昇","■利上げ観測が後退"]

ニュース一覧：
${news.map((n,i)=>`${i+1}. ${n}`).join("\n")}
`
【これで何が変わる？】
今：

AIが先生モードになる
改善後：

AIが「JSON生成器」になる
【さらに重要】
今のこれ：

const match = text.match(/\[.*\]/s);
実は結構危険です。

【なぜ？】
Geminiがこう返すと：

説明文

["aaa","bbb"]

補足
👉 余計な [ ] があると壊れる可能性ある。

【安全版】
これに変更推奨：

const start = text.indexOf("[");
const end = text.lastIndexOf("]");

if (start === -1 || end === -1) {
  return fallbackJP(news);
}

const jsonText = text.slice(start, end + 1);
そして：

arr = JSON.parse(jsonText);
【一番重要な現実】
Geminiは：

「説明して」が得意
「JSONだけ返せ」は苦手
です。

なので、

超厳格プロンプト
が必要。

【現時点の優先順位】
本当にやるべきなのはこれ
① summarizeNews の prompt強化
② JSON抽出改善
【逆に今やらなくていい】
fallback強化
👉 あなたの言う通り根本治療ではない

【結論】
今回の本質：

fallbackの質
ではなく
fallback発動率の高さ
です。

その分析はかなり正確です。


大幅アップデートしたい。
仕様の大幅変更。
ニュースは全部撤廃して、自分でメモ書きを残せるようにしたい。入力欄＋編集・決定ボタンの実装が必要。
記憶しないといけないのでおそらくローカルストレージも必要。

それはかなり良い方向転換だと思います。
今の「AIがニュース選別する仕組み」は面白いですが、精度・安定性・API依存があります。

一方、

「自分専用の株イベント備忘録カレンダー」
にすると、

実用性が高い

ストレスが少ない

API不要

完全無料

情報を自分で管理できる

ローカルだけで動く

ので、かなり強いです。

【新仕様イメージ】
各日付セルに：

日付
日経終値
[メモ表示]

[編集]
編集押すと：

<textarea>
</textarea>

[保存]
【保存方法】
今回はあなたの言う通り：

localStorage
がベストです。

【メリット】
・サーバ不要
・DB不要
・GitHub Pagesだけで完結
・超高速
【保存構造イメージ】
localStorage.setItem(
  "memo_2026-05-04",
  "決算集中日。FOMC警戒"
);
【取り出し】
const memo = localStorage.getItem("memo_2026-05-04");
【おすすめ仕様】
① クリックで編集
普段：

■FOMC警戒
■決算集中
クリック：

<textarea></textarea>
[保存]
② 保存で即反映
リロードしても残る。

③ JSONニュース完全撤廃
つまり：

generate.js
NewsAPI
Gemini
GitHub Actions
全部不要。

かなり軽くなる。

【新構成】
必要
index.html
script.js
だけ。

【不要】
generate.js
workflow
APIキー
news json
全部削除可能。

【むしろ今後強くなる】
例えば：

■SQ
■CPI
■FOMC
■MSQ
■決算
■優待
などを自分で残せる。

これは実際かなり使いやすい。

【おすすめ追加機能】
将来的に：

✔ 色変更
赤＝重要
青＝メモ
✔ ピン留め
重要イベント固定
✔ 自動バックアップ
localStorage export/import
【注意点】
localStorage は：

ブラウザ依存
なので、

Chrome消したりすると消える可能性あり。

【なので将来的には】
export / import
は付けた方がいい。

【次やるべきこと】
かなり大きい仕様変更なので、

index.html
script.js
を丸ごと再設計した方が安全です。

中途半端に差分修正すると、
今までみたいにエラー地獄になりやすいです。

【おすすめ】
次は：

✔ 完全版 index.html
✔ 完全版 script.js
を新仕様で丸ごと作る。

【できるもの】
最終的に：

iPhone風
株トレーダー用
自分専用イベントカレンダー
になります。

これはかなり実用性高いです。


PCブラウザだけで自分用に使います。
全コードで渡してください。

今のコードはこれです。他に変更するファイルはあるならそれも教えてください。

import axios from "axios";
import fs from "fs";

/* ===== JST日付 ===== */
function getDateJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/* ===== ニュース取得 ===== */
async function getNews() {
  if (!process.env.NEWS_API_KEY) {
    console.log("NEWS_API_KEY missing");
    return [];
  }

  const res = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "Fed OR inflation OR CPI OR interest rate OR oil OR Iran OR Middle East OR central bank OR recession OR tariff OR China",
      language: "en",
      sortBy: "relevancy",
      pageSize: 50,
      apiKey: process.env.NEWS_API_KEY
    }
  });

  return res.data.articles.map(a => a.title);
}

/* ===== AI要約（最重要） ===== */
/* ===== 要約＆翻訳（完全安定版） ===== */
/* ===== 要約＆翻訳（英語排除版） ===== */
async function summarizeNews(news) {
  if (!process.env.GEMINI_API_KEY || news.length === 0) {
    return fallbackJP(news);
  }

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 
次のニュースから、株価に影響した重要ニュースを3つ選べ。

出力ルール：
・必ず日本語
・必ず3件
・1行15文字前後
・JSON配列のみ返答
・説明禁止
・前置き禁止
・Markdown禁止
・コードブロック禁止
・英語禁止

正しい例：
["■原油高でインフレ加速","■停戦期待で株上昇","■利上げ観測が後退"]

ニュース一覧：
${news.map((n,i)=>${i+1}. ${n}).join("\n")}

            }]
          }]
        })
      }
    );

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const match = text.match(/\[.*\]/s);
    if (!match) return fallbackJP(news);

    let arr;
    try {
      arr = JSON.parse(match[0]);
    } catch {
      return fallbackJP(news);
    }

    // 日本語チェック
    const hasJP = s => /[ぁ-んァ-ン一-龯]/.test(s);

    const valid = arr.filter(s => hasJP(s));

    if (valid.length < 2) {
      return fallbackJP(news);
    }

    return valid.slice(0,3);

  } catch {
    return fallbackJP(news);
  }
}
/* ===== 重複除去＋不足補充（完全版） ===== */
function removeDuplicateThemes(news, original) {
  const seen = new Set();
  const result = [];

  for (let t of news) {
    let key = "other";

    if (t.includes("イラン") || t.includes("戦争")) key = "war";
    else if (t.includes("インフレ")) key = "inflation";
    else if (t.includes("利上げ") || t.includes("金利")) key = "rate";

    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }

  // ★不足分を元ニュースから補充
  let i = 0;
  while (result.length < 3 && i < original.length) {
    const fallback = simpleJP(original[i]) || null;

    if (fallback && !result.includes(fallback)) {
      result.push(fallback);
    }
    i++;
  }

  return result.slice(0, 3);
}
/* ===== fallback（日本語強制） ===== */
function fallbackJP(news) {
  return news
    .slice(0,5)
    .map(t => simpleJP(t))
    .filter(Boolean)
    .slice(0,3);
}

/* ===== 超簡易翻訳（最低限） ===== */
function simpleJP(text) {
  if (!text) return null;

  let t = text.toLowerCase();

  if (t.includes("oil") || t.includes("iran"))
    return "■中東情勢で原油価格変動";

  if (t.includes("inflation"))
    return "■インフレ動向が市場に影響";

  if (t.includes("rate") || t.includes("fed"))
    return "■金利政策への警戒";

  return null; // 不明は捨てる
}
/* ===== 日経 ===== */
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

/* ===== メイン ===== */
async function main() {
  const date = getDateJST();

  // ① ニュース取得
  const titles = await getNews();

  // ② AI要約
  const summarized = await summarizeNews(titles);

  // ③ 重複除去＋不足分補充（removeDuplicateThemesは別途定義済み前提）
  const final = removeDuplicateThemes(summarized, titles);

  // ④ ■を必ず付与（ここで統一）
  const cleaned = final.map(t => t.startsWith("■") ? t : "■" + t);

  // ⑤ 日経取得
  const nikkei = await getNikkei();

  // ⑥ JSON生成（★ここで cleaned を使う）
  const data = {
    date,
    nikkei,
    news: cleaned.map(t => ({ title: t }))
  };

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(./data/${date}.json, JSON.stringify(data, null, 2));

  console.log("DONE:", data);
}

main();

了解しました。
今回は仕様が完全に変わるので、中途半端な差分修正ではなく、

index.html
script.js
を丸ごと新仕様に置き換えます。

【今回の仕様】
✔ ニュース完全撤廃
NewsAPI不要

Gemini不要

generate.js不要

workflow不要

✔ 自分でメモ
日付ごとに自由入力

編集ボタン

保存ボタン

✔ localStorage保存
F5しても消えない

PCブラウザ専用

超高速

【不要になるファイル】
削除してOK：

generate.js
.github/workflows/update.yml
dataフォルダ
package.json（不要なら）
【必要ファイル】
残すのは：

index.html
script.js
だけ。

【① index.html（完全版）】
そのまま丸ごと置き換え。

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>株イベント備忘録カレンダー</title>

<style>
body{
  margin:0;
  font-family:sans-serif;
  background:#f5f5f5;
}

/* ヘッダー */
.header-bar{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:10px;
  background:#222;
  color:#fff;
}

.header-bar button{
  padding:6px 12px;
  font-size:16px;
}

/* カレンダー */
.grid{
  display:grid;
  grid-template-columns:repeat(7,1fr);
}

/* 曜日 */
.header{
  background:#eee;
  text-align:center;
  padding:6px 0;
  font-weight:bold;
  border:1px solid #ccc;
}

.sun{ background:#ffdede; }
.sat{ background:#dde5ff; }
.week{ background:#eee; }

/* セル */
.cell{
  border:1px solid #ccc;
  min-height:140px;
  background:#fff;
  padding:4px;
  display:flex;
  flex-direction:column;
}

/* 日付 */
.date{
  font-weight:bold;
  margin-bottom:4px;
}

/* メモ */
.memo{
  flex:1;
  font-size:13px;
  white-space:pre-wrap;
  overflow-wrap:break-word;
  margin-bottom:6px;
}

/* textarea */
textarea{
  width:100%;
  height:70px;
  resize:vertical;
  box-sizing:border-box;
  font-size:13px;
}

/* ボタン */
.actions{
  display:flex;
  gap:4px;
}

.actions button{
  flex:1;
  padding:4px;
  font-size:12px;
}
</style>
</head>

<body>

<div class="header-bar">
  <button onclick="prev()">←</button>
  <div id="title"></div>
  <button onclick="next()">→</button>
</div>

<div id="grid" class="grid"></div>

<script src="script.js"></script>

</body>
</html>
【② script.js（完全版）】
これも丸ごと置き換え。

const grid = document.getElementById("grid");
const title = document.getElementById("title");

let current = new Date();

/* JST */
function getJSTParts(date){
  const jst = new Date(date.getTime() + 9*60*60*1000);

  return {
    y:jst.getFullYear(),
    m:jst.getMonth(),
    d:jst.getDate()
  };
}

function formatDate(y,m,d){
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

/* localStorage */
function getMemo(dateStr){
  return localStorage.getItem("memo_" + dateStr) || "";
}

function saveMemo(dateStr, text){
  localStorage.setItem("memo_" + dateStr, text);
}

/* 描画 */
function render(){

  grid.innerHTML = "";

  const {y,m} = getJSTParts(current);

  title.textContent = `${y}年${m+1}月`;

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  days.forEach((d,i)=>{
    const div = document.createElement("div");

    div.className =
      "header " +
      (i===0 ? "sun" :
      i===6 ? "sat" :
      "week");

    div.textContent = d;

    grid.appendChild(div);
  });

  const first = new Date(y,m,1).getDay();
  const last = new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++){
    grid.appendChild(document.createElement("div"));
  }

  for(let d=1; d<=last; d++){

    const dateStr = formatDate(y,m,d);

    const cell = document.createElement("div");
    cell.className = "cell";

    const memo = getMemo(dateStr);

    cell.innerHTML = `
      <div class="date">${d}</div>

      <div class="memo" id="memo-${dateStr}">
        ${memo.replace(/\n/g,"<br>")}
      </div>

      <div class="actions">
        <button onclick="editMemo('${dateStr}')">
          編集
        </button>
      </div>
    `;

    grid.appendChild(cell);
  }
}

/* 編集 */
function editMemo(dateStr){

  const memoDiv = document.getElementById("memo-" + dateStr);

  const currentText =
    localStorage.getItem("memo_" + dateStr) || "";

  memoDiv.innerHTML = `
    <textarea id="textarea-${dateStr}">${currentText}</textarea>

    <div class="actions" style="margin-top:4px;">
      <button onclick="saveMemoAndRender('${dateStr}')">
        保存
      </button>

      <button onclick="render()">
        キャンセル
      </button>
    </div>
  `;
}

/* 保存 */
function saveMemoAndRender(dateStr){

  const textarea =
    document.getElementById("textarea-" + dateStr);

  const text = textarea.value;

  saveMemo(dateStr, text);

  render();
}

/* 月移動 */
function prev(){
  current.setMonth(current.getMonth()-1);
  render();
}

function next(){
  current.setMonth(current.getMonth()+1);
  render();
}

render();

window.prev = prev;
window.next = next;
window.editMemo = editMemo;
window.saveMemoAndRender = saveMemoAndRender;
【これでできること】
✔ 日付ごとにメモ
FOMC
CPI
MSQ
決算
優待
✔ 保存
localStorage保存
✔ リロードしても残る
F5 OK
✔ GitHub Pagesだけで動く
完全静的サイト。

【今後追加しやすい機能】
かなり拡張しやすい構造になってます。

例えば：

✔ 色変更
✔ 重要マーク
✔ 検索
✔ export/import
✔ ドラッグ移動
【最後に重要】
今回は：

AIニュースアプリ
↓
自分専用トレード備忘録
へ進化しています。

実用性はむしろかなり上がっています。


編集、保存ボタンの出現はOKで動作もしています。ですが前みたいに日経平均の終値と±○%の表示は同じ位置に残して欲しいです

了解しました。
今の仕様変更で「日経表示」が消えてしまっているので、

日経平均の表示だけ復活
させます。

今回は script.js だけ修正すればOKです。
index.html は変更不要。

【やること】
① 日経データ取得関数追加
② render内で表示
【script.js 完全版（丸ごと置き換え）】
今の script.js を全部これに置き換えてください。

const grid = document.getElementById("grid");
const title = document.getElementById("title");

let current = new Date();

/* 日経キャッシュ */
let nikkeiCache = null;

/* JST */
function getJSTParts(date){
  const jst = new Date(date.getTime() + 9*60*60*1000);

  return {
    y:jst.getFullYear(),
    m:jst.getMonth(),
    d:jst.getDate()
  };
}

function formatDate(y,m,d){
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

/* ===== 日経取得 ===== */
async function getNikkei(){

  // キャッシュ済みなら再取得しない
  if(nikkeiCache) return nikkeiCache;

  try{
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/^N225"
    );

    const json = await res.json();

    const meta = json.chart.result[0].meta;

    const close = Math.round(meta.regularMarketPrice);
    const prev = meta.previousClose;

    const pct =
      ((close - prev) / prev) * 100;

    nikkeiCache = {
      close,
      pct: Number(pct.toFixed(2))
    };

    return nikkeiCache;

  }catch(e){

    console.log("日経取得失敗", e);

    return null;
  }
}

/* localStorage */
function getMemo(dateStr){
  return localStorage.getItem("memo_" + dateStr) || "";
}

function saveMemo(dateStr, text){
  localStorage.setItem("memo_" + dateStr, text);
}

/* 描画 */
async function render(){

  grid.innerHTML = "";

  const {y,m,d:today} = getJSTParts(current);

  title.textContent = `${y}年${m+1}月`;

  const nikkei = await getNikkei();

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  days.forEach((d,i)=>{
    const div = document.createElement("div");

    div.className =
      "header " +
      (i===0 ? "sun" :
      i===6 ? "sat" :
      "week");

    div.textContent = d;

    grid.appendChild(div);
  });

  const first = new Date(y,m,1).getDay();
  const last = new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++){
    grid.appendChild(document.createElement("div"));
  }

  for(let d=1; d<=last; d++){

    const dateStr = formatDate(y,m,d);

    const cell = document.createElement("div");
    cell.className = "cell";

    const memo = getMemo(dateStr);

    /* 今日だけ日経表示 */
    let nikkeiHTML = "";

    const isToday = (d === today);

    if(isToday && nikkei){

      const cls =
        nikkei.pct >= 0
        ? "up"
        : "down";

      nikkeiHTML = `
        <div class="nikkei ${cls}">
          日経 ${nikkei.close}円
          (${nikkei.pct >=0 ? "+" : ""}
          ${nikkei.pct}%)
        </div>
      `;
    }

    cell.innerHTML = `
      <div class="date">${d}</div>

      ${nikkeiHTML}

      <div class="memo" id="memo-${dateStr}">
        ${memo.replace(/\n/g,"<br>")}
      </div>

      <div class="actions">
        <button onclick="editMemo('${dateStr}')">
          編集
        </button>
      </div>
    `;

    grid.appendChild(cell);
  }
}

/* 編集 */
function editMemo(dateStr){

  const memoDiv =
    document.getElementById("memo-" + dateStr);

  const currentText =
    localStorage.getItem("memo_" + dateStr) || "";

  memoDiv.innerHTML = `
    <textarea id="textarea-${dateStr}">${currentText}</textarea>

    <div class="actions" style="margin-top:4px;">
      <button onclick="saveMemoAndRender('${dateStr}')">
        保存
      </button>

      <button onclick="render()">
        キャンセル
      </button>
    </div>
  `;
}

/* 保存 */
function saveMemoAndRender(dateStr){

  const textarea =
    document.getElementById("textarea-" + dateStr);

  const text = textarea.value;

  saveMemo(dateStr, text);

  render();
}

/* 月移動 */
function prev(){
  current.setMonth(current.getMonth()-1);
  render();
}

function next(){
  current.setMonth(current.getMonth()+1);
  render();
}

render();

window.prev = prev;
window.next = next;
window.editMemo = editMemo;
window.saveMemoAndRender = saveMemoAndRender;
【さらにCSS追加（index.html）】
<style> の最後にこれ追加。

/* 日経 */
.nikkei{
  font-size:13px;
  font-weight:bold;
  margin-bottom:6px;
}

.up{
  color:green;
}

.down{
  color:red;
}
【これでどうなるか】
今日の日付だけ：

日経 59338円 (+0.42%)
表示されます。

【仕様】
✔ 今日だけ表示
理由：

過去の日経を保存していないため
【もし全日付に表示したいなら】
将来的には：

localStorage に保存
できます。

【今の構成】
かなり良いです。

・超軽量
・API不要
・ローカル保存
・自分専用
・高速
かなり実用的です。


