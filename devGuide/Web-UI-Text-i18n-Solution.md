# Web UI Text i18n Solution (next-intl)

Canonical solution for hardcoded UI text internationalization in Next.js web apps: CMS, Platform, Site.

---

## 1. Scope

| Project | Library | Status |
|---------|---------|--------|
| **xituan_cms** | next-intl | Implemented |
| **xituan_platform** | next-intl | To be added (currently no i18n) |
| **xituan_site** | next-intl | Implemented |
| **xituan_wechat_app** | N/A | WeChat mini program; uses custom languageUtil for API multilingual content only; UI text is hardcoded |

---

## 2. Tech stack

| Item | Choice |
|------|--------|
| **Library** | next-intl |
| **Format** | Nested JSON preset objects |
| **Access** | Path binding via `useTranslations('namespace')` and `t('key')` |

---

## 3. Structure

### 3.1 File layout

```
messages/
├── zh_cn.json
├── en.json
├── zh.json
└── zh_tw.json
```

### 3.2 JSON structure (nested preset)

```json
{
  "common": {
    "save": "保存",
    "cancel": "取消",
    "loading": "加载中..."
  },
  "order": {
    "status": { "pending": "待处理", "processing": "处理中" },
    "labels": { "orderNumber": "订单号" }
  }
}
```

Path `order.status.pending` corresponds to `t('status.pending')` when using `useTranslations('order')`.

---

## 4. Load and display flow

```
Request → middleware determines locale
    ↓
Page getServerSideProps (or getRequestConfig in i18n.ts)
    ↓
import(`messages/${locale}.json`)  // load full messages for locale
    ↓
return { props: { messages, locale } }
    ↓
_app receives pageProps
    ↓
<NextIntlClientProvider messages={messages} locale={locale}>
    ↓
Child: useTranslations('common') → t('save') → reads messages.common.save
```

### 4.1 i18n.ts (for next-intl plugin)

```typescript
// i18n.ts - used by createNextIntlPlugin('./i18n.ts')
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'zh', 'zh_cn', 'zh_tw'] as const;

export default getRequestConfig(async ({ locale }) => {
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

### 4.2 next.config

```javascript
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n.ts');
export default withNextIntl(nextConfig);
```

### 4.3 Page getServerSideProps (Pages Router)

Pages that need i18n pass `messages` and `locale` via `getServerSideProps`:

```typescript
export async function getServerSideProps({ locale }) {
  const currentLocale = locale || 'zh_cn';
  return {
    props: {
      messages: (await import(`../../messages/${currentLocale}.json`)).default,
      locale: currentLocale,
    },
  };
}
```

### 4.4 Usage in components

```tsx
import { useTranslations } from 'next-intl';

const t = useTranslations('common');
t('save');  // "保存"
t('cancel'); // "取消"
```

---

## 5. Namespace split and lazy loading

### 5.1 Default: single file per locale

- One `messages/{locale}.json` per language.
- Full file loaded per page request.
- Suitable when messages &lt; ~50KB.

### 5.2 Optional: split by namespace (when messages grow)

When messages exceed ~50KB or hundreds of keys, consider splitting:

```
messages/
├── zh_cn/
│   ├── common.json
│   ├── order.json
│   ├── product.json
│   └── ...
├── en/
│   └── ...
```

Load only required namespaces per page:

```typescript
// i18n.ts or page getServerSideProps
const messages = {
  common: (await import(`./messages/${locale}/common.json`)).default,
  order: (await import(`./messages/${locale}/order.json`)).default,
};
```

### 5.3 When to split

| Messages size | Action |
|---------------|--------|
| &lt; 50KB, &lt; 500 keys | Keep single file |
| 50KB–200KB | Consider namespace split |
| &gt; 200KB | Split and lazy load per route |

---

## 6. Locales

- Supported: `en`, `zh`, `zh_cn`, `zh_tw`.
- Default: `en` (configurable in middleware).
- `localePrefix: 'as-needed'` — default locale has no URL prefix.

---

## 7. References

- next-intl docs: https://next-intl.dev/
- Multilingual-FormData-Validation-System.md — API/entity multilingual content (iMultilingualContent), distinct from UI text.
- multilingual-preset-content.md — Alternative build-time multilang generation; not the current chosen approach for web UI text.
