#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

if ! java -version >/dev/null 2>&1; then
  echo "没有 JDK。装 JDK 17 后再跑。这一步不会编出安装包。"
  exit 1
fi

echo "Java: $(java -version 2>&1 | head -n 1)"

if [ ! -f twa-manifest.json ]; then
  if [ -z "${WARDKIT_URL:-}" ]; then
    echo "站点上线后设置 WARDKIT_URL 再跑。"
    echo "例: WARDKIT_URL=https://你的项目.pages.dev sh scripts/build-apk.sh"
    exit 1
  fi
  echo "还没有 twa-manifest.json。在仓库根目录运行："
  echo "  npx @bubblewrap/cli init --manifest \"${WARDKIT_URL}/manifest.webmanifest\""
  echo "包名填 app.wardkit.pocket。密钥留在本机，不要提交。"
  echo "init 完成后重新跑本脚本，它会执行 bubblewrap build。"
  echo "然后："
  echo "  keytool -list -v -keystore android.keystore"
  echo "把 SHA256 写入 public/.well-known/assetlinks.json，再推一次 main。"
  exit 1
fi

npx --yes @bubblewrap/cli build
echo "apk 在本目录。android/、密钥、twa-manifest.json 不要提交。"
