# Findter codebase context

> Generated for PM / BA reference. Repo: `search-n-filter` (Shopify app **Findter Filter & Search**).  
> Mockup UI (no OAuth): `http://127.0.0.1:5500/index.html` → `Documents/Findter/findter-mockup/`  
> Date: 2026-10-07

---

## 1. Product purpose

**Findter** thay native Shopify search/filter bằng:

1. Index catalog Shopify → **OpenSearch** (mỗi shop một index)
2. Merchant cấu hình filter / search / boost / sort / design trong **embedded admin**
3. Storefront (theme app extension) gọi API Findter → facets + products + suggestions
4. Analytics funnel search → click → ATC → purchase (service analytics riêng)
5. Billing / feature gates / dedicated OpenSearch nodes cho shop nặng

**Không phải:** storefront theme builder, GA, hay CRM đầy đủ — chỉ search/filter merchandising + telemetry liên quan.

---

## 2. Monorepo map

| Path | Role |
|------|------|
| `backend/` | Express API, indexer, cron, Prisma, Shopify OAuth |
| `backend/frontend/` | React admin (Polaris / App Bridge), file-based routes |
| `backend/prisma/` | MariaDB schema |
| `extensions/web-pixel/` | Findter Analytics pixel (Customer Events → track API) |
| `extensions/collection-sorting-action/`, `product-action/` | Admin UI extensions |
| `dev-extensions/search-result/` | Theme extension assets (filters, search, Liquid) |
| `docs/design/` | dedicated-server, webhook-burst-mode |
| `build-for-shopify.md` | BFS App Store UI rules (bắt buộc admin UI trừ `master/*`) |

**Stack:** Express + Shopify App Express · OpenSearch 2.x · MariaDB/Prisma · React/Vite/Polaris · Docker/`findter` container · API Shopify ~2025–2026.

**Local URLs (denv):** app `https://search-n-filter.test` · Adminer · GraphiQL · Prisma Studio.

**Roles:** `NODE_ROLE=control` (default: OAuth/admin/webhooks) vs `dedicated` (search+index local trên OS node).

---

## 3. End-to-end data flows

```
Shopify webhooks → BulkHandler (quick | queue) → ProductIndexer → OpenSearch
Admin config write → clearShopCaches(CACHE_NS…) → [dedicated sync]
Storefront → /proxy/search|/collection|/suggestion (hoặc dedicated /search…)
         → ProductSearch.loadContext → RequestBuilder → OpenSearch → theme
Theme publish Customer Events → Web Pixel → ANALYTICS_ENDPOINT/analytic/findter/track
Admin Analytics UI → HMAC proxy → INTERNAL_ANALYTICS_ENDPOINT
```

---

## 4. Tracking & events (chi tiết)

Không có GA/gtag trong repo. Có **nhiều đường tracking tách biệt**:

### 4.1 Storefront product analytics (funnel)

**Mục đích:** đo search/filter → click → ATC → purchase cho UI Analytics merchant.

| Bước | Chi tiết |
|------|----------|
| Emit | Theme: `Shopify.analytics.publish('findter:*', …)` trong `dev-extensions/search-result/assets/` |
| Consume | `extensions/web-pixel/src/index.js` subscribe custom + standard events |
| Persist | POST `{ANALYTICS_ENDPOINT}/analytic/findter/track` — **service ngoài repo** |
| Admin read | Proxy HMAC `/api/internal-analytic/*` → charts/export |

**Custom Customer Events**

| Event | Payload chính | Emit |
|-------|---------------|------|
| `findter:searched` | `searchTerm`, `totalResults`, `combination` | `fdt-search-filters.js` |
| `findter:collection_view` | `collection_id`, `totalResults`, `combination` | same |
| `findter:filtered` | `filterOption`, `filterValue`, `combination` | `fdt-filter-option-item.js`, `fdt-slider.js` |
| `findter:submitted` | `{}` | `fdt-filter-tree.js` |
| `findter:error` | `code`, `message`, `url` | liquid / compatible JS |

**Standard events (pixel subscribe):** `product_viewed`, `product_added_to_cart`, `checkout_completed`.

**Pixel POST `type`:** `session` (default), `filterEvents`, `productClicks`, `addToCarts`, `error`.

**Session shape** (`backend/src/interfaces/api/analytics.interface.ts`):  
`InteractionSession` → `searchEvents[]` → nested `filterEvents` / `productClicks` / `addToCarts` + `purchases[]` / `totalRevenue`.

Local: `localStorage.findter_tracking`, cookie `findter_tracking_identifier` (~30 phút).

Scopes: `read_customer_events`, `write_pixels`.

### 4.2 `shop_event` — CRM / lifecycle (EventTracker)

**Mục đích:** log install/billing/trial cho CRM ngoài + master UI. **Không** phải funnel storefront.

Enum: `backend/src/interfaces/event.interface.ts` → bảng `shop_event`.

| Value | Ý nghĩa |
|-------|---------|
| `Installed` / `Uninstalled` / `Reinstalled` | App lifecycle |
| `Inactived` | Sweep inactive |
| `Trial_start` / `Trial_3days` / `Trial_end` | Trial |
| `Charge_*` | One-time charge |
| `Subscription Charge_*` | Recurring (Accepted/Activated/Declined/Expired/Cancelled/Frozen/Unfrozen) |
| `Sub_Upgrade_Free` | free → paid |
| `Sub_Upgrade_Paid` | paid → higher |
| `Sub_Downgrade_Free` | paid → free |
| `Sub_Downgrade_Paid` | paid → lower paid |

API: `GET /private-api/event`, `GET /api/master/statistic/event`.

### 4.3 `banner_event` — UI telemetry banner

**Mục đích:** engagement banner trong admin. CRM không consume.

Enum: `view_banner`, `clicking_content`, `click_contact`, `click_pricing`, `collapse`, `expand`.

API: `POST /api/banner/track`. Hook: `useBannerTracking.js`.

`bannerId` thường gặp: `real-time`, `sync-in-progress`, `pricing-shrinking`, `pricing-new-customer-limit`, `limit-over`, `limit-approaching`.

Dismiss bền vững: `config_data` prefix `banner_state:` (không phải event).

### 4.4 Recommend-app clicks

Bảng `recommend_app_tracking` `{ shop, path, clicks }`.  
API `POST /api/recommend-app/tracking` từ homepage slider.

### 4.5 CRM fleet snapshot

Bảng `crm` — title, email, Shopify plan, product count, Findter plan…  
Cron: `Statistic.trackNewCrmShops` / `trackShops`. Không phải conversion events.

### 4.6 Admin activity → inactive

`touchAdminActivity` trên session admin → `config.last_admin_activity` → sweep `Inactived` (+ active shops từ analytics service + theme embed).

### 4.7 Crisp

Support chat + webhook `message:send` → AI support agent. **Không** phải product analytics.

### 4.8 Downgrade survey

`POST /api/billing/downgrade-survey` → `subscription_downgrade_survey` `{ reasons, satisfaction, futureReasons, feedback }`.

### 4.9 Không phải analytics

DOM events kiểu `findter-products-render`, `findter-filters-render` = bus UI nội bộ theme.  
App Bridge = shell/session; Shopify tự đo Web Vitals — không có custom event API trong app.

### 4.10 Env

| Var | Role |
|-----|------|
| `ANALYTICS_ENDPOINT` | Pixel track URL |
| `INTERNAL_ANALYTICS_ENDPOINT` | Admin/server proxy |
| `INTERNAL_SECRET` | HMAC |
| `CRISP_WEBSITE_ID` | Chat |

---

## 5. Core domains — logic & purpose

### 5.1 Search pipeline

**Purpose:** request storefront → OpenSearch DSL → products + facets.

1. Routes: `/proxy/search`, `/proxy/collection/:id`, `/proxy/suggestion` (+ bare paths trên dedicated)
2. `ProductSearch` (`services/search/product.ts`) → `loadContext` / `SearchSettings.getFullConfig`
3. `RequestBuilder` → text match, prefilters, `function_score` rules, pin tier (`PIN_STEP=1e10`), aggregations
4. Response shaping: locale overlays, features, buckets

**Gates:** `TRANSLATION`, `SPF_SORTING`, `VARIANT_FILTER`, `MARKET_PUBLISH`, `SYNONYM_SEARCH`, …  
**Edge:** index missing → force full reindex; synonym giữ term gốc cho booster; locale translation display-only.

### 5.2 Filter trees / YMM / prefilter / metafield

| Concern | Purpose |
|---------|---------|
| FilterTree | Facet UI + mapping field OpenSearch per search/collection |
| YMM | Cascading Year/Make/Model; sync metafield shop khi active |
| Prefilter | Always-on `must` filters (có `disable_rules`) |
| indexable_metafield | Metafield nào được index / filter / sort |

**Rule quan trọng:** storefront metafield config — `null` (shop cũ) và schema **default** phải cùng logic render (parity).

### 5.3 Boosters / pin / sort

- Search boosters (theo term) vs collection boosters  
- Rules nhân score; **pin** tầng điểm riêng (luôn trên)  
- Sort: built-in + custom (`CUSTOM_SORT`) + SPF collection order (`SPF_SORTING`) + `sort_fallback`

### 5.4 Indexer / bulk / webhooks

**Purpose:** sync catalog → OpenSearch dưới rate limit.

```
Webhook → quick ProductIndexer OR indexer_queue
Cron → triggerIndexing / stuck recovery
bulk_operations/finish → bulkExecute → cascade type tiếp theo
```

**INDEXER_STATUS:** `0 PENDING`, `1 PROCESSING`, `2 ERROR`, `3 INVALIDATE`, `4 RESETTING`, `90 DEBUG`, `99 COMPLETED`

**IndexerType:** `full`, `product`, `product_delta`, `collection`, `collection_sort`, `collection_big_sort`, `delete`, `translation`, `rebuild`

**Heuristics:** nhiều collection → FULL; >50 products → PRODUCT_DELTA; flags `WAITING_INDEX` / `INACTIVE` / `MOVE_DRAINING` / `BURST_MODE` chặn hoặc đổi hành vi.

Dedicated shops: control dùng `ForwardingBulkHandler` — node sở hữu queue/status.

### 5.5 Design / theme / extensions

- Design metafields: layout, filter custom CSS/JSON, product grid  
- Theme compatibility map  
- Web pixel install/settings  
- Dedicated: metafield `findter/search_url` → `window.fdtEndpoint`  
- Giữ `/proxy/*` cho storefront cũ

### 5.6 Features / billing / limits

- `FeaturePermission` + `FeatureLimit` + defaults/LOCKED  
- Subscription webhook → `syncPermissionsForBilling`  
- Pricing theo product count + add-ons + soft-launch cohorts  
- Server placement reconcile theo plan (trừ FROZEN)

### 5.7 Dedicated servers

Xem `docs/design/dedicated-server.md`.

- **control:** OAuth, admin, webhook, sync/forward  
- **dedicated:** MariaDB replica local, serve search, drain indexer, `/internal/*`  
- Sync theo **part** (`CACHE_NS` / `SYNC_NS`), không sync indexer tables từ control

### 5.8 Config cache (`CACHE_NS`)

Không TTL. Writer **phải** `clearShopCaches(shop, namespaces[])` — đụng 2 part thì clear cả 2.

| NS | Nội dung |
|----|----------|
| `field_config` | SearchSettings + fields từ metafield |
| `prefilter` | Always-on filters |
| `feature` | Permissions + limits |
| `market` / `locale` | Markets / locales |
| `sort_option` / `sort_fallback` | Sort |
| `metafield` | Indexable metafields |
| `booster` | Search + collection boosters |
| `filter_tree` | Trees + YMM (có thể lớn) |
| `filter_translation` | Bản dịch option |
| `synonym` | Synonyms (nếu feature on) |

`SYNC_NS`: `session`, `shop_config` — chỉ push dedicated, không cache search.

Flags tần suất cao (`BURST_MODE`, banner dismiss): `setConfigUncached` — tránh stampede clear cache toàn fleet.

Memory: production ~8GB; nhiều cache per-shop — theo dõi `memory-stats.log`.

---

## 6. Admin frontend map (khớp mockup nav)

| Route | Mục đích |
|-------|----------|
| `/` | Home, onboarding, sync status |
| `/filter`, `/filter/set/*` | Filter sets |
| `/filter/boost*` | Collection boosters |
| `/search`, `/search/boost*`, markets, locales, synonym | Search settings |
| `/metafield` | Indexable metafields |
| `/sort` | Custom sort |
| `/ymm*` | Year Make Model |
| `/design`, `/design/product-grid` | Layout / grid |
| `/features` | Advanced features |
| `/analytics`, `/analytics/filter-analytics` | Analytics dashboards |
| `/pricing` | Plans / billing |
| `/master/*` | Internal devops (BFS-exempt) |

Routing: `pages/**` → `Routes.jsx`. Data: `useAuthenticatedFetch` / `useAppQuery` / `useFeatures`.

---

## 7. Prisma domain entities (tóm tắt)

`FilterTree*` · `ymm*` · `SearchSettings` · `BoosterSearch` / `BoosterCollection` · `Prefilter` · `indexable_metafield` · `sort_config` / `sort_fallback` · `synonym` · `FeaturePermission` / `FeatureLimit` · `indexer_status` / `indexer_queue` · `server_info` · `session` · `shop_event` · `banner_event` · `crm` · `recommend_app_tracking` · subscription/billing tables · `pubsub` · dedicated queues.

---

## 8. Working rules (khi đụng code)

1. Default git base: `master`; integrate `develop` qua branch `develop-{name}`  
2. TS imports: absolute aliases (`@services/*`…), không relative  
3. Helpers từ model: `import * as X from '…'`  
4. Packages: `docker exec findter yarn add …`  
5. Admin UI: BFS (`build-for-shopify.md`) — trừ `pages/master/*`  
6. Prefer Polaris **web components** (`s-*`) khi có  
7. Metafield null ≡ default trên storefront  
8. Cache write: clear đúng mọi `CACHE_NS` bị đụng  

---

## 9. Mockup vs app thật

| | Mockup (`:5500`) | App repo |
|--|------------------|----------|
| Mục đích | Visualize admin UI / flow / copy | Runtime + API + indexing |
| Auth | Không | Shopify OAuth + session |
| Data | Static HTML | DB + OpenSearch + analytics service |
| Tracking | Không chạy thật | Pixel + shop_event + banner_event… |

Dùng mockup để review UX; dùng file này để hiểu **logic & event thật** trong codebase.

---

## 10. Key file index

```
backend/src/index.ts                          # boot
backend/src/controllers/search.ts             # storefront search API
backend/src/services/search/product.ts        # ProductSearch
backend/src/services/search/product/request.builder.ts
backend/src/services/bulkHandler.ts           # indexer orchestration
backend/src/utils/product.webhook.ts
backend/src/interfaces/indexer.interface.ts
backend/src/interfaces/event.interface.ts     # SHOP_EVENT
backend/src/interfaces/banner.event.interface.ts
backend/src/interfaces/api/analytics.interface.ts
backend/src/services/event.ts                 # EventTracker
backend/src/services/banner.event.ts
backend/src/services/analytics/adapter.ts
backend/src/services/webPixel/setting.ts
backend/src/models/app/config.ts              # CACHE_NS, flags
backend/src/cron/index.ts
extensions/web-pixel/src/index.js
dev-extensions/search-result/assets/fdt-*.js
docs/design/dedicated-server.md
docs/design/webhook-burst-mode.md
build-for-shopify.md
CLAUDE.md
```

**Gap cố ý:** persistence `/analytic/findter/track` và aggregation charts nằm ở **analytics service** riêng (`search-n-filter-analytics`), không trong monorepo này.
