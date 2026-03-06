# CMS Filter Search Input: IME-Safe Query Trigger Solution

Structured design for search/filter inputs that trigger API queries, with proper IME (Pinyin, Japanese, Korean) support.

## Problem

- **onChange** fires on every keystroke, including during IME composition (e.g. typing Pinyin letters before selecting the final Chinese character).
- Triggering API on each Pinyin letter causes unnecessary requests and wrong results.
- **keydown/keyup** have the same issue: they fire during IME composition.
- When desktop and mobile each have a separate Input but share one ref, reading from the wrong input causes keyword to disappear (e.g. typing "sa" then "l" clears the URL keyword).

## Solution Options (Industry Practices)

### Option 1: Search button + Enter

- No onChange-triggered API.
- Trigger search only on Enter (check `!event.nativeEvent.isComposing`) or Search button click.
- Pros: No IME issues.
- Cons: No instant search as you type.

### Option 2: Debounced onChange + composition events (Recommended)

- Use `onCompositionStart` / `onCompositionEnd` to detect IME composition.
- In `onChange`: skip triggering search when `isComposing` is true.
- In `onCompositionEnd`: trigger search with the finalized value.
- Pros: Instant search, Pinyin works correctly.
- Cons: In some IME setups, single-letter English input can trigger composition without compositionend; the dual-ref fix helps ensure we read from the correct input.

## Implementation (Option 2)

### 1. Separate refs for desktop and mobile

When both desktop and mobile Inputs exist in the DOM (one hidden), **do not share a single ref**. React refs attach to the last element; reading from the wrong input causes wrong/empty keyword.

```tsx
const searchInputDesktopRef = useRef<InputRef>(null);
const searchInputMobileRef = useRef<InputRef>(null);
```

### 2. Read from the correct input

```tsx
const getSearchInputValue = useCallback(() => {
  const el = isMobile ? searchInputMobileRef.current : searchInputDesktopRef.current;
  return (el?.input?.value || '').trim();
}, [isMobile]);
```

### 3. Debounced search

```tsx
const debouncedSearch = React.useMemo(
  () => debounceUtil.debounceWithCancel((keyword: string) => {
    if (keyword.length >= 2) updateFilters({ keyword });
    else if (keyword.length === 0) updateFilters({ keyword: undefined });
  }, 1000),
  [updateFilters]
);
```

### 4. onChange: skip during composition

```tsx
const isComposingRef = useRef(false);

const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  if (isComposingRef.current) return;
  const keyword = (e.target.value || '').trim();
  debouncedSearch.execute(keyword);
}, [debouncedSearch]);
```

### 5. compositionend: trigger search with final value

```tsx
const handleCompositionEnd = useCallback(() => {
  isComposingRef.current = false;
  const keyword = getSearchInputValue();  // use correct ref
  debouncedSearch.execute(keyword);
}, [debouncedSearch, getSearchInputValue]);
```

### 6. Input bindings

```tsx
<Input
  ref={searchInputDesktopRef}  // or searchInputMobileRef for mobile
  onChange={handleSearchChange}
  onCompositionStart={() => { isComposingRef.current = true; }}
  onCompositionEnd={handleCompositionEnd}
  allowClear
/>
```

### 7. Reset and sync

- **Reset filters**: clear both inputs via `searchInputDesktopRef` and `searchInputMobileRef`.
- **Sync from URL**: when `filters.keyword` is set from URL, call `setSearchInputValue(filters.keyword)` to populate the visible input.

## Reference Implementation

- `xituan_cms/src/components/products/ProductList.tsx` (product name search in filter bar)
