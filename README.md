# Aegis

"A day at Aegis": trang tiếng Anh cho một khách sạn núi (hư cấu), kể như một ngày từ chiều tới sáng hôm sau khi cuộn.
HTML/CSS/JS thuần, không cần build. Thiết kế theo quy trình của
[uiux-ai-workspace](https://github.com/Ngh1aa/uiux-ai-workspace). Ảnh: Bybbisch94, Wikimedia Commons, CC BY 4.0.

## Xem

Mở `index.html`, hoặc chạy server tĩnh: `npx serve .`

## Cấu trúc

| Đường dẫn | Là gì |
|---|---|
| `index.html` | Hero, 7 chặng theo giờ (Arrival, The hall, Your room, The bar, The library, Morning, The terrace), Plan your stay |
| `legal.html` | Privacy policy, booking terms và credit từng ảnh |
| `css/tokens.css`, `css/components.css` | Token và component từ design system của uiux-ai-workspace |
| `css/brand.css` | Lớp thương hiệu Aegis (sáng và tối) |
| `css/aegis.css` | Bố cục, khung vòm, khu đặt chỗ, chuyển động |
| `js/aegis.js` | Sân khấu cuộn, thanh thời gian, đặt phòng, menu (giá và còn/hết phòng là mô phỏng) |
| `tests/flow.test.cjs` | Kiểm luồng bằng Playwright |
| `docs/DESIGN-NOTES.md` | Brand brief, kế hoạch thị giác, trạng thái, kết quả soát, nguồn ảnh |

## Kiểm

```sh
# cần Playwright: npm i -D playwright && npx playwright install chromium
node tests/flow.test.cjs
```

Giá, phòng và giờ mở cửa là dữ liệu mẫu; đặt phòng chỉ mô phỏng, chưa có booking engine.
