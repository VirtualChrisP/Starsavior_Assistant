import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCatBoostDataset } from "../src/training/catboost-dataset.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function usage() {
  console.log(`用法：
  node tools/generate-catboost-dataset.mjs --input <历史 JSON> --output-dir <输出目录>

可选：
  --patch <版本>       只导出指定版本
  --region <服务器>    只导出指定服务器
  --help               显示帮助`);
}

if (hasFlag("--help")) {
  usage();
  process.exit(0);
}

const inputPath = argument("--input");
const outputDir = argument("--output-dir", "data/training/catboost");
if (!inputPath) {
  usage();
  process.exit(1);
}

const history = JSON.parse(await readFile(resolve(inputPath), "utf8"));
const dataset = buildCatBoostDataset(history, { patch: argument("--patch"), region: argument("--region") });
const outputPath = resolve(outputDir);
await mkdir(outputPath, { recursive: true });
await writeFile(resolve(outputPath, "draft-actions.tsv"), dataset.tsv, "utf8");
await writeFile(resolve(outputPath, "draft-actions.cd"), dataset.columnDescription, "utf8");
await writeFile(resolve(outputPath, "summary.json"), JSON.stringify(dataset.summary, null, 2) + "\n", "utf8");
const readme = [
  "# CatBoost 训练集",
  "",
  "本目录由 generate-catboost-dataset.mjs 生成。",
  "",
  "- draft-actions.tsv：每个有可见状态快照的 BP 动作一行。",
  "- draft-actions.cd：CatBoost 列类型描述。",
  "- summary.json：读取、过滤和标签分布统计。",
  "",
  "训练时应按 draft_id 分组切分，避免同一局的多个动作同时进入训练集和验证集。标签 1 表示我方胜利，0 表示对方胜利。"
].join("\n") + "\n";
await writeFile(resolve(outputPath, "README.zh-CN.md"), readme, "utf8");console.log(`CatBoost 数据集已生成：${outputPath}`);
console.log(JSON.stringify(dataset.summary, null, 2));
