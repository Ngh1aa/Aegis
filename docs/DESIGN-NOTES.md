# Aegis: ghi chú thiết kế và bàn giao

Cỡ việc **M** (landing page tập đoàn khách sạn và nhà hàng, có luồng đặt chỗ), theo `START-HERE.md` và
`WORKFLOWS.md` của [uiux-ai-workspace](https://github.com/Ngh1aa/uiux-ai-workspace). Hướng thị giác: **CHƯA DUYỆT**.
Ngày: 12/11/2026.

## Brand brief (tóm tắt, mức D)

- Khách đưa: chỉ tên "Aegis" và trang tham khảo https://somossade.com/ (tập đoàn Sade, San Sebastián:
  khách sạn và rạp chiếu phim). Không logo, màu, font, ảnh. Mọi lựa chọn là `ĐỀ XUẤT`.
- Giả định sản phẩm: Aegis Hospitality, 3 khách sạn và 3 nhà hàng ở Hội An, Đà Nẵng, Huế. Nội dung tiếng Anh.
- Người dùng: khách du lịch và khách địa phương đặt phòng hoặc đặt bàn. Việc chính: chọn nơi phù hợp và giữ chỗ.

## Kế hoạch thị giác (CRAFT.md mục 1)

```text
Ngành và vật gốc:      khách sạn và nhà hàng; vật gốc khung vòm cửa và tấm khiên (Aegis)
Một câu cảm giác:      ấm, tối, chậm, như bước vào sảnh lúc chạng vạng
Chữ:                   Fraunces (một họ, OFL); tiêu đề 300 trục SOFT 100; thân 400; nhãn 600
Màu theo vai trò:      nền #f4f4f1, bề mặt #fbfbf9, chữ #18202b, thương hiệu xanh đêm #1f3049, dải tối #141d2b
Hình khối:             ảnh địa điểm đỉnh vòm; card bo 4 px; nút và ô nhập bo tròn
Bố cục:                hero ảnh tràn; tuyên ngôn cỡ lớn + ảnh vòm + 3 số liệu; 3 khách sạn xen kẽ ảnh/chữ;
                       dải xanh đêm 3 nhà hàng; khu đặt chỗ 8 cột + cột tóm tắt 4 cột; đăng ký nhận tin trên ảnh
Card nổi bật:          duy nhất một, "Your stay / Your table": nhãn, nơi và phòng, ngày + bảng giá
Một điểm táo bạo:      đoạn tuyên ngôn chữ lớn "thấm mực" dần theo vị trí cuộn
Ba điểm khác starter:  1. khung vòm  2. một họ serif Fraunces  3. tuyên ngôn thấm mực
Đã đối chiếu mục 2:    trang tham khảo dùng nền kem #f5f4ec + đỏ đất nung #b24237 (bị cấm) → trắng giấy + xanh đêm;
                       không dùng cặp serif Grenette + sans Hurme (TASTE: một họ chữ)
```

## Lấy gì từ Sade, đổi gì

| Sade | Aegis | Lý do |
|---|---|---|
| Trang thương hiệu tập đoàn: hero, tuyên ngôn, các không gian, đăng ký nhận tin | Giữ cấu trúc này | Đúng vai trò trang tập đoàn |
| Không có đặt chỗ trên trang chủ, dẫn sang site từng khách sạn | Thêm khu Book: Stay và Dine đầy đủ | Playbook khách sạn: ngày, khách, giá gồm phí, hết phòng có phương án thay thế |
| Nền kem, nhấn đỏ đất nung; serif + sans | Trắng giấy, xanh đêm; một họ Fraunces | CRAFT cấm bảng màu này; TASTE một họ chữ |
| Tên nơi đặt nhỏ phía trên tiêu đề | Đặt dưới tiêu đề | TASTE: không overline |

## Màn hình × trạng thái (đã dựng và bấm thử)

| Khối | Trạng thái |
|---|---|
| Stay: tìm | ngày trả trước ngày nhận, ngày quá khứ, quá 14 đêm; số khách 1–4, khoá ở 4 kèm lý do |
| Stay: chọn phòng | đủ phòng; phòng giữa hết vì có tối thứ Bảy (có lý do); phòng nhỏ hơn số khách; cả khách sạn hết 24/12 và 31/12 kèm nút ngày thay thế |
| Stay: thông tin | lỗi tên, email, điện thoại; cột bên hiện giá × đêm, VAT 8%, phí dịch vụ 5%, tổng |
| Stay: xác nhận | hộp xác nhận có Hủy (TASTE: việc liên quan tiền); mất mạng → banner, giữ dữ liệu; gửi lại → mã AEG-xxxxx |
| Dine | nhà hàng đóng cửa thứ Hai kèm nút ngày mở gần nhất; giờ đã kín gạch ngang; chưa chọn giờ thì chặn; tối đa 8 người kèm lý do; mã TBL-xxxxx |
| Nhận tin | email sai, chưa đồng ý, mất mạng, thành công |
| Điều hướng | mọi nút "Check availability" và "Reserve a table" mở đúng tab và điền sẵn đúng nơi |

## Kết quả soát

- `check-brand.py css/brand.css`: 0 lỗi.
- `static-check.cjs`: 0 lỗi.
- `taste-check.cjs` 390/768/1280/1440 px, sáng và tối, reflow 320 px, axe-core: **0 lỗi**. Cảnh báo còn lại:
  mô tả khách sạn và nội dung trang pháp lý ("dòng giải thích phụ", là dữ liệu thật); link "Privacy policy"
  nằm trong câu đồng ý nhận tin (link nội dòng, WCAG 2.5.8 cho phép).
- `tests/flow.test.cjs`: 29/29 PASS ở 1280 sáng và 390 tối.
- Lỗi tìm thấy và đã sửa: biến dùng trước khi khai báo làm JS dừng; banner bo tròn như nút; cột bên hiện chính
  sách đặt phòng khi đang đặt bàn; số "2014" tràn ở 320 px; hai nút "Try…" rỗng trước khi JS chạy; tên địa điểm
  thành overline.

## Phần mô phỏng và dữ liệu mẫu

Mọi tên khách sạn, nhà hàng, giá, số phòng, giờ mở cửa, số điện thoại, quy tắc còn/hết phòng và giờ đã kín là
**giả định**. Không có booking engine, không gửi email hay SMS; gửi form chờ 900 ms rồi báo thành công, mất
mạng thì báo lỗi. Quy tắc mô phỏng ghi ở đầu `js/aegis.js`.

## Ảnh và font

Ảnh CC0 1.0 từ rawpixel (qua Openverse), bản 1024 px; thay bằng ảnh thật của khách sạn ở ≥ 2400 px khi có.

| File | Nguồn |
|---|---|
| hero.jpg | rawpixel, "Free beach hotel resort image" |
| hotel-riverside.jpg | rawpixel, "Free hotel room photo" |
| hotel-cliff.jpg | rawpixel, "Resort's swimming pool beach" |
| hotel-house.jpg | rawpixel, "Hotel Lobby" |
| dine-hearth.jpg | rawpixel, "Fancy restaurant interior" |
| dine-tide.jpg | rawpixel, "Free fine dining steak image" |
| dine-lantern.jpg | rawpixel, "Free egg white cocktail bar" |
| story-chef.jpg | rawpixel, "Fine dining fresh food" |
| final.jpg | rawpixel, "Mauritius beach side resort pool" |

Font Fraunces: SIL OFL 1.1 (`fonts/fraunces/OFL.txt`), từ github.com/google/fonts. Token và component từ
`design-system/` của uiux-ai-workspace.

## Chưa kiểm / việc còn lại

1. Chủ repo duyệt hướng thị giác; logo thật.
2. Kết nối booking engine thật (hoặc chuyển sang engine bên ngoài có báo trước), CRM, email, SMS.
3. Ảnh thật, dữ liệu phòng và giá thật; chính sách huỷ do pháp lý duyệt.
4. Thiết bị thật, trình đọc màn hình, người dùng thật.
