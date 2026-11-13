# Aegis: ghi chú thiết kế và bàn giao

Bản **"A day at Aegis"** (nhánh `design/alpine-journey`), thay cho bản tập đoàn 3 khách sạn + 3 nhà hàng trước đó.
Cỡ việc **M**, theo `START-HERE.md` và `WORKFLOWS.md` của
[uiux-ai-workspace](https://github.com/Ngh1aa/uiux-ai-workspace). Hướng thị giác: **CHƯA DUYỆT**. Ngày: 12/11/2026.

## Yêu cầu và quyết định

- Chủ repo: chọn **một** khách sạn hoặc nhà hàng để mọi ảnh liên quan nhau; ảnh miễn phí, không vi phạm bản quyền;
  toàn bộ tiếng Anh; bố cục như một trải nghiệm khám phá khi cuộn.
- Bộ ảnh tìm được: 20 ảnh một khách sạn có thật ở thung lũng Alps và 19 ảnh cảnh quanh đó, cùng một tác giả, cùng
  ngày chụp, **CC BY 4.0** (đã xác minh qua metadata Wikimedia Commons).
- Chủ repo chọn: **giữ tên Aegis** (khách sạn hư cấu, thung lũng không nêu tên) và mạch **"một ngày ở khách sạn"**.
- Vì khách sạn trong ảnh có thật: chỉ dùng ảnh không lộ bảng tên; bỏ thêm ảnh có logo thương hiệu đồ uống và nhãn
  địa danh; không gán số liệu, lịch sử hay giá nào của khách sạn thật cho Aegis.

## Kế hoạch thị giác

```text
Mạch kể:            15:40 Arrival → 16:10 The hall → 17:30 Your room → 19:00 The bar → 22:00 The library
                    → 06:40 Morning → 08:00 The terrace → Plan your stay
Một câu cảm giác:   đi trọn một ngày ở một khách sạn cổ trên núi, từ chiều tới sáng hôm sau
Chữ:                Fraunces (một họ); tiêu đề 300 trục SOFT 100; thân 400; nhãn 600
Màu theo giờ:       chiều #f4f4f1 → chạng vạng #2b2431 → đêm #121a27 → bình minh (ảnh); thương hiệu xanh đêm #1f3049
Hình khối:          ảnh đỉnh vòm xen ảnh chữ nhật bo 4 px; nút bo tròn
Tương tác cuộn:     đường hầm phóng dần rồi chuyển sang cánh cửa cuối hầm; sảnh trượt ngang theo cuộn dọc;
                    ảnh thư viện đứng yên khi danh sách rượu trôi qua; sương sớm tan thành trời quang
Định hướng:         đồng hồ "giờ hiện tại" trên header; thanh thời gian cố định (≥ 1400 px) bấm để nhảy chặng;
                    thanh tiến độ 2 px dưới header; menu điện thoại liệt kê theo giờ
Card nổi bật:       duy nhất "Your stay": nhãn, phòng, ngày + bảng giá
```

## Trạng thái đã dựng và bấm thử

| Khối | Trạng thái |
|---|---|
| Sân khấu cuộn | bật khi cho phép chuyển động; tắt hoàn toàn khi giảm chuyển động (sảnh thành dải cuộn ngang gốc, sương đã tan, hầm không phóng) |
| Đặt phòng | thiếu tên/email; ngày trả trước ngày nhận; quá 14 đêm; phòng nhỏ hơn số khách; kín phòng 24/12 và 31/12 kèm nút ngày thay thế; tổng gồm thuế du lịch |
| Xác nhận | hộp xác nhận có Hủy, giữ dữ liệu; mất mạng → banner; gửi lại → mã AEG-xxxxx |
| Điều hướng | "Choose this room" chọn sẵn phòng; thanh thời gian nhảy đúng chặng; menu điện thoại đóng khi bấm link |

## Kết quả soát

- `check-brand.py`: 0 lỗi. `static-check.cjs`: 0 lỗi.
- `taste-check.cjs` 390/768/1280/1440 px, sáng và tối, reflow 320 px, axe-core: **0 lỗi**. Cảnh báo còn lại: các đoạn
  kể chuyện dưới tiêu đề (là nội dung chính của trải nghiệm), chữ chạm mép trong lúc dải sảnh đang trượt.
- `tests/flow.test.cjs` (bản một trang): **33/33 PASS** ở 1440 sáng, 390 tối và 1280 với giảm chuyển động.
- Lỗi tìm thấy và đã sửa: nhãn ẩn của thanh thời gian bị tính là chữ cùng màu nền; vùng cuộn ngang của sảnh
  không truy cập được bằng bàn phím; link credit gãy dòng; hai ảnh lộ logo và nhãn địa danh.

## Ảnh

Tác giả **Bybbisch94**, Wikimedia Commons, **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/). Đã cắt,
đổi cỡ (1800 px ngang, 1200 px dọc) và nén lại. Credit hiển thị ở footer và danh sách từng file ở `legal.html#credits`.

| File | Ảnh gốc trên Commons |
|---|---|
| hero.jpg | 20240906.Ansichten von Engelberg.-018 |
| tunnel.jpg, tunnel-door.jpg | 20240906.Hotel Terrace (Engelberg).-013, -012 |
| hall-1/2/3.jpg | 20240906.Hotel Terrace (Engelberg).-018, -019, -021 |
| bar-glasses/red/view.jpg | 20240906.Hotel Terrace (Engelberg).-052, -053, -057 |
| whisky.jpg | 20240906.Hotel Terrace (Engelberg).-054 |
| balcony.jpg | 20240906.Ansichten von Engelberg.-017 |
| morning-fog/clear.jpg | 20240906.Ansichten von Engelberg.-016, -019 |
| valley.jpg, chalets.jpg | 20240906.Ansichten von Engelberg.-013, -022 |

Font Fraunces: SIL OFL 1.1. Token và component từ `design-system/` của uiux-ai-workspace.

## Dữ liệu mẫu và mô phỏng

Tên Aegis, số phòng, loại phòng, giá, giờ mở bar, thuế du lịch, chính sách huỷ và các loại rượu là **giả định**.
Đặt phòng chỉ mô phỏng (chờ 900 ms; mất mạng thì báo lỗi); không có booking engine hay email.

## Bản nhiều trang (nhánh `feature/multipage-prototype`, 12/11/2026)

Trang chủ giữ nguyên mạch kể; thêm `rooms`, `room?id=`, `book`, `stay` (My stay), `dining`, `spa`, `contact` vào nav
chính (Rooms, Dining, Spa, My stay, Contact + nút Book a stay). Khối "Plan your stay" ở trang chủ thành planner: kiểm
ngày, sức chứa, đêm kín phòng rồi chuyển sang `book.html?room=&in=&out=&guests=`; phần tên, email và xác nhận dời
sang `book.html`.

- **Dữ liệu:** seed ở `js/data.js`; dữ liệu người dùng chỉ ở `sessionStorage` (`aegis-demo-v1`). Đêm kín phòng: 24 và
  31/12 cộng các đêm cách hôm nay 4, 5, 16, 17, 30 ngày; Tower Suite bận đêm +21 đến +23, Family Room +25, +26.
  Giờ đặt bàn và spa "đã kín" tính theo ngày cho ổn định.
- **Trung thực:** (đã thay ở bản polish, xem mục "Bản polish như sản phẩm thật" bên dưới). Không còn ngoại lệ ghi chú
  bản mẫu trên màn: dòng "không ghi chú bản mẫu trên màn" của TASTE áp dụng đầy đủ. Không có ô thẻ; thanh toán tại
  khách sạn.
- **Xác nhận:** xác nhận đặt phòng, đổi ngày, huỷ và Reset đều qua hộp có Hủy, rồi màn/banner kết quả.
- **Card nổi bật:** mỗi màn tối đa một ("Your stay", "Nightly rate" hoặc "Arrival"); bo 4 px đồng nhất.
- **Ảnh:** chỉ dùng lại ảnh trong `img/alpine`. Đã tìm ảnh phòng nghỉ CC0 trên Openverse và Wikimedia Commons nhưng
  chỉ thấy phòng khách sạn thành phố kiểu chuỗi, lệch tinh thần; nên chưa thêm ảnh mới. Thư viện ảnh mỗi phòng là
  cảnh nhìn và không gian chung của khách sạn.
- **Soát:** `taste-check` 390/768/1280/1440 sáng tối + reflow 320 và axe: 0 lỗi trên cả 10 trạng thái trang; cảnh báo
  còn lại là đoạn kể chuyện ở trang chủ, đoạn văn ở legal và tiêu đề dài xuống dòng ở 390 px. `static-check` 0 lỗi.
  `tests/flow.test.cjs` 73/73 PASS (33 kiểm trang chủ ở 3 cấu hình như bản trước, 40 kiểm luồng ở 1440 sáng và 390 tối).

## Bản polish như sản phẩm thật (nhánh `polish/real-product`, 13/11/2026)

- **Bỏ ghi chú bản mẫu:** màn xác nhận viết như khách sạn thật: "Your stay is confirmed" + "Reference AEG-xxxxx.
  We’ve emailed the details to …. Nothing is charged now; you pay at the hotel when you arrive." Bàn ăn, spa, tin
  nhắn, đổi ngày, huỷ cũng vậy. Bỏ câu "chỉ tìm được booking trong tab này" ở My stay, câu "Aegis is a fictional
  hotel" ở credit ảnh; email khách sạn `stay@aegis-hotel.ch` thay cho `.example`.
- **Dòng trung thực duy nhất:** footer mọi trang có "© 2026 Aegis · Concept product designed by Đỗ Anh Nghĩa.";
  link "Full photo credits" giữ nguyên.
- **Công cụ demo ẩn:** "Reset demo data" rời footer; cùng "Simulate a failed request" (lỗi đúng một lần gửi tiếp
  theo) nằm trong bảng nổi "Demo tools", chỉ hiện khi URL có `?demo=1` (giữ cho cả tab; `?demo=0` hoặc nút "Hide demo
  tools" tắt). Thông báo lỗi gửi đổi từ "because you’re offline" sang "Check your connection and try again".
- **Booking có sẵn:** store rỗng bắt đầu với `AEG-48213 · Hoffmann` (Lena Hoffmann, Balcony Room, 3 đêm, 2 người,
  dinner; ngày tính từ hôm nay +12, né đêm kín phòng). My stay hiện "Your recent booking: AEG-48213 · Hoffmann"; bấm
  vào để điền sẵn mã và họ. Reset đưa về đúng trạng thái này. Seed ở `js/data.js` (`seedBooking`).
- **Kiểm:** `tests/flow.test.cjs` 77/77 PASS (thêm kiểm: khách lần đầu không thấy chữ prototype/demo/sandbox/simulat/
  fictional/... trên 9 trang và không thấy Demo tools, `?demo=1` thì thấy; lỗi giả một lần giữ nguyên form; mở
  booking có sẵn từ gợi ý).

## Còn lại

1. Chủ repo duyệt hướng; logo thật.
2. Ảnh phòng nghỉ (bộ ảnh nguồn không có).
3. Booking engine thật, chính sách do pháp lý duyệt.
4. Thiết bị thật, trình đọc màn hình, người dùng thật.
