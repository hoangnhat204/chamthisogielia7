const fs = require('fs');
let html = fs.readFileSync('d:/chamdiemsogielia7/views/admin.html', 'utf8');

const newWrapper = `
                <div id="admin-score-detail-wrapper">
                    <div class="round-tabs" style="display:flex; gap:10px; margin-top: 1rem; margin-bottom: 1rem; flex-wrap:wrap;">
                        <button class="btn-small round-tab active" onclick="showAdminRoundTable('aodai')" style="margin:0; background: var(--accent-blue); color: #fff;">Vòng 1: Dạ Hội</button>
                        <button class="btn-small round-tab" onclick="showAdminRoundTable('inspiration')" style="margin:0;">Vòng 6: Truyền Cảm Hứng</button>
                        <button class="btn-small round-tab" onclick="showAdminRoundTable('ungxu')" style="margin:0;">Vòng 7: Ứng Xử</button>
                        <button class="btn-small round-tab" onclick="showAdminRoundTable('thuthach')" style="margin:0;">Vòng Thử Thách</button>
                    </div>

                    <!-- BẢNG XẾP HẠNG: ÁO DÀI -->
                    <div id="table-aodai" class="round-table-container" style="display: block;">
                        <h4 style="margin-top: 0.5rem; margin-bottom: 0.5rem; color: var(--accent-blue);">🏆 Bảng Xếp Hạng: Vòng 1: Dạ Hội</h4>
                        <div class="table-responsive">
                            <table class="custom-table">
                                <thead>
                                    <tr>
                                        <th style="width: 70px; text-align: center;">Hạng</th>
                                        <th>Thí sinh</th>
                                        <th>Đội Mentor</th>
                                        <th>Chi tiết Điểm </th>
                                        <th style="width: 100px; text-align: center;">Điểm TB</th>
                                    </tr>
                                </thead>
                                <tbody id="aodai-admin-board">
                                    <tr><td colspan="5" style="text-align: center; font-style: italic;">Đang tải...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- BẢNG XẾP HẠNG: TRUYỀN CẢM HỨNG -->
                    <div id="table-inspiration" class="round-table-container" style="display: none;">
                        <h4 style="margin-top: 0.5rem; margin-bottom: 0.5rem; color: var(--accent-blue);">🏆 Bảng Xếp Hạng: Vòng 6: Truyền Cảm Hứng</h4>
                        <div class="table-responsive">
                            <table class="custom-table">
                                <thead>
                                    <tr>
                                        <th style="width: 70px; text-align: center;">Hạng</th>
                                        <th>Thí sinh</th>
                                        <th>Đội Mentor</th>
                                        <th>Chi tiết Điểm </th>
                                        <th style="width: 100px; text-align: center;">Điểm TB</th>
                                    </tr>
                                </thead>
                                <tbody id="inspiration-admin-board">
                                    <tr><td colspan="5" style="text-align: center; font-style: italic;">Đang tải...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- BẢNG XẾP HẠNG: ỨNG XỬ -->
                    <div id="table-ungxu" class="round-table-container" style="display: none;">
                        <h4 style="margin-top: 0.5rem; margin-bottom: 0.5rem; color: var(--accent-blue);">🏆 Bảng Xếp Hạng: Vòng 7: Ứng Xử</h4>
                        <div class="table-responsive">
                            <table class="custom-table">
                                <thead>
                                    <tr>
                                        <th style="width: 70px; text-align: center;">Hạng</th>
                                        <th>Thí sinh</th>
                                        <th>Đội Mentor</th>
                                        <th>Chi tiết Điểm </th>
                                        <th style="width: 100px; text-align: center;">Điểm TB</th>
                                    </tr>
                                </thead>
                                <tbody id="ungxu-admin-board">
                                    <tr><td colspan="5" style="text-align: center; font-style: italic;">Đang tải...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- BẢNG XẾP HẠNG: THỬ THÁCH -->
                    <div id="table-thuthach" class="round-table-container" style="display: none;">
                        <h4 style="margin-top: 0.5rem; margin-bottom: 0.5rem; color: var(--accent-blue);">🏆 Bảng Xếp Hạng: Vòng Thử Thách</h4>
                        <div class="table-responsive">
                            <table class="custom-table">
                                <thead>
                                    <tr>
                                        <th style="width: 70px; text-align: center;">Hạng</th>
                                        <th>Thí sinh</th>
                                        <th>Đội Mentor</th>
                                        <th>Chi tiết Điểm </th>
                                        <th style="width: 100px; text-align: center;">Điểm TB</th>
                                    </tr>
                                </thead>
                                <tbody id="thuthach-admin-board">
                                    <tr><td colspan="5" style="text-align: center; font-style: italic;">Đang tải...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
`;

const startIdx = html.indexOf('<div id="admin-score-detail-wrapper">');
const tempHtml = html.substring(startIdx);
const endIdx = startIdx + tempHtml.indexOf('</div>', tempHtml.indexOf('<tbody id="thuthach-admin-board">')) + 6;

if (startIdx > -1 && endIdx > startIdx) {
    html = html.substring(0, startIdx) + newWrapper + html.substring(endIdx);
    fs.writeFileSync('d:/chamdiemsogielia7/views/admin.html', html);
    console.log('Successfully replaced admin-score-detail-wrapper');
} else {
    console.log('Failed to find indices');
}
