const fs = require('fs');
let html = fs.readFileSync('views/judge.html', 'utf8');

// Replace form area
const oldForm = `<form id="score-form" onsubmit="handleFormSubmit(event)">
                    <div class="score-section">
                        <div class="section-title">Áo Dài (Vòng 1)</div>
                        <div class="score-display-big" id="score-big-aoDai">8.0đ</div>
                        <div id="score-buttons-aoDai"></div>
                    </div>
                    <div class="score-section">
                        <div class="section-title">Truyền Cảm Hứng (Vòng 2)</div>
                        <div class="score-display-big" id="score-big-inspiration">8.0đ</div>
                        <div id="score-buttons-inspiration"></div>
                    </div>
                    <div class="wizard-buttons">
                        <button type="submit" class="btn-success" id="btn-submit" style="width:100%;">Gửi Điểm</button>
                    </div>
                </form>`;

const newForm = `<form id="score-form" onsubmit="handleFormSubmit(event)">
                    <div id="criteria-container"></div>
                    <div class="score-section" style="margin-top:1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
                        <div class="section-title">TỔNG ĐIỂM (Cộng dồn)</div>
                        <div class="score-display-big" id="score-big-total">0.0đ</div>
                    </div>
                    <div class="wizard-buttons">
                        <button type="submit" class="btn-success" id="btn-submit" style="width:100%;">Gửi Điểm</button>
                    </div>
                </form>`;

html = html.replace(oldForm, newForm);

// Replace script area
const scriptRegex = /let currentUser = null;[\s\S]*?(?=function showCompletion)/;

const newScript = `let currentUser = null;
        let appData = { users: [], teams: [], candidates: [], scores: [] };
        let currentCandidateIndex = 0;
        let currentRoundPhase = 1; // 1 = Vòng 1, 2 = Vòng 2
        let selectedCriteria = [];

        const criteriaR1 = [
            { name: "Thần thái", max: 3.0, step: 0.5 },
            { name: "Kỹ năng trình diễn", max: 3.0, step: 0.5 },
            { name: "Khả năng tôn vinh vẻ đẹp của tà áo dài", max: 2.0, step: 0.5 },
            { name: "Ấn tượng tổng thể", max: 2.0, step: 0.5 }
        ];

        const criteriaR2 = [
            { name: "Nội dung, thông điệp", max: 2.5, step: 0.5 },
            { name: "Câu chuyện và cảm xúc", max: 2.5, step: 0.5 },
            { name: "Liên hệ bản thân với phong trào, hoạt động LGBTIQ+", max: 3.0, step: 0.5 },
            { name: "Kỹ năng trình bày", max: 2.0, step: 0.5 }
        ];

        async function init() {
            await fetchSessionUser();
            await loadData(true);
            setInterval(() => {
                if (currentUser && !document.hidden) {
                    loadData(false, true);
                }
            }, 10000);
        }

        async function fetchSessionUser() {
            try {
                const res = await fetch('/api/session-user');
                if (res.ok) {
                    currentUser = await res.json();
                    renderProfileBar();
                } else {
                    window.location.href = '/login';
                }
            } catch (e) { console.error('Lỗi session', e); }
        }

        function renderProfileBar() {
            const p = document.getElementById('user-profile');
            if (currentUser) p.innerHTML = \`👋 Giám khảo: <strong>\${currentUser.username}</strong>\`;
        }

        function showAlert(msg, type = 'success') {
            const c = document.getElementById('alert-container');
            c.innerHTML = \`<div class="alert alert-\${type}">\${msg}</div>\`;
            setTimeout(() => { c.innerHTML = ''; }, 3000);
        }

        async function loadData(auto = false, silent = false) {
            try {
                const r = await fetch('/api/data');
                if (r.ok) {
                    appData = await r.json();
                    if (!silent) {
                        if (auto) resumeProgress(); else renderWizard();
                    }
                }
            } catch (e) { console.error('load error', e); }
        }

        function resumeProgress() {
            const cand = appData.candidates || [];
            // Kiểm tra vòng 1
            for (let i = 0; i < cand.length; i++) {
                const s = appData.scores.find(v => v.candidateId === cand[i].id && v.judge === currentUser.username);
                if (!s || typeof s.aoDai === 'undefined') {
                    currentRoundPhase = 1;
                    currentCandidateIndex = i;
                    renderWizard();
                    return;
                }
            }
            // Kiểm tra vòng 2
            for (let i = 0; i < cand.length; i++) {
                const s = appData.scores.find(v => v.candidateId === cand[i].id && v.judge === currentUser.username);
                if (!s || typeof s.inspiration === 'undefined') {
                    currentRoundPhase = 2;
                    currentCandidateIndex = i;
                    renderWizard();
                    return;
                }
            }
            showCompletion();
        }

        function renderWizard() {
            const w = document.getElementById('wizard-view');
            const c = document.getElementById('completion-view');
            const candidates = appData.candidates || [];

            if (candidates.length === 0) {
                w.innerHTML = '<p style="text-align:center;font-style:italic;">Không có thí sinh nào trong hệ thống.</p>';
                return;
            }

            if (currentCandidateIndex >= candidates.length) currentCandidateIndex = candidates.length - 1;

            const cand = candidates[currentCandidateIndex];
            const team = appData.teams.find(t => t.id === cand.teamId);
            const teamName = team ? \`\${team.name} (\${team.mentors.join(' & ')})\` : 'Chưa gán';

            document.getElementById('cand-name-text').textContent = (cand.sbd ? \`[SBD \${cand.sbd}] \` : '') + cand.name;
            document.getElementById('cand-team-text').textContent = \`Đội: \${teamName}\`;

            const total = candidates.length;
            const step = currentCandidateIndex + 1;

            document.getElementById('step-indicator-text').textContent = \`Thí sinh \${step} / \${total} - Vòng \${currentRoundPhase}\`;
            document.getElementById('progress-bar-fill').style.width = \`\${step === 1 ? 5 : ((step - 1) / total) * 100}%\`;

            const activeCriteria = currentRoundPhase === 1 ? criteriaR1 : criteriaR2;
            document.getElementById('round-badge-text').textContent = currentRoundPhase === 1 ? "Vòng 1: Áo Dài" : "Vòng 2: Truyền Cảm Hứng";
            
            selectedCriteria = activeCriteria.map(() => null);
            renderCriteria(activeCriteria);
            updateTotalScore();

            w.style.display = 'block';
            c.style.display = 'none';
        }

        function renderCriteria(criteriaList) {
            const container = document.getElementById('criteria-container');
            let html = '';
            criteriaList.forEach((crit, index) => {
                html += \`<div class="score-section">
                    <div class="section-title" style="text-align:left; font-size: 0.95rem; margin-bottom: 0.5rem;">\${index + 1}. \${crit.name} (Max \${crit.max.toFixed(1)}đ)</div>
                    <div class="score-buttons-grid" id="crit-btns-\${index}">\`;
                
                let val = 0;
                while (val <= crit.max) {
                    html += \`<div class="score-btn" onclick="selectCriterion(\${index}, \${val})">\${val.toFixed(1)}</div>\`;
                    val += crit.step;
                }
                html += \`</div></div>\`;
            });
            container.innerHTML = html;
        }

        function selectCriterion(index, val) {
            selectedCriteria[index] = val;
            const btns = document.querySelectorAll(\`#crit-btns-\${index} .score-btn\`);
            btns.forEach(b => {
                if (parseFloat(b.textContent) === val) b.classList.add('active');
                else b.classList.remove('active');
            });
            updateTotalScore();
        }

        function updateTotalScore() {
            let total = 0;
            let allSelected = true;
            selectedCriteria.forEach(v => {
                if (v === null) allSelected = false;
                else total += v;
            });
            document.getElementById('score-big-total').textContent = total.toFixed(1) + 'đ';
            const btn = document.getElementById('btn-submit');
            btn.disabled = !allSelected;
            if(!allSelected) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        }

        async function handleFormSubmit(e) {
            e.preventDefault();
            if (selectedCriteria.includes(null)) {
                showAlert('❌ Vui lòng chấm đủ tất cả các tiêu chí!', 'error');
                return;
            }

            if (!confirm('Ban Giám Khảo chắc chắn gửi điểm này?')) {
                return;
            }

            const totalScore = selectedCriteria.reduce((a, b) => a + b, 0);
            const cand = appData.candidates[currentCandidateIndex];
            const body = { candidateId: cand.id };
            if (currentRoundPhase === 1) body.aoDai = totalScore;
            else body.inspiration = totalScore;

            try {
                const r = await fetch('/judge/score', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(body)
                });
                if (r.ok) {
                    await loadData(false, true);
                    currentCandidateIndex++;
                    if (currentCandidateIndex >= appData.candidates.length) {
                        if (currentRoundPhase === 1) {
                            currentRoundPhase = 2;
                            currentCandidateIndex = 0;
                            showAlert('🎉 Đã chấm xong Vòng 1. Chuyển sang Vòng 2!');
                            renderWizard();
                        } else {
                            showCompletion();
                            showAlert('🎉 Đã hoàn thành chấm điểm tất cả thí sinh!');
                        }
                    } else {
                        showAlert('✅ Đã lưu điểm.');
                        renderWizard();
                    }
                } else {
                    if (r.status === 401 || r.status === 403) {
                        showAlert('❌ Phiên đã hết hạn...', 'error');
                        setTimeout(() => { window.location.href = '/login'; }, 1500);
                        return;
                    }
                    const msg = await r.text();
                    showAlert(\`❌ Lưu điểm thất bại: \${msg || 'Vui lòng thử lại!'}\`, 'error');
                }
            } catch (err) {
                showAlert('❌ Lỗi kết nối máy chủ!', 'error');
            }
        }

        `;

html = html.replace(scriptRegex, newScript);

fs.writeFileSync('views/judge.html', html, 'utf8');
console.log('Update judge.html successful');
