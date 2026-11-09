# Aegis — Product design

## Bối cảnh và công việc chính

Aegis là workspace cho đội fraud operations. Fraud Analyst phải ưu tiên hàng đợi, kiểm tra chứng cứ và ghi quyết định có thể truy vết. Risk Manager tiếp nhận escalations và phân bổ hồ sơ. Compliance Officer tra cứu lịch sử quyết định và đối chiếu đối tượng nguồn. Prototype mở ở vai trò Fraud Analyst.

**Giả thuyết:** Analyst rà nhiều hồ sơ liên tiếp trên desktop, chịu áp lực thời hạn và có thể nhầm một điểm rủi ro cao với bằng chứng đủ mạnh. Khi thiếu chứng cứ, analyst cần con đường chuyển cấp rõ ràng thay vì bị buộc đóng hồ sơ.

## Nghiên cứu bàn giấy

| Nguồn | Pattern quan sát | Áp dụng vào Aegis |
| --- | --- | --- |
| [Stripe Radar](https://docs.stripe.com/radar/transaction-reviews) | Hàng đợi review dùng chuyên môn con người bổ sung cho đánh giá tự động | Alert chỉ đưa giao dịch vào tầm nhìn. Người duyệt xem tín hiệu và ghi lý do quyết định. |
| [Stripe Disputes](https://docs.stripe.com/disputes/responding) | Hạn phản hồi và tập chứng cứ ảnh hưởng quyết định | Hiện hạn ngay trong queue. Phân biệt chứng cứ có sẵn với chứng cứ đã rà. |
| [Unit21 Alerts](https://support.unit21.ai/hc/en-us/articles/6712819596564-Alerts-overview) | Alert có nguồn rule, liên kết, checklist, assignment và audit | ID riêng cho giao dịch, alert và case. Đưa nguồn tín hiệu và đích truy ngược vào UI. |
| [Adyen Case Management](https://docs.adyen.com/risk-management/case-management/) | Trạng thái xử lý payment và trạng thái manual review có mục đích riêng | Hiện riêng payment status, risk level và investigation status trong bảng và chi tiết. |

**Heuristic:** Dùng cột số căn phải, bộ lọc chia sẻ qua URL, review trước commit và audit có trạng thái cũ/mới. **Giả định:** Thứ tự công việc là SLA quá hạn, tín hiệu nghiêm trọng, sau đó xu hướng. Ngưỡng risk và confidence mang tính minh họa. Không có dữ liệu quan sát người dùng thật.

## Mô hình và kiến trúc thông tin

- Transaction giữ amount, currency, origin và payment status. Một alert có thể liên kết transaction với một rule và nhiều risk signal. Mỗi signal có confidence dựa trên nguồn dữ liệu minh họa.
- Case lưu priority, owner, deadline và progress. Dispute giữ lý do, hạn và chứng cứ riêng, liên kết về đúng case và transaction.
- Audit event giữ actor, thời điểm, loại đối tượng, ID, trạng thái trước/sau và lý do. Liên kết dùng ID ổn định.
- **Operations:** Overview → Transactions → Investigation, Cases → Case detail, Disputes → Dispute detail.
- **Oversight:** Analytics, Rules → Rule test/review, Audit trail → đối tượng gốc.

| Màn | Câu hỏi chính | Phục hồi |
| --- | --- | --- |
| Overview | Việc nào cần tôi ngay? | Queue đã xử lý hết dẫn về Transactions |
| Transactions | Hồ sơ nào đáng mở? | Xóa bộ lọc, quay lại đúng query và trang |
| Investigation | Tín hiệu đến từ đâu và đã đủ chứng cứ chưa? | Rà lại evidence, thêm lý do hoặc chuyển cấp |
| Cases | Hồ sơ thuộc về ai và còn bao lâu? | Chọn người xử lý và lưu lại |
| Disputes | Còn thiếu gì trước hạn? | Phân công case, rà đủ chứng cứ hoặc chấp nhận tranh chấp |
| Analytics | Khối lượng công việc thay đổi ra sao? | Đổi kỳ và xem giá trị theo ngày |
| Rules | Điều kiện khớp giao dịch nào? | Sửa ngưỡng và test lại. Rule được bảo vệ chuyển Risk Manager |
| Audit trail | Ai đổi gì, vì sao? | Lọc lại và mở đối tượng bằng ID |

## Hai luồng trọng tâm

- **A:** Overview → bộ lọc giao dịch rủi ro → chi tiết → mở và đánh dấu evidence đã rà → chọn disposition → xem lại đối tượng, giá trị, hệ quả và lý do → xác nhận → case cập nhật → audit → giao dịch. Hai nhánh khôi phục gồm thiếu lý do và chưa rà chứng cứ. Escalate chuyển case sang Risk Manager và vẫn yêu cầu lý do.
- **B:** Dispute queue → dispute detail → review evidence → phân công linked case → chọn Accept hoặc Challenge → xem lại → xác nhận → trạng thái tranh chấp, case và audit cập nhật. Hai nhánh khôi phục gồm thiếu owner và thiếu evidence khi challenge. Có thể hủy xác nhận để chỉnh lý do hoặc disposition.

Back và browser Back khôi phục bộ lọc từ URL. Màn chi tiết lưu dấu hồ sơ vừa chọn trong phiên điều hướng và trả focus về đúng liên kết nếu dòng vẫn có trong kết quả. Quyết định có version guard để nhận diện dữ liệu thay đổi trong lúc xác nhận.

## Brand brief và hướng thiết kế

**Mức D.** Brand có tên Aegis và bốn phẩm chất Precision, Trust, Clarity, Control. Logo, palette và typography do nhóm triển khai đề xuất. Nội dung UI dùng tiếng Anh cho bối cảnh fraud operations quốc tế. Hướng và nội dung UI **CHƯA DUYỆT**.

Vật gốc cân nhắc gồm phiếu chuyển giao ca, nhật ký giao dịch và tập chứng cứ. Chọn **phiếu chuyển giao ca** cho Overview. Nhãn ưu tiên, đối tượng, deadline và liên kết hành động tạo một dòng đọc nhất quán. Tập chứng cứ là hình mẫu cho trang điều tra, với dữ kiện quan sát ở bên trái và tác động của quyết định ở bên phải.

| Hướng | Cấu trúc | Đánh đổi |
| --- | --- | --- |
| Shift ledger | Hàng đợi hành động trước, biểu đồ cạnh hàng đợi, giao dịch theo chiều ngang phía dưới | Dễ bắt đầu ca, trend chiếm ít chỗ hơn |
| Monitoring desk | Giao dịch ở cột chính, ưu tiên và trend xếp trong cột phụ | Tốt khi soi dữ liệu liên tục, SLA và tranh chấp khó thấy sớm hơn |
| Exception board | Nhóm tác vụ theo mức khẩn cấp, dữ liệu đưa xuống một màn riêng | Triage nhanh, tăng chi phí chuyển màn để so giao dịch |

Chọn **Shift ledger** cho prototype. Hai hướng đầu được dựng với cùng nội dung. Thử chuyển nguyên tắc sang bảng Transactions, hồ sơ Investigation và thao tác Disputes.

- Bảng màu: nền xám ấm, giấy trắng ngà, chữ than xanh, olive cho điều hướng và thao tác chính. Đỏ, amber, xanh lá và xanh lam chỉ mang nghĩa trạng thái. Chuỗi biểu đồ dùng bảng màu riêng.
- IBM Plex Sans Variable, tiêu đề 32–34 px, nhãn phụ từ 12 px, số căn theo tabular figures. Lưới 12 cột ở desktop và một cột ở mobile. Nhịp 4 px, bo 8 px, bề mặt dùng viền.
- Dấu ấn ngoài màu: nhịp ledger dày vừa, ID liên tục theo đối tượng, hàng ưu tiên diễn giải SLA tại chỗ, cùng một đường từ evidence đến bản ghi quyết định.
- Điểm nhấn đầu màn là số việc cần xử lý gắn với lối vào queue. Dùng biểu đồ để đọc volume theo ngày và mở ngày tương ứng, không dùng minh họa trang trí.

## PLANNED_VALIDATION

Walkthrough nội bộ trên hai luồng và nhánh lỗi. Khi có người tham gia, quan sát analyst tìm việc ưu tiên, giải thích lý do flag, chọn chuyển cấp khi confidence thấp, và xác nhận đúng đối tượng. Quan sát quản lý tiếp nhận escalation và compliance truy lại lý do từ audit. Ghi số bước quay lại, lỗi hiểu trạng thái và nhầm đối tượng. Kết quả hiện tại là bằng chứng chạy prototype và đánh giá heuristic.
