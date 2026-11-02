#!/usr/bin/env bash
# 一条命令走完：签名插件 → 验签 → 仓库索引签名。
# 需要先把 muvyo-signing.json 放在本目录（Muvyo 开发者页下载）。
set -euo pipefail
cd "$(dirname "$0")"

PY="${PY:-python3}"
ID="lp452.nextfind"
SIGN_INDEX=".claude/skills/muvyo-addon-publish/scripts/sign_index.py"

if [ ! -f muvyo-signing.json ]; then
  echo "✗ 缺少 muvyo-signing.json（Muvyo → 插件 → 第三方插件 → 开发者 → 用 GitHub 账号领取证书）" >&2
  exit 1
fi

echo "== 1/4 加密并签名插件 =="
"$PY" mv_addon.py sign "./src/$ID" -o .

echo "== 2/4 验签 =="
"$PY" mv_addon.py verify "./plugins/$ID"

echo "== 3/4 仓库索引密钥 =="
if [ ! -f repo-signing.pem ]; then
  "$PY" "$SIGN_INDEX" init-key --key repo-signing.pem
  echo "  已生成 repo-signing.pem，请立刻备份，丢了就发不了新版"
else
  echo "  复用已有 repo-signing.pem"
fi

echo "== 4/4 签名索引 =="
"$PY" "$SIGN_INDEX" sign --key repo-signing.pem

echo
echo "✓ 完成。产物："
ls -1 index.json index.json.sig "plugins/$ID" 2>/dev/null
