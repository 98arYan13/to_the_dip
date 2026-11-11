# راهنمای فنی پروژهٔ Digger

بازی دوبعدی با گرافیک پیکسلی باکیفیت، ساخته‌شده با روش vibe coding در Claude Code.

> این سند مرجع ثابت پروژه است. هر سشن جدید Claude Code باید اول این فایل و `CLAUDE.md` را بخواند.

---

## ۱. خلاصهٔ تصمیم‌ها

| موضوع | انتخاب | دلیل |
|---|---|---|
| موتور بازی | **Godot 4.7** (GDScript) | سبک، رایگان، فایل‌های صحنه متنی (`.tscn`) که Claude راحت می‌خواند و می‌نویسد، پشتیبانی عالی از پیکسل‌آرت |
| رندرر | GL Compatibility | برای دوبعدی کافی است؛ خروجی وب و سیستم‌های ضعیف را هم پشتیبانی می‌کند |
| روش برنامه‌ریزی و کدنویسی | **Superpowers** (نه Spec-kit) | از قبل نصب است، چرخهٔ سبک «ایده ← پلن ← اجرا ← تست» دارد و برای پروژهٔ تک‌نفره و در حال تغییر مناسب‌تر است |
| طرح اولیهٔ گرافیک (AI) | **ChatGPT یا Gemini** با promptهایی که Claude می‌نویسد | ساده و بدون نصب. راهنمای کامل: [ART_WORKFLOW.fa.md](ART_WORKFLOW.fa.md) |
| تبدیل به پیکسل واقعی | **`tools/prepare_sprite.py`** | حذف پس‌زمینه، جدا کردن فریم، تبدیل به 32×32، محدود کردن پالت |
| فریم‌ها، پاک‌سازی و خروجی | **Aseprite + pixel-mcp** | Claude داخل Aseprite فریم، تگ، پالت و sprite sheet می‌سازد |
| ویرایش و پاک‌سازی پیکسل | **Aseprite** (یا Pixelorama رایگان) | خروجی هوش مصنوعی همیشه نیاز به اصلاح دستی دارد |
| کنترل Godot از Claude | **Godot MCP** (`@coding-solo/godot-mcp`) | Claude بازی را اجرا می‌کند، خطاها را می‌خواند و صحنه می‌سازد |

### چرا Superpowers و نه Spec-kit؟

- **Spec-kit** (گیت‌هاب) روی «توسعهٔ مبتنی بر مشخصات» تمرکز دارد: `constitution`، `specify`، `plan`، `tasks` و `implement`. برای محصولی با نیازمندی‌های ثابت و تیم چندنفره عالی است، اما برای بازی که طراحی‌اش با بازی‌کردن عوض می‌شود سربار زیادی دارد.
- **Superpowers** مجموعه‌ای از skillهای فرایندی است که خودکار فعال می‌شوند و جلوی کارهای عجولانه را می‌گیرند. skillهای اصلی برای این پروژه:

| Skill | کی استفاده شود |
|---|---|
| `superpowers:brainstorming` | قبل از هر ویژگی جدید: ایده با سؤال و جواب شفاف می‌شود |
| `superpowers:writing-plans` | تبدیل ایده به پلن مرحله‌به‌مرحله (در `docs/plans/`) |
| `superpowers:executing-plans` | اجرای پلن در همان سشن |
| `superpowers:subagent-driven-development` | اجرای پلن با تسک‌های مستقل توسط subagentها |
| `superpowers:systematic-debugging` | هر باگ یا رفتار عجیب، قبل از حدس زدن راه‌حل |
| `superpowers:test-driven-development` | منطق خالص بازی (محاسبهٔ آسیب، اینونتوری، تولید نقشه) |
| `superpowers:verification-before-completion` | قبل از اعلام «تمام شد»: اجرای واقعی بازی |

---

## ۲. نصب و پیش‌نیازها

| ابزار | وضعیت | دستور / توضیح |
|---|---|---|
| Git | نصب است | — |
| Node.js و npx | نصب است | برای Godot MCP |
| uv (پایتون) | نصب است | برای Aseprite MCP (اختیاری) |
| Godot 4.7 | با winget نصب شد | `winget install GodotEngine.GodotEngine` |
| Aseprite | از سورس در `D:\tools\aseprite` (بخش ۳.۳) | کامپایل از سورس برای استفادهٔ شخصی رایگان است؛ نسخهٔ آماده حدود ۲۰ دلار |
| VS 2022 Build Tools، CMake، Ninja | نصب شد (Build Tools در `D:\VS`) | برای کامپایل Aseprite |
| Pixelorama | جایگزین رایگان | `winget install OramaInteractive.Pixelorama` |
| ComfyUI و مدل‌ها | **هنوز نصب نشده** | بخش ۳.۴. حدود ۱۵ گیگابایت، روی درایو D |

---

## ۳. تنظیم MCPها

تنظیمات در فایل `.mcp.json` ریشهٔ پروژه است و در git ذخیره می‌شود. **هیچ کلید مخفی داخل آن نیست**؛ مقادیر از متغیرهای محیطی ویندوز خوانده می‌شوند.

### ۳.۱ متغیرهای محیطی (اختیاری)

مسیرها در `.mcp.json` مقدار پیش‌فرض دارند. فقط اگر ابزاری را جای دیگری نصب کردید، `GODOT_PATH` یا `PIXEL_MCP_PATH` را با `setx` تنظیم کنید و اپ Claude را دوباره باز کنید. هیچ سرویس پولی یا API token در این پروژه استفاده نمی‌شود.

### ۳.۲ سرورهای تعریف‌شده

| نام | نوع | کاربرد |
|---|---|---|
| `godot` | محلی (`npx @coding-solo/godot-mcp`) | ابزارها: `run_project`، `get_debug_output`، `stop_project`، `create_scene`، `add_node`، `load_sprite`، `save_scene`، `launch_editor` و… |
| `aseprite` | محلی (`pixel-mcp.exe`) | رسم، پالت، فریم و تگ انیمیشن، خروجی sprite sheet داخل Aseprite (بخش ۳.۳) |

در اولین اجرای Claude Code در این پوشه، تأیید استفاده از MCPهای پروژه پرسیده می‌شود. آن را قبول کنید. برای بررسی وضعیت در ترمینال:

```bash
claude mcp list
```

### ۳.۳ Aseprite و MCP آن (pixel-mcp)

سرور `aseprite` در `.mcp.json` از [pixel-mcp](https://github.com/willibrandon/pixel-mcp) نسخهٔ 0.5.0 استفاده می‌کند (فایل اجرایی آماده در `D:\tools\pixel-mcp\pixel-mcp.exe`، checksum بررسی شد). این سرور Aseprite را در پس‌زمینه اجرا می‌کند.

**چیدمان روی این سیستم** (درایو C جا ندارد، همه روی D است):

| مسیر | محتوا |
|---|---|
| `D:\VS\BuildTools` | کامپایلر MSVC |
| `D:\tools\aseprite` | سورس Aseprite |
| `D:\tools\skia` | کتابخانهٔ Skia آماده (m124) |
| `D:\tools\pixel-mcp` | سرور MCP |
| `%USERPROFILE%\.config\pixel-mcp\config.json` | تنظیمات pixel-mcp (مسیر aseprite.exe) |

**کامپایل Aseprite** (یک بار، حدود ۱۵ تا ۳۰ دقیقه):

```bash
tools\build_aseprite.cmd
```

خروجی: `D:\tools\aseprite\build\bin\aseprite.exe`. برای آپدیت بعدی: `git -C D:\tools\aseprite pull --recurse-submodules` و دوباره همین اسکریپت.

**بررسی سلامت:**

```bash
D:\tools\pixel-mcp\pixel-mcp.exe --health
```

**ابزارهای اصلی:** `create_canvas`، `add_layer`، `draw_pixels`، `fill_area`، `set_palette`، `apply_shading`، `draw_with_dither`، `apply_outline`، `downsample_image`، `import_image`، و برای انیمیشن `add_frame`، `duplicate_frame`، `set_frame_duration`، `create_tag`، `link_cel`، و خروجی `export_spritesheet`.

**تقسیم کار پیشنهادی:** طرح اولیهٔ کاراکتر با هوش مصنوعی ساخته می‌شود؛ Claude با این MCP فریم‌ها، پاک‌سازی، پالت و خروجی sprite sheet را انجام می‌دهد؛ اصلاح هنری نهایی با خود شماست. Claude در طراحی پیکسل‌به‌پیکسل کاراکتر از صفر ضعیف است.

جایگزین پرامکانات‌تر (حدود ۱۲۰ ابزار، Python 3.13): [diivi/aseprite-mcp](https://github.com/diivi/aseprite-mcp).

نکته: در pixel-mcp مسیرها را همیشه با `/` بنویسید (`C:/...`). مسیر با `\` خطای JSON می‌دهد.

### ۳.۴ ComfyUI لوکال (کنار گذاشته شده، اختیاری)

فعلاً از ChatGPT یا Gemini استفاده می‌کنیم ([ART_WORKFLOW.fa.md](ART_WORKFLOW.fa.md)). ComfyUI در `D:\tools\ComfyUI_windows_portable` نصب است و مدل اصلی، VAE، دو LoRA و نود PixelOE دانلود شده‌اند. **رمزگذار متن (`qwen_3_4b.safetensors`) ناقص است.** برای فعال‌سازی دوباره: آن فایل را کامل دانلود کنید و سرور `comfyui` را به `.mcp.json` اضافه کنید (`cmd /c npx -y comfyui-mcp` با `COMFYUI_URL=http://127.0.0.1:8188`).

| جزء | انتخاب | توضیح |
|---|---|---|
| محیط اجرا | [ComfyUI](https://github.com/comfyanonymous/ComfyUI) (portable، در `D:\tools\ComfyUI`) | |
| مدل پایه | **FLUX.2 klein 4B** (نسخهٔ fp8) | Apache 2.0، هم ساخت تصویر و هم ویرایش با تصویر مرجع (برای یکدست ماندن کاراکتر) |
| سبک پیکسلی | [limbicnation/pixel-art-lora](https://huggingface.co/limbicnation/pixel-art-lora) | sprite با پس‌زمینهٔ شفاف؛ ۴ step، CFG 1.0، قدرت LoRA بین 0.85 و 1.4 |
| چند زاویه | [spritesheet LoRA](https://huggingface.co/xocialize/spritesheet-FLUX.2-klein-4B-lora) | از یک تصویر، شیت 2×2 با ۴ زاویه |
| پیکسلی‌سازی | [PixelOE](https://github.com/KohakuBlueleaf/PixelOE) (نود ComfyUI) | شبکهٔ پیکسل واقعی، outline، محدود کردن پالت |
| اتصال به Claude | [comfyui-mcp](https://github.com/artokun/comfyui-mcp) (`npx -y comfyui-mcp`، MIT) | ساخت تصویر، دیدن نتیجه، اجرای workflow |

**هشدار لایسنس:** از FLUX.1 Kontext dev و FLUX.2 klein 9B استفاده نکنید؛ لایسنسشان غیرتجاری است.

**پشتیبان:** SDXL + LoRA «Pixel Art XL» + ControlNet OpenPose (برای تعیین ژست هر فریم انیمیشن).

---

## ۴. استاندارد گرافیک (مهم‌ترین بخش برای کیفیت)

راز گرافیک پیکسلی حرفه‌ای **یکدستی** است. این قوانین را در تمام assetها رعایت کنید و هنگام ساخت تصویر در ComfyUI در prompt تکرارشان کنید.

### ۴.۱ رزولوشن و مقیاس

| تنظیم | مقدار | توضیح |
|---|---|---|
| رزولوشن پایهٔ بازی | **320×180** | در 720p، 1080p، 1440p و 4K دقیقاً مضرب صحیح است (۴، ۶، ۸ و ۱۲ برابر) |
| پنجرهٔ پیش‌فرض | 1280×720 | |
| حالت stretch | `viewport` + `integer` | پیکسل‌ها هیچ‌وقت کشیده یا تار نمی‌شوند |
| فیلتر تکسچر | `Nearest` | در `project.godot` پیش‌فرض است |
| Snap به پیکسل | فعال | جلوی لرزش (jitter) اسپرایت‌ها را می‌گیرد |

### ۴.۲ اندازهٔ assetها

| نوع | اندازه |
|---|---|
| کاراکتر اصلی | 32×32 (بدن حدود 20 تا 24 پیکسل ارتفاع، بقیه فضای انیمیشن) |
| دشمن معمولی | 24×24 تا 32×32 |
| باس | 64×64 یا بزرگ‌تر |
| تایل | **16×16** |
| آیتم و آیکون | 16×16 |
| فونت | فونت پیکسلی با ارتفاع 8 یا 16 پیکسل |

### ۴.۳ پالت رنگ

- یک پالت محدود از [Lospec](https://lospec.com/palette-list) انتخاب کنید (پیشنهاد: **Resurrect 64**، **Endesga 32** یا **Sweetie 16** برای سبک ساده‌تر).
- فایل پالت (`.hex` یا `.gpl`) را در `art_source/palette/` بگذارید.
- همهٔ assetها، حتی خروجی ComfyUI، باید در Aseprite به همین پالت نگاشت شوند.

### ۴.۴ انیمیشن

| انیمیشن | تعداد فریم | سرعت (FPS) |
|---|---|---|
| idle | 4 تا 6 | 6 تا 8 |
| walk / run | 6 تا 8 | 10 تا 12 |
| jump (بالا / اوج / پایین) | 3 تا 6 | 10 |
| attack | 4 تا 6 | 12 تا 15 |
| hurt | 2 تا 3 | 10 |
| death | 6 تا 10 | 8 تا 10 |

- برای بازی **سکوبازی (side-scroller)**: یک جهت کافی است و در Godot با `flip_h` برعکس می‌شود.
- برای بازی **از بالا (top-down)**: ۴ جهت (یا ۸ جهت برای حرکت روان).

### ۴.۵ چرخهٔ تولید کاراکتر

1. **کاراکتر پایه:** Claude prompt می‌نویسد و شما در ChatGPT یا Gemini می‌سازید (جزئیات در [ART_WORKFLOW.fa.md](ART_WORKFLOW.fa.md)).
2. **فریم‌های کلیدی انیمیشن:** ۲ تا ۴ ژست در هر تصویر، همیشه با ضمیمهٔ کاراکتر پایه.
3. **پیکسلی‌سازی با `tools/prepare_sprite.py`:** تبدیل به 32×32 و محدود کردن به پالت پروژه.
4. **Claude با Aseprite MCP:** فریم‌ها را وارد می‌کند (`import_image`)، فریم‌های میانی را می‌سازد، تگ انیمیشن و مدت فریم را تنظیم می‌کند و پالت و outline را یکدست می‌کند.
5. **اصلاح نهایی دستی** در Aseprite:
   - حذف پیکسل‌های تک‌افتاده و نویز
   - نگاشت به پالت پروژه
   - اصلاح outline (یکدست، معمولاً تیره و یک پیکسل)
   - بررسی ثبات حجم بدن بین فریم‌ها (نباید «بلرزد»)
6. **ذخیرهٔ فایل منبع** در `art_source/characters/<name>.aseprite`.
7. **خروجی sprite sheet** با `export_spritesheet` (PNG، یک ردیف برای هر انیمیشن) به `assets/characters/<name>/`.
8. **در Godot:** نود `AnimatedSprite2D` با `SpriteFrames`، یا `Sprite2D` همراه با `AnimationPlayer`.

اصل طلایی: **هیچ خروجی هوش مصنوعی بدون پاک‌سازی دستی وارد بازی نمی‌شود.** همین ده دقیقه اصلاح، فرق «ظاهر AI» با «کار حرفه‌ای» است.

---

## ۵. ساختار پوشه‌ها

```
Digger/
├── project.godot          تنظیمات موتور (پیکسل‌آرت از پیش تنظیم شده)
├── .mcp.json              تنظیم MCPهای پروژه (بدون کلید مخفی)
├── CLAUDE.md              قوانین کار Claude در این پروژه
├── docs/
│   ├── TECHNICAL_GUIDE.fa.md   همین سند
│   └── plans/             پلن‌های Superpowers
├── tools/                 اسکریپت‌های راه‌اندازی (build_aseprite.cmd)
├── scenes/                صحنه‌ها (.tscn)
├── scripts/               اسکریپت‌های GDScript (.gd)
├── assets/                خروجی نهایی که بازی استفاده می‌کند
│   ├── characters/
│   ├── tilesets/
│   ├── props/
│   ├── ui/
│   ├── fx/
│   └── audio/
└── art_source/            فایل‌های منبع: raw/ (خروجی خام AI)، work/ (میانی)، .aseprite، palette/
```

### قراردادهای نام‌گذاری

| مورد | قرارداد | مثال |
|---|---|---|
| فایل و پوشه | `snake_case` | `player_walk.png` |
| نود در صحنه | `PascalCase` | `Player`، `HitBox` |
| کلاس GDScript | `PascalCase` با `class_name` | `class_name Player` |
| متغیر و تابع | `snake_case` | `move_speed`، `take_damage()` |
| ثابت | `UPPER_SNAKE_CASE` | `MAX_HEALTH` |
| سیگنال | فعل گذشته | `died`، `health_changed` |

---

## ۶. نکات فنی Godot برای پیکسل‌آرت

- **حرکت دوربین:** `Camera2D` را روی کاراکتر بگذارید. با snap فعال، لرزش ندارد. اگر حرکت نرم (smoothing) خواستید و لرزش دیدید، موقعیت را به عدد صحیح گرد کنید.
- **سرعت‌ها** را بر حسب پیکسل در ثانیه و متناسب با رزولوشن ۳۲۰ انتخاب کنید (مثلاً راه رفتن ۶۰ تا ۹۰ px/s).
- **فیزیک:** برای کاراکتر `CharacterBody2D` و `move_and_slide()`. برای دنیای کاشی‌کاری‌شده `TileMapLayer` با collision در TileSet.
- **UI:** داخل یک `CanvasLayer`، با فونت پیکسلی و اندازه‌های مضرب ۸.
- **Import:** اگر تصویری تار شد، در تب Import فیلتر را `Nearest` و mipmaps را خاموش کنید.
- **ورودی:** اکشن‌ها را در Input Map تعریف کنید (`move_left`، `jump` و…)، نه کلیدهای مستقیم.

---

## ۷. روش کار در هر سشن (vibe coding)

1. سشن جدید Claude Code را در پوشهٔ `Digger` باز کنید.
2. ویژگی را ساده بگویید، مثلاً: «کاراکتر اصلی که بتواند راه برود و بپرد».
3. Claude باید `brainstorming` را اجرا کند. به سؤال‌هایش جواب دهید.
4. پلن را با `writing-plans` بنویسد و شما تأیید کنید.
5. اجرا با `executing-plans`. Claude با Godot MCP بازی را اجرا و خطاها را بررسی می‌کند.
6. خودتان بازی را تست کنید و بازخورد بدهید.
7. commit کنید. هر ویژگی یک commit یا شاخهٔ جدا داشته باشد.

### نقشهٔ راه پیشنهادی (کوچک شروع کنید)

| مرحله | خروجی |
|---|---|
| ۰ | تصمیم ژانر و هستهٔ بازی (یک جمله: «بازیکن چه کار می‌کند؟») |
| ۱ | انتخاب پالت و یک کاراکتر تست با idle و walk |
| ۲ | حرکت پایه و دوربین در یک صحنهٔ خالی |
| ۳ | یک tileset و یک مرحلهٔ کوچک |
| ۴ | مکانیک اصلی بازی (برای Digger احتمالاً کندن زمین) |
| ۵ | یک دشمن، آسیب و مرگ |
| ۶ | UI (جان، امتیاز) و منوی شروع |
| ۷ | صدا، افکت و polish (screen shake، particle) |

---

## ۸. ریسک‌ها و هزینه‌ها

- **هزینه صفر است.** همهٔ ابزارها رایگان و لوکال‌اند. Aseprite از سورس کامپایل شده؛ برای پخش آن به دیگران لایسنس جدا لازم است، ولی فروش گرافیکی که با آن ساخته‌اید آزاد است.
- **انیمیشن با AI لوکال کار دستی بیشتری می‌خواهد.** هیچ مدل رایگانی چرخهٔ راه رفتن یکدست را با یک دستور نمی‌سازد؛ فریم‌های کلیدی با AI، بقیه با Claude و Aseprite و دست شما.
- **ثبات سبک:** کاراکترهایی که در زمان‌های مختلف ساخته می‌شوند ممکن است ناهماهنگ شوند. از یک prompt پایهٔ ثابت، seed ثابت و یک کاراکتر مرجع استفاده کنید.
- **لایسنس مدل‌ها:** فقط مدل‌ها و LoRAهای با لایسنس تجاری (Apache 2.0 یا OpenRAIL) استفاده کنید. FLUX.1 Kontext dev و FLUX.2 klein 9B ممنوع.
- **حافظهٔ کارت گرافیک (10GB):** فقط نسخه‌های fp8 یا GGUF مدل‌ها؛ موقع ساخت تصویر، Godot و برنامه‌های سنگین دیگر را ببندید.
