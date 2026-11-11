# راهنمای راه‌اندازی workflow گرافیک

ساخت گرافیک پیکسلی بازی با ChatGPT یا Gemini، و پردازش و ورود به بازی توسط Claude Code.

---

## ۱. ایدهٔ کلی

```
Claude (رهبر)
  ├─ تصمیم می‌گیرد چه asset لازم است و prompt انگلیسی می‌نویسد
  │
شما
  ├─ prompt را در ChatGPT یا Gemini اجرا می‌کنید
  └─ تصویر خام را در art_source/raw/ ذخیره می‌کنید
  │
Claude
  ├─ tools/prepare_sprite.py ── حذف پس‌زمینه، جدا کردن فریم، تبدیل به 32×32، محدود کردن پالت
  ├─ Aseprite (MCP) ── فریم‌ها، تگ انیمیشن، پاک‌سازی، خروجی sprite sheet
  └─ Godot (MCP) ── گذاشتن در بازی و تست
  │
شما
  └─ اصلاح هنری نهایی (در صورت نیاز)
```

Claude دستورالعمل این کار را از skill پروژه می‌خواند:
`.claude/skills/making-pixel-art-assets/` (فایل `SKILL.md` برای مراحل، `prompts.md` برای قالب promptها).

---

## ۲. پیش‌نیازها

| ابزار | وضعیت روی این سیستم | کاربرد |
|---|---|---|
| حساب ChatGPT یا Gemini | نسخهٔ رایگان کافی است | ساخت تصویر خام |
| Python 3.12 + Pillow + numpy | نصب است | اجرای `tools/prepare_sprite.py` |
| Aseprite (کامپایل‌شده از سورس) | `D:\tools\aseprite\build\bin\aseprite.exe` | ویرایش و انیمیشن |
| pixel-mcp 0.5.0 | `D:\tools\pixel-mcp\pixel-mcp.exe` | اتصال Claude به Aseprite |
| Godot 4.7 + godot-mcp | نصب است | اجرای بازی و تست |

### نصب روی سیستم جدید

1. **Python:** از [python.org](https://www.python.org/downloads/) نصب کنید، بعد:
   ```bash
   pip install pillow numpy
   ```
2. **Aseprite و pixel-mcp:** طبق بخش ۳.۳ [راهنمای فنی](TECHNICAL_GUIDE.fa.md). خلاصه:
   - Visual Studio 2022 Build Tools (بخش C++)، CMake و Ninja را نصب کنید.
   - سورس Aseprite را در `D:\tools\aseprite` و Skia آماده را در `D:\tools\skia` بگذارید.
   - `tools\build_aseprite.cmd` را اجرا کنید.
   - فایل اجرایی pixel-mcp را از [صفحهٔ releases](https://github.com/willibrandon/pixel-mcp/releases) در `D:\tools\pixel-mcp` بگذارید.
   - فایل `%USERPROFILE%\.config\pixel-mcp\config.json` را با مسیر `aseprite.exe` بسازید.
3. **Godot و godot-mcp:**
   ```bash
   winget install GodotEngine.GodotEngine
   ```
   ```bash
   npm install -g @coding-solo/godot-mcp
   ```
4. اپ Claude را ری‌استارت کنید و تأیید MCPهای پروژه را قبول کنید.

### بررسی سلامت

```bash
python tools/test_prepare_sprite.py
```
باید `ALL OK` چاپ کند.

```bash
D:\tools\pixel-mcp\pixel-mcp.exe --health
```

---

## ۳. ساختار پوشه‌ها

| پوشه | محتوا | در git |
|---|---|---|
| `art_source/raw/` | تصویرهای خام ChatGPT یا Gemini | بله |
| `art_source/work/` | خروجی میانی `prepare_sprite.py` | بله |
| `art_source/characters/` و… | فایل‌های منبع `.aseprite` | بله |
| `art_source/palette/` | پالت پروژه (`.hex`، یک رنگ در هر خط) | بله |
| `assets/` | فقط sprite sheetهای نهایی که بازی استفاده می‌کند | بله |

نام‌گذاری فایل خام: `<asset>_<animation>_raw.png`، مثلاً `miner_walk_raw.png`.

---

## ۴. استفادهٔ روزمره

**درخواست asset جدید.** به Claude بگویید، مثلاً: «برای کاراکتر اصلی انیمیشن راه رفتن لازم داریم». Claude سه چیز به شما می‌دهد:
- prompt انگلیسی
- نام دقیق فایل برای ذخیره
- اینکه کدام تصویر مرجع را ضمیمه کنید

**ساخت تصویر.** prompt را در ChatGPT یا Gemini بزنید. اگر Claude گفته، تصویر مرجع را هم ضمیمه کنید. خروجی را با همان نام در `art_source/raw/` ذخیره کنید.

**آماده‌سازی.** بگویید: «آماده‌اش کن». Claude تصویر را بررسی می‌کند. اگر ایراد داشت (پس‌زمینهٔ اشتباه، تعداد فریم غلط، تغییر کاراکتر بین فریم‌ها)، دوباره ساختنش را می‌خواهد. وگرنه پردازش، انیمیشن و تست در بازی را انجام می‌دهد.

**اصلاح نهایی.** اگر Claude گفت جایی نیاز به دست هنرمند دارد، فایل `.aseprite` را در Aseprite باز کنید و اصلاح کنید.

---

## ۵. قواعدی که کیفیت را حفظ می‌کنند

- **پس‌زمینه همیشه بنفش (#FF00FF).** حذف دقیق آن ممکن است. ChatGPT گاهی پس‌زمینهٔ شفاف می‌دهد که آن هم مشکلی ندارد.
- **کاراکتر پایه را یک بار تأیید کنید** و در هر درخواست بعدی همان را ضمیمه کنید.
- **در هر تصویر فقط ۲ تا ۴ فریم.** هوش مصنوعی در شیت‌های بلند، کاراکتر را تغییر می‌دهد.
- **بخش سبک (style block) prompt را عوض نکنید.** یکدستی گرافیک از تکرار همین متن می‌آید.
- **پالت را زود انتخاب کنید** (بخش ۴.۳ راهنمای فنی) و فایلش را در `art_source/palette/` بگذارید. از آن به بعد همهٔ assetها دقیقاً به همان رنگ‌ها نگاشت می‌شوند.

---

## ۶. محدودیت‌ها

- ChatGPT و Gemini پیکسل‌آرت واقعی نمی‌سازند. تبدیل به 32×32 همیشه کمی ریزه‌کاری را از بین می‌برد.
- انیمیشن یکدست سخت‌ترین بخش است و اغلب به اصلاح دستی نیاز دارد.
- نسخهٔ رایگان هر دو، تعداد تصویر روزانه را محدود می‌کند.
- واترمارک دیده‌شدهٔ Gemini معمولاً بعد از کوچک کردن از بین می‌رود. واترمارک نامرئی (SynthID) می‌ماند.
- **قبل از انتشار تجاری،** شرایط استفادهٔ OpenAI یا Google را دوباره بررسی کنید.
- ComfyUI لوکال (بخش ۳.۴ راهنمای فنی) فعلاً کنار گذاشته شده است. اگر روزی کار کاملاً خودکار خواستید، دوباره قابل فعال شدن است.
