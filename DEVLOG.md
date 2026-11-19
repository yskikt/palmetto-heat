# PALMETTO HEAT — DEVLOG (r6 rebuild)

make.fun gta6-01 向けオープンワールド・クライムゲーム「PALMETTO HEAT」の
r6 リポジトリでのゼロからの再構築記録。設計の出典は `../DESIGN.md` と
初代 `../palmetto-heat/DEVLOG.md`（仕様ドキュメントとしてのみ参照し、
旧ソースコードと旧スクリーンショットは一切参照・コピーしていない）。

## 構成（game/src/）

| ファイル | 役割 |
|---|---|
| roads.js | 道路グリッド（NS 10 本 × EW 5 本＋海岸大通り）、車線、信号周期、グリッドルート |
| layout.js | 街レイアウト（ゾーン別建物、港、ヤシ 112 本、街灯）、AABB 衝突解決 |
| city.js | three.js シーン構築（空グラデーション、夕景光、海・ビーチ、建物、港、InstancedMesh ヤシ） |
| car.js | ローポリ車両メッシュ（警察仕様含む）とアーケード運転物理 |
| player.js | 徒歩プレイヤー（カプセル型人型）とカメラ相対移動、手持ちプロップ |
| input.js | キーボード／マウス入力 |
| traffic.js | 交通 AI（車線・信号・前車追従・駐車車両） |
| peds.js | 歩行者（周回・回避・逃走・転倒） |
| wanted.js | 手配度（犯罪別ヒート＋減衰） |
| police.js | 警察 AI（出現・追跡・取囲み・BUSTED 圧力、ライトバー点滅） |
| combat.js | 戦闘（素手／バット／拳銃、トレーサー＋マズルフラッシュ）と武器ホイール |
| missions.js | ストーリー 3 本（First Run / The Set-Up / Last Heat）＋反復配達、金の目標柱 |
| save.js | localStorage セーブ |
| audio.js | WebAudio 生成（エンジン、サイレン、環境音、ラジオ 4 局＋OFF） |
| hud.js | HUD 一式とミニマップ（ルート線、警察ブリップ、手配インジケーター） |
| main.js | 起動、タイトル、モード切替、追従カメラ、ループ、?shot= モード |

## 実装した仕様（初代 DEVLOG の数値どおり）

- ヤシ 112 本：幹基準 8.6 m・根元半径 0.34 m、大通り（z=180.5 / 202.5 の 2 列）は
  hs 1.18–1.50 で実高 10.2–12.9 m、樹冠径約 13 m、葉 14 枚 2 段構成＋ココナッツ、
  影有効、InstancedMesh（幹・葉・実）。
- 武器ホイール：Tab 長押し / Q トグル、スローモーション ×0.12、マウス / A・D 選択。
- ラジオ：R 切替、WebAudio 生成 4 局＋OFF、局名／曲名表示、16 秒ローテーション、運転中のみ。
- 手配インジケーター：星点滅、画面端赤青フラッシュ（距離連動）、ミニマップ警察ブリップ、
  SPOTTED / PURSUIT / EVADING 表示。
- ミッション：受注時に詳細パネル約 9 秒、金の目標柱、ミニマップにマンハッタンルート線、
  目標バナーに残距離 m＋方向矢印。
- ショットモード：`?shot=hero|foot|chase|mission`、`window.__shotReady` で撮影準備完了を通知。

## 検証

- ヘッドレス Chrome（chrome-headless-shell 157 + puppeteer-core、SwiftShader）で
  4 ショット＋通常起動（タイトル→Enter→徒歩→M で受注）を実行し、
  pageerror / console error / requestfailed すべてゼロを確認（tools/capture.mjs）。
- スクリーンショットは screenshots/ に 1280×800 JPG で配置（各 256KiB 以内）。
- ゲート自己チェックと配管テスト（main.ts → dossier.json）の結果は最終報告に記載。
