# 口袋病历

临床核对用的静态网页。病历草稿、微泵、剂量、费用对照。文字只在这台浏览器里。清除站点数据，草稿就没了。不诊断，不写医嘱。

## 本地

```sh
node --test
python3 -m http.server 8765 --directory public
```

打开 http://127.0.0.1:8765/

`package.json` 只有 `"type": "module"`，不用安装依赖。

## 部署

推到 GitHub 的 `main`。Actions 把 `public` 发到 Cloudflare Pages，项目名 `wardkit`。

在 GitHub → Settings → Secrets and variables → Actions 添加两个密钥，不要写进仓库，也不要贴到聊天里：

- `CLOUDFLARE_API_TOKEN`：Cloudflare → My Profile → API Tokens。这个账号要有 Cloudflare Pages 的编辑权限。
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 首页该账号右侧的 Account ID。

如果 Actions 说项目不存在：Cloudflare → Workers & Pages → Create → Pages，项目名填 `wardkit`，然后再推一次 `main`。地址用 Cloudflare 给的 `*.pages.dev`。

本机还没登录 GitHub 时：

```sh
gh auth login
gh repo create wardkit --public --source=. --remote=origin --push
```

## 手机

用浏览器打开站点，添加到主屏幕。先在线打开一次，之后可以离线。iPhone 的 Safari 通常没有网页语音，语音按钮会隐藏，打字和复制仍可用。

## Android 安装包

需要 JDK 17。没有 JDK 就先装，脚本不会编一个不能装的包。

站点能打开之后：

```sh
WARDKIT_URL=https://你的项目.pages.dev sh scripts/build-apk.sh
```

按它打印的命令做一次 `bubblewrap init`。包名填 `app.wardkit.pocket`。密钥留在本机。

然后重新跑上面的脚本，它会 `bubblewrap build`。

```sh
keytool -list -v -keystore android.keystore
```

把 SHA-256 填进 `public/.well-known/assetlinks.json` 的 `sha256_cert_fingerprints`，替换 `REPLACE_WITH_SHA256_FROM_KEYSTORE`，再推上 `main`。等这次部署完成再安装 apk。

`android/`、`*.keystore`、`twa-manifest.json`、`*.apk` 已忽略，不要提交。安装包要你自己的签名，不能代你上架应用商店。

## 不做

不接大模型，不做 DRG 分组，不上药品库和指南全文，不进医院 HIS，草稿不同步。
