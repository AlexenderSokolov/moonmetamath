# 独立下游：长期运行的证明客户端

这个目录是完整的独立 MoonBit 模块。只导入发布包的根接口，不读取 `src/core`
或生成的 JavaScript。它演示两个独立引擎、80次创建/释放会话、实际证明与导出、
活动数据库卸载拒绝和过期句柄拒绝。它是项目提供的集成示例，不是外部采用证据。

发布0.4.0后，把本目录复制到仓库以外，在固定工具链或兼容环境中运行：

```sh
moon update
moon run . --target js
moon run . --target wasm-gc
```

输出第一行为已检查的证明导出 JSON，第二行为通过摘要。应用须读取 `outcome`
来判断数学结果，不能将 `status: "ok"` 本身当作证明有效。

项目维护者用以下命令在新目录检查同一示例；命令输出路径含日志和独立C结果：

```sh
node scripts/downstream.mjs
node scripts/downstream.mjs --registry --version 0.4.0
```

第一条使用显式 workspace 关联本地开发源码；第二条仅从注册表安装精确版本。
两条都执行 JS/wasm-gc，并把实际导出的 `.mm` 交给开发用独立检查器复核。
