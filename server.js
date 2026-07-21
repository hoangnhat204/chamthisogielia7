require('dotenv').config();
const express = require('express');
const session = require('cookie-session');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(session({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'my-secret-key-123']
    // Đã xóa maxAge để cookie bị hủy khi tắt trình duyệt/tab
}));

// Phục vụ file styles.css tĩnh
app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'styles.css'));
});

// Phục vụ thư mục accset tĩnh
app.use('/accset', express.static(path.join(__dirname, 'accset')));

// Chuyển hướng truy cập .html trực tiếp về các route sạch tương ứng
app.use((req, res, next) => {
    if (req.path === '/index.html') return res.redirect('/');
    if (req.path === '/admin.html') return res.redirect('/admin');
    if (req.path === '/judge.html') return res.redirect('/judge');
    if (req.path === '/login.html') return res.redirect('/login');
    next();
});

const db = require('./db');

// Middleware kiểm tra đăng nhập chung
const requireLogin = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else if (!req.session.user) {
        res.redirect('/login');
    } else {
        console.log('requireAdmin blocked request. user:', req.session.user);
        if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
            return res.status(403).json({ error: 'forbidden', details: 'Not logged in as admin' });
        }
        res.status(403).send('Bạn không có quyền truy cập trang này.');
    }
};

// Middleware kiểm tra quyền giám khảo (cho phép admin truy cập để test)
const requireJudge = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'judge' || req.session.user.role === 'admin')) {
        next();
    } else if (!req.session.user) {
        res.redirect('/login');
    } else {
        res.status(403).json({ error: 'unauthorized_judge' });
    }
};

// Route hiển thị form đăng nhập
app.get('/login', (req, res) => {
    // Đã vào trang login thì tự động đăng xuất luôn để tránh việc bị đăng nhập tự động
    req.session = null;
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Xử lý đăng nhập
app.post('/login', async (req, res) => {
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '').trim();
    try {
        const users = await db.getUsers();
        const user = users.find(u => (u.username || '').trim() === username && (u.password || '').trim() === password);
        
        if (user) {
            if (user.status === 'inactive') {
                return res.redirect('/login?error=2');
            }
            req.session.user = { username: user.username, role: user.role };
            if (user.role === 'admin') {
                res.redirect('/admin');
            } else if (user.role === 'judge') {
                res.redirect('/judge');
            } else {
                res.redirect('/login');
            }
        } else {
            res.redirect('/login?error=1');
        }
    } catch (err) {
        res.redirect('/login?error=1');
    }
});

// Đăng xuất
app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/login');
});

// Lấy thông tin user hiện tại đang đăng nhập
app.get('/api/session-user', requireLogin, (req, res) => {
    res.json({
        username: req.session.user.username,
        role: req.session.user.role
    });
});

// Lấy toàn bộ dữ liệu (users, teams, candidates, scores)
app.get('/api/data', requireLogin, async (req, res) => {
    try {
        const users = await db.getUsers();
        const contest = await db.getContestData();
        const isAdmin = req.session.user && req.session.user.role === 'admin';
        
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            users: users.map(u => ({ 
                username: u.username, 
                role: u.role, 
                status: u.status,
                password: isAdmin ? u.password : ''
            })),
            teams: contest.teams || [],
            candidates: contest.candidates || [],
            scores: contest.scores || []
        });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Các route hiển thị trang giao diện
app.get('/', (req, res) => {
    req.session = null; // Bắt buộc đăng xuất khi truy cập vào link gốc
    res.redirect('/login');
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/judge', requireLogin, (req, res) => {
    // Chỉ cho phép truy cập nếu là giám khảo hoặc admin
    if (req.session.user.role === 'judge' || req.session.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'views', 'judge.html'));
    } else {
        res.status(403).send('Chỉ Ban giám khảo mới có quyền truy cập trang này.');
    }
});

// Xử lý tạo tài khoản mới (Hỗ trợ cả form submit truyền thống và AJAX)
app.post('/admin/add-user', requireAdmin, async (req, res) => {
    console.log('ADD-USER called with body:', req.body);
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '').trim();
    const role = req.body.role;
    try {
        if (role === 'admin') {
            if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
                return res.status(400).json({ error: 'cannot_create_admin' });
            }
            return res.redirect('/admin?msg=cannot_create_admin');
        }

        const users = await db.getUsers();
        if (users.find(u => u.username === username)) {
            if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
                return res.status(400).json({ error: 'exists' });
            }
            return res.redirect('/admin?msg=exists');
        }
        
        await db.addUser(username, password, role);
        
        if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
            return res.json({ success: true });
        }
        res.redirect('/admin?msg=success');
    } catch (err) {
        console.error('ADD USER ERROR:', err);
        if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
            return res.status(500).json({ error: 'db_error', details: err.message });
        }
        res.status(500).send('Lỗi kết nối máy chủ');
    }
});

// Khóa / Mở khóa tài khoản
app.post('/admin/toggle-user-status', requireAdmin, async (req, res) => {
    const { username } = req.body;
    if (username === 'admin') {
        return res.status(400).json({ error: 'cannot_lock_admin' });
    }
    try {
        const users = await db.getUsers();
        if (!users.find(u => u.username === username)) {
            return res.status(404).json({ error: 'not_found' });
        }
        await db.toggleUserStatus(username);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Cập nhật mật khẩu tài khoản
app.post('/admin/update-user-password', requireAdmin, async (req, res) => {
    const username = (req.body.username || '').trim();
    const newPassword = (req.body.newPassword || '').trim();
    try {
        const users = await db.getUsers();
        if (!users.find(u => (u.username || '').trim() === username)) {
            return res.status(404).json({ error: 'not_found' });
        }
        await db.updateUserPassword(username, newPassword);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Xóa tài khoản
app.post('/admin/delete-user', requireAdmin, async (req, res) => {
    const { username } = req.body;
    if (username === 'admin') {
        return res.status(400).json({ error: 'cannot_delete_admin' });
    }
    try {
        const users = await db.getUsers();
        if (!users.find(u => u.username === username)) {
            return res.status(404).json({ error: 'not_found' });
        }
        await db.deleteUser(username);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Thêm đội mentor mới
app.post('/admin/add-team', requireAdmin, async (req, res) => {
    const { name, mentor1, mentor2 } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'missing_name' });
    }
    const mentors = [];
    if (mentor1) mentors.push(mentor1);
    if (mentor2 && mentor2 !== mentor1) mentors.push(mentor2);

    if (mentors.length === 0) {
        return res.status(400).json({ error: 'missing_mentors' });
    }

    try {
        const teamId = 'team_' + Date.now();
        await db.addTeam(teamId, name, mentors);
        res.json({ success: true, team: { id: teamId, name, mentors } });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Xóa đội mentor
app.post('/admin/delete-team', requireAdmin, async (req, res) => {
    const { teamId } = req.body;
    if (!teamId) {
        return res.status(400).json({ error: 'missing_id' });
    }
    try {
        await db.deleteTeam(teamId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Xóa toàn bộ điểm (Reset để BGK chấm lại từ đầu)
app.post('/admin/reset-scores', requireAdmin, async (req, res) => {
    try {
        await db.resetScores();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Lưu bảng điểm vào archive
app.post('/admin/archive-round', requireAdmin, async (req, res) => {
    const { roundName } = req.body;
    if (!roundName) {
        return res.status(400).json({ error: 'missing_round_name' });
    }
    try {
        await db.archiveCurrentRound(roundName);
        res.json({ success: true });
    } catch (err) {
        console.error('Error archiving round:', err);
        res.status(500).json({ error: 'db_error' });
    }
});

// Lấy danh sách bảng điểm đã lưu
app.get('/api/archived-rounds', requireAdmin, async (req, res) => {
    try {
        const archives = await db.getArchivedRounds();
        res.json({ archives });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Thêm thí sinh (vào đội mentor)
app.post('/admin/add-candidate', requireAdmin, async (req, res) => {
    const { name, teamId, sbd } = req.body;
    if (!name || !teamId) {
        return res.status(400).json({ error: 'missing_fields' });
    }
    try {
        const contest = await db.getContestData();
        if (!contest.teams.find(t => t.id === teamId)) {
            return res.status(400).json({ error: 'team_not_found' });
        }
        const candidateId = 'candidate_' + Date.now();
        await db.addCandidate(candidateId, name, sbd, teamId);
        res.json({ success: true, candidate: { id: candidateId, name, sbd: sbd || '', teamId, kahoot: 0 } });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Xóa thí sinh
app.post('/admin/delete-candidate', requireAdmin, async (req, res) => {
    const { candidateId } = req.body;
    if (!candidateId) {
        return res.status(400).json({ error: 'missing_id' });
    }
    try {
        await db.deleteCandidate(candidateId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Admin cập nhật điểm Kahoot cho thí sinh
app.post('/admin/update-kahoot', requireAdmin, async (req, res) => {
    const { candidateId, kahoot } = req.body;
    const kahootVal = parseFloat(kahoot);
    if (!candidateId || isNaN(kahootVal) || kahootVal < 0 || kahootVal > 10) {
        return res.status(400).json({ error: 'invalid_data' });
    }
    try {
        const contest = await db.getContestData();
        const cand = contest.candidates.find(c => c.id === candidateId);
        if (!cand) {
            return res.status(404).json({ error: 'candidate_not_found' });
        }
        await db.updateKahoot(candidateId, kahootVal);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

// Ban giám khảo chấm điểm / cập nhật điểm thí sinh (Bán kết: Áo dài, Truyền cảm hứng)
app.post('/judge/score', requireJudge, async (req, res) => {
    const { candidateId, aoDai, inspiration, ungXu, detailsR1, detailsR2, detailsR3 } = req.body;
    if (!candidateId) {
        return res.status(400).json({ error: 'missing_candidate_id' });
    }
    const judgeUsername = req.session.user.username;
    
    let parsedAoDai = undefined;
    if (typeof aoDai !== 'undefined') {
        parsedAoDai = parseFloat(aoDai);
        if (isNaN(parsedAoDai) || parsedAoDai < 0 || parsedAoDai > 10) return res.status(400).json({ error: 'invalid_aodai' });
    }

    let parsedInspiration = undefined;
    if (typeof inspiration !== 'undefined') {
        parsedInspiration = parseFloat(inspiration);
        if (isNaN(parsedInspiration) || parsedInspiration < 0 || parsedInspiration > 10) return res.status(400).json({ error: 'invalid_inspiration' });
    }

    let parsedUngXu = undefined;
    if (typeof ungXu !== 'undefined') {
        parsedUngXu = parseFloat(ungXu);
        if (isNaN(parsedUngXu) || parsedUngXu < 0 || parsedUngXu > 10) return res.status(400).json({ error: 'invalid_ungxu' });
    }
    
    console.log("POST /judge/score Received:", req.body);
    let parsedDetailsR1 = undefined;
    if (detailsR1) {
        try { parsedDetailsR1 = JSON.parse(detailsR1); } catch (e) {}
    }
    
    let parsedDetailsR2 = undefined;
    if (detailsR2) {
        try { parsedDetailsR2 = JSON.parse(detailsR2); } catch (e) {}
    }

    let parsedDetailsR3 = undefined;
    if (detailsR3) {
        try { parsedDetailsR3 = JSON.parse(detailsR3); } catch (e) {}
    }

    try {
        await db.saveScore(judgeUsername, candidateId, parsedAoDai, parsedInspiration, parsedUngXu, parsedDetailsR1, parsedDetailsR2, parsedDetailsR3);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'db_error' });
    }
});

app.post('/admin/toggle-r7', requireAdmin, async (req, res) => {
    const { candidateId, selected } = req.body;
    if (!candidateId || selected === undefined) {
        return res.status(400).json({ error: 'missing_data' });
    }
    try {
        await db.toggleCandidateR7(candidateId, selected === 'true' || selected === true);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'db_error' });
    }
});

// Admin import dữ liệu Đội & Thí sinh từ Excel
app.post('/admin/import-data', requireAdmin, async (req, res) => {
    const { data } = req.body;
    if (!data) {
        return res.status(400).json({ error: 'missing_data' });
    }
    try {
        const parsed = JSON.parse(data);
        const { teams, candidates } = parsed;
        if (!Array.isArray(teams) || !Array.isArray(candidates)) {
            return res.status(400).json({ error: 'invalid_format' });
        }
        await db.importData(teams, candidates);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: 'invalid_json' });
    }
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });
}

module.exports = app;
