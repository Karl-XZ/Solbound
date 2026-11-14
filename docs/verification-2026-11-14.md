# 3D 生活舱版本检查（2026-11-14）

来源：`mars-eva-cabin-3d-project.zip`。主分支导入前为 `6308923`。

## 更新范围

按压缩包导入生活舱 3D 场景、舱内主题、运行工具、测试脚本和示例截图。游戏规则、资源数值、第三人称舱外控制保持压缩包版本。新增开发依赖使用锁定的 Playwright 1.58.2，npm ci 成功。

## 发现并修复

1. 844×390 横屏底部状态栏遮住床、食物、宇航员等物品标签。改为紧凑 HUD；完整保留当前资源与屏蔽数值，未修改场景或相机位置。
2. 3D 舱内忽略“减少动态效果”偏好。现可冻结装饰性晃动、闪光和噪点，切回正常偏好后恢复。状态更新不受影响。
3. 本地服务对错误 URL 解码未捕获，异常网址可能使进程退出；路径前缀检查还可能允许同名前缀的相邻目录。现返回 400/403，并检查规范化及真实路径。
4. 浏览器自测收集到 pageerror 时原先只打印说明，仍可能标为通过。现明确判失败；修复启动失败时的清理和退出。

## 验证结果

- 21/21 逻辑与 HTTP/测试运行器回归测试通过。
- 18/18 浏览器脚本通过，测试运行器未报告页面脚本异常。
- 所有项目 JS/CJS 语法检查和 git diff --check 通过。
- 本地服务引用的 20 个脚本/样式全部 HTTP 200，内容与当前工作树一致。
- 完整第一天教程：亲自移动、清扫、接线、回舱、净水、饮水、分电、休息，最终进入第 2 天。
- 30 天流程：15 类事件、持续资源结算、辐射分项、科研目标通过。
- 采样与分析、重复操作防重奖、风暴限制、跳过教程、控制台入口、统一状态栏、两种分电完成按钮通过。
- 直接点击 3D 物品、悬停高亮、白天/夜晚/风暴状态联动通过。
- 开场三种跳过路径无相机闪回；结局显示与重新开始通过。
- 2032×1024、1280×720、844×390、390×844 下物品标签与关键操作通过。390×844 触屏模拟下摇杆和舱外互动通过。

测试使用本机 Chrome（含 WebGL 软件渲染），手机为浏览器设备模拟；未做真实手机硬件帧率测试。NASA/字体等外部网络依赖仍可能受限，核心资源本地提供，NASA 保留历史存档回退。未部署到远程服务器。

截图与完整运行结果保存在忽略目录 `output/playwright/`、`output/test-results.json`。

## 浏览器脚本

- cabin-layout.pw.js: PASS (29.3 s)
- cabin-reduced-motion.pw.js: PASS (7.0 s)
- cabin3d-pick.pw.js: PASS (10.9 s)
- endings.pw.js: PASS (47.0 s)
- first-day.pw.js: PASS (41.4 s)
- intro-transition.pw.js: PASS (81.5 s)
- mobile.pw.js: PASS (19.3 s)
- multiday.pw.js: PASS (59.4 s)
- power-feedback.pw.js: PASS (5.5 s)
- sample-loop.pw.js: PASS (20.1 s)
- scene-console-mobile.pw.js: PASS (13.2 s)
- scene-console.pw.js: PASS (14.9 s)
- shared-station.pw.js: PASS (6.0 s)
- skip-events.pw.js: PASS (10.9 s)
- survey.pw.js: PASS (10.1 s)
- tutorial-allocation.pw.js: PASS (11.4 s)
- tutorial-evidence.pw.js: PASS (7.6 s)
- tutorial-order.pw.js: PASS (7.0 s)

压缩包 SHA-256：`ab2197faa9813f4fb9f4966087bd3ab2988911a0842cb4ad028621fc63235881`
