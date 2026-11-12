# Aegis

Landing page tiếng Anh cho Aegis Hospitality, một tập đoàn (giả định) gồm 3 khách sạn và 3 nhà hàng ở Hội An,
Đà Nẵng và Huế. HTML/CSS/JS thuần, không cần build. Thiết kế theo quy trình của
[uiux-ai-workspace](https://github.com/Ngh1aa/uiux-ai-workspace), lấy cấu trúc trang tập đoàn từ somossade.com.

## Xem

Mở `index.html`, hoặc chạy server tĩnh: `npx serve .`

## Cấu trúc

| Đường dẫn | Là gì |
|---|---|
| `index.html` | Hero, tuyên ngôn, Stay (3 khách sạn), Eat and drink (3 nhà hàng), Book (đặt phòng, đặt bàn), nhận tin |
| `legal.html` | Privacy policy và booking terms |
| `css/tokens.css`, `css/components.css` | Token và component từ design system của uiux-ai-workspace |
| `css/brand.css` | Lớp thương hiệu Aegis (sáng và tối) |
| `css/aegis.css` | Bố cục, khung vòm, khu đặt chỗ, chuyển động |
| `js/aegis.js` | Đặt phòng, đặt bàn, nhận tin, menu, chuyển động (dữ liệu và còn/hết phòng là mô phỏng) |
| `tests/flow.test.cjs` | Kiểm luồng bằng Playwright |
| `docs/DESIGN-NOTES.md` | Brand brief, kế hoạch thị giác, trạng thái, kết quả soát, nguồn ảnh |

## Kiểm

```sh
# cần Playwright: npm i -D playwright && npx playwright install chromium
node tests/flow.test.cjs
```

Giá, phòng, giờ mở cửa và số điện thoại là dữ liệu mẫu; đặt chỗ chỉ mô phỏng, chưa có booking engine.
