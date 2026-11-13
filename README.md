# Aegis

Website tiếng Anh cho một khách sạn núi hư cấu (concept product). Trang chủ kể "A day at Aegis" như một ngày từ chiều tới
sáng hôm sau khi cuộn; các trang trong hoạt động như website khách sạn thật, chỉ thiếu backend.
HTML/CSS/JS thuần, không cần build. Thiết kế theo quy trình của
[uiux-ai-workspace](https://github.com/Ngh1aa/uiux-ai-workspace). Ảnh: Bybbisch94, Wikimedia Commons, CC BY 4.0.

## Xem

Bản chạy: https://ngh1aa.github.io/Aegis/ (link nên đặt trên portfolio; là trang chủ, không cần đăng nhập). My stay có
sẵn booking `AEG-48213` · `Hoffmann`, gợi ý ngay trên form tra cứu.

Công cụ demo (Reset demo data, Simulate a failed request) bị ẩn với khách thường; mở bằng `?demo=1`, ví dụ
https://ngh1aa.github.io/Aegis/?demo=1 (giữ cho cả tab; `?demo=0` để tắt).

Chạy server tĩnh rồi mở `index.html`: `py -3 -m http.server 8000` hoặc `npx serve .`
(dữ liệu giữa các trang được kiểm trên origin http; `file://` chưa kiểm).

## Trang và luồng

| Trang | Là gì |
|---|---|
| `index.html` | Hero, 7 chặng theo giờ, "Plan your stay": chọn phòng, ngày, khách rồi **Check availability** chuyển sang `book.html` kèm giá trị |
| `rooms.html` | 6 loại phòng, lọc theo khách, hướng nhìn, giá; bộ lọc nằm trên URL nên Back giữ được |
| `room.html?id=…` | Ảnh, diện tích, giường, tiện nghi, giá một đêm, **Book this room**; id sai thì hiện trạng thái không tìm thấy |
| `book.html` | 5 bước: ngày (lịch, khoá ngày đã qua và đêm kín phòng) và khách, phòng (giá theo số đêm), extras, thông tin khách (kiểm tra ngay khi nhập), review, xác nhận có mã `AEG-xxxxx` |
| `stay.html` | My stay: tra theo mã và họ; xem, đổi ngày (tính lại tổng), huỷ (hộp xác nhận, phí nếu dưới 72 giờ); liệt kê bàn ăn và spa đã đặt |
| `dining.html` | Giờ mở, thực đơn theo tab, đặt bàn: ngày, giờ (có giờ đã kín), số người, mã `TBL-xxxxx` |
| `spa.html` | Liệu trình và trải nghiệm, chọn ngày và giờ trống, thêm vào kỳ nghỉ, mã `SPA-xxxxx` |
| `contact.html` | Địa chỉ, điện thoại, cách đến, form nhắn tin |
| `legal.html` | Privacy policy, booking terms, credit từng ảnh |

Footer mọi trang có một dòng "Concept product designed by Đỗ Anh Nghĩa." và link credit ảnh. **Reset demo data** (có
hộp xác nhận) nằm trong bảng Demo tools (`?demo=1`).

## Quy tắc dữ liệu

- Không có server. Mọi dữ liệu người dùng (đặt phòng, bàn, spa, bản nháp đặt phòng, booking đang mở) nằm trong
  **sessionStorage** khoá `aegis-demo-v1`: còn khi chuyển trang trong cùng tab, mất khi đóng tab hoặc bấm Reset.
  Store rỗng bắt đầu với một booking sắp tới (`seedBooking` trong `js/data.js`).
- Dữ liệu mẫu (phòng, extras, thực đơn, liệu trình, đêm kín phòng) nằm duy nhất ở `js/data.js`.
- Gửi đi chỉ mô phỏng (chờ 900 ms; mất mạng hoặc bật "Simulate a failed request" thì báo lỗi và giữ dữ liệu). Màn xác
  nhận viết như sản phẩm thật (mã đặt chỗ, "We’ve emailed the details to …"); không có backend hay email thật. Không có
  ô số thẻ; thanh toán là "pay at the hotel".

## Cấu trúc

| Đường dẫn | Là gì |
|---|---|
| `css/tokens.css`, `css/components.css` | Token và component từ design system của uiux-ai-workspace |
| `css/brand.css` | Lớp thương hiệu Aegis (sáng và tối) |
| `css/aegis.css` | Trang chủ, header, footer, khu đặt chỗ, chuyển động |
| `css/pages.css` | Các trang trong: lưới, thẻ phòng, lịch, các bước đặt phòng, My stay |
| `js/data.js` | Dữ liệu mẫu |
| `js/site.js` | Dùng chung: định dạng, giá và còn phòng, store sessionStorage, lịch, hộp xác nhận, menu, Reset |
| `js/aegis.js` | Trang chủ: sân khấu cuộn, thanh thời gian, planner |
| `js/rooms.js`, `room.js`, `book.js`, `stay.js`, `dining.js`, `spa.js`, `contact.js` | Mỗi trang một file |
| `tests/flow.test.cjs` | Kiểm luồng bằng Playwright (tự phục vụ repo qua http) |
| `docs/DESIGN-NOTES.md` | Brief, kế hoạch thị giác, kết quả soát, nguồn ảnh |

Header, menu điện thoại và footer lặp ở mỗi trang, nằm giữa `<!--@HEADER …-->` và `<!--@FOOTER …-->`; sửa thì sửa đồng
loạt ở mọi trang.

## Kiểm

```sh
# cần Playwright: npm i -D playwright && npx playwright install chromium
node tests/flow.test.cjs
```

Giá, phòng, giờ mở cửa, thực đơn và liệu trình là dữ liệu mẫu.
