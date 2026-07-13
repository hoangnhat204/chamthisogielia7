const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'my-secret-key-123',
    resave: false,
    saveUninitialized: true
}));

// Phục vụ file styles.css tĩnh
app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'styles.css'));
});

// Chuyển hướng truy cập .html trực tiếp về các route sạch tương ứng
app.use((req, res, next) => {
    if (req.path === '/index.html') return res.redirect('/');
    if (req.path === '/admin.html') return res.redirect('/admin');
    if (req.path === '/judge.html') return res.redirect('/judge');
    if (req.path === '/login.html') return res.redirect('/login');
    next();
});

// Hàm đọc dữ liệu người dùng
const getUsers = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8'));

// Hàm đọc/ghi dữ liệu cuộc thi (thí sinh, đội & điểm số)
const contestFilePath = path.join(__dirname, 'contest.json');
const getContestData = () => {
    if (!fs.existsSync(contestFilePath)) {
        fs.writeFileSync(contestFilePath, JSON.stringify({ teams: [], candidates: [], scores: [] }, null, 4));
    }
    let data = JSON.parse(fs.readFileSync(contestFilePath, 'utf8'));
    let changed = false;
    if (!data.teams) {
        data.teams = [];
        changed = true;
    }
    // Migration 1: nếu thí sinh cũ có mentor trực tiếp mà chưa có teamId
    if (data.candidates && data.candidates.length > 0) {
        data.candidates.forEach(cand => {
            if (cand.mentor && !cand.teamId) {
                let team = data.teams.find(t => t.mentors.length === 1 && t.mentors[0] === cand.mentor);
                if (!team) {
                    team = {
                        id: 'team_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        name: 'Đội ' + cand.mentor,
                        mentors: [cand.mentor]
                    };
                    data.teams.push(team);
                }
                cand.teamId = team.id;
                delete cand.mentor;
                changed = true;
            }
        });
    }
    // Migration 2: nếu điểm số cũ có dạng chỉ có 'score' thay vì bán kết (aoDai, kahoot, inspiration)
    if (data.scores && data.scores.length > 0) {
        data.scores.forEach(s => {
            if (typeof s.score !== 'undefined' && typeof s.aoDai === 'undefined') {
                s.aoDai = s.score;
                s.inspiration = s.score;
                delete s.score;
                changed = true;
            }
        });
    }
    // Migration 3: di trú kahoot từ bảng điểm BGK sang bảng candidate
    if (data.candidates && data.candidates.length > 0) {
        data.candidates.forEach(cand => {
            if (typeof cand.kahoot === 'undefined') {
                const existingKahootScore = data.scores.find(s => s.candidateId === cand.id && typeof s.kahoot !== 'undefined' && s.kahoot > 0);
                cand.kahoot = existingKahootScore ? existingKahootScore.kahoot : 0;
                changed = true;
            }
        });
    }
    if (data.scores && data.scores.length > 0) {
        data.scores.forEach(s => {
            if (typeof s.kahoot !== 'undefined') {
                delete s.kahoot;
                changed = true;
            }
        });
    }
    if (changed) {
        fs.writeFileSync(contestFilePath, JSON.stringify(data, null, 4));
    }
    return data;
};
const saveContestData = (data) => {
    fs.writeFileSync(contestFilePath, JSON.stringify(data, null, 4));
};

// Middleware kiểm tra đăng nhập chung
const requireLogin = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Middleware kiểm tra quyền admin
const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).send('Bạn không có quyền truy cập trang này. <a href="/leaderboard">Về trang chủ</a>');
    }
};

// Middleware kiểm tra quyền giám khảo
const requireJudge = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'judge' || req.session.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ error: 'unauthorized_judge' });
    }
};

// Route hiển thị form đăng nhập
app.get('/login', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin');
        } else if (req.session.user.role === 'judge') {
            return res.redirect('/judge');
        } else {
            return res.redirect('/leaderboard');
        }
    }
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Xử lý đăng nhập
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        req.session.user = user;
        if (user.role === 'admin') {
            res.redirect('/admin');
        } else if (user.role === 'judge') {
            res.redirect('/judge');
        } else {
            res.redirect('/leaderboard');
        }
    } else {
        res.redirect('/login?error=1');
    }
});

// Đăng xuất
app.get('/logout', (req, res) => {
    req.session.destroy();
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
app.get('/api/data', requireLogin, (req, res) => {
    const users = getUsers();
    const contest = getContestData();
    res.json({
        users: users.map(u => ({ username: u.username, role: u.role })),
        teams: contest.teams || [],
        candidates: contest.candidates || [],
        scores: contest.scores || []
    });
});

// Các route hiển thị trang giao diện
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/leaderboard', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/judge', requireLogin, (req, res) => {
    // Chỉ cho phép truy cập nếu là giám khảo hoặc admin
    if (req.session.user.role === 'judge' || req.session.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'judge.html'));
    } else {
        res.status(403).send('Chỉ Ban giám khảo mới có quyền truy cập trang này. <a href="/leaderboard">Về trang chủ</a>');
    }
});

// Xử lý tạo tài khoản mới (Hỗ trợ cả form submit truyền thống và AJAX)
app.post('/admin/add-user', requireAdmin, (req, res) => {
    const { username, password, role } = req.body;
    const users = getUsers();
    
    if (users.find(u => u.username === username)) {
        if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
            return res.status(400).json({ error: 'exists' });
        }
        return res.redirect('/admin?msg=exists');
    }
    
    users.push({ username, password, role });
    fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(users, null, 4));
    
    if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
        return res.json({ success: true });
    }
    res.redirect('/admin?msg=success');
});

// Xóa tài khoản
app.post('/admin/delete-user', requireAdmin, (req, res) => {
    const { username } = req.body;
    if (username === 'admin') {
        return res.status(400).json({ error: 'cannot_delete_admin' });
    }
    let users = getUsers();
    if (!users.find(u => u.username === username)) {
        return res.status(404).json({ error: 'not_found' });
    }
    users = users.filter(u => u.username !== username);
    fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(users, null, 4));
    
    // Đồng thời xóa điểm số liên quan đến giám khảo bị xóa (nếu là giám khảo)
    const contest = getContestData();
    contest.scores = contest.scores.filter(s => s.judge !== username);
    saveContestData(contest);
    
    res.json({ success: true });
});

// Thêm đội mentor mới
app.post('/admin/add-team', requireAdmin, (req, res) => {
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

    const contest = getContestData();
    const newTeam = {
        id: 'team_' + Date.now(),
        name,
        mentors
    };
    contest.teams.push(newTeam);
    saveContestData(contest);
    res.json({ success: true, team: newTeam });
});

// Xóa đội mentor
app.post('/admin/delete-team', requireAdmin, (req, res) => {
    const { teamId } = req.body;
    if (!teamId) {
        return res.status(400).json({ error: 'missing_id' });
    }
    const contest = getContestData();
    contest.teams = contest.teams.filter(t => t.id !== teamId);
    
    const candidatesToDelete = contest.candidates.filter(c => c.teamId === teamId);
    const candidateIdsToDelete = candidatesToDelete.map(c => c.id);
    
    contest.candidates = contest.candidates.filter(c => c.teamId !== teamId);
    contest.scores = contest.scores.filter(s => !candidateIdsToDelete.includes(s.candidateId));
    
    saveContestData(contest);
    res.json({ success: true });
});

// Thêm thí sinh (vào đội mentor)
app.post('/admin/add-candidate', requireAdmin, (req, res) => {
    const { name, teamId, sbd } = req.body;
    if (!name || !teamId) {
        return res.status(400).json({ error: 'missing_fields' });
    }
    const contest = getContestData();
    if (!contest.teams.find(t => t.id === teamId)) {
        return res.status(400).json({ error: 'team_not_found' });
    }
    const newCandidate = {
        id: 'candidate_' + Date.now(),
        name,
        sbd: sbd || '',
        teamId,
        kahoot: 0
    };
    contest.candidates.push(newCandidate);
    saveContestData(contest);
    res.json({ success: true, candidate: newCandidate });
});

// Xóa thí sinh
app.post('/admin/delete-candidate', requireAdmin, (req, res) => {
    const { candidateId } = req.body;
    if (!candidateId) {
        return res.status(400).json({ error: 'missing_id' });
    }
    const contest = getContestData();
    contest.candidates = contest.candidates.filter(c => c.id !== candidateId);
    contest.scores = contest.scores.filter(s => s.candidateId !== candidateId);
    saveContestData(contest);
    res.json({ success: true });
});

// Admin cập nhật điểm Kahoot cho thí sinh
app.post('/admin/update-kahoot', requireAdmin, (req, res) => {
    const { candidateId, kahoot } = req.body;
    const kahootVal = parseFloat(kahoot);
    if (!candidateId || isNaN(kahootVal) || kahootVal < 0 || kahootVal > 10) {
        return res.status(400).json({ error: 'invalid_data' });
    }
    const contest = getContestData();
    const cand = contest.candidates.find(c => c.id === candidateId);
    if (!cand) {
        return res.status(404).json({ error: 'candidate_not_found' });
    }
    cand.kahoot = kahootVal;
    saveContestData(contest);
    res.json({ success: true });
});

// Ban giám khảo chấm điểm / cập nhật điểm thí sinh (Bán kết: Áo dài, Truyền cảm hứng)
app.post('/judge/score', requireJudge, (req, res) => {
    const { candidateId, aoDai, inspiration, comment } = req.body;
    if (!candidateId) {
        return res.status(400).json({ error: 'missing_candidate_id' });
    }
    const judgeUsername = req.session.user.username;
    const contest = getContestData();
    
    const existingScoreIdx = contest.scores.findIndex(s => s.candidateId === candidateId && s.judge === judgeUsername);
    
    let currentScore = existingScoreIdx > -1 ? contest.scores[existingScoreIdx] : {
        judge: judgeUsername,
        candidateId,
        aoDai: 8.0,
        inspiration: 8.0,
        comment: ''
    };

    if (typeof aoDai !== 'undefined') {
        const val = parseFloat(aoDai);
        if (isNaN(val) || val < 0 || val > 10) return res.status(400).json({ error: 'invalid_aodai' });
        currentScore.aoDai = val;
    }
    
    if (typeof inspiration !== 'undefined') {
        const val = parseFloat(inspiration);
        if (isNaN(val) || val < 0 || val > 10) return res.status(400).json({ error: 'invalid_inspiration' });
        currentScore.inspiration = val;
    }
    
    if (typeof comment !== 'undefined') {
        currentScore.comment = comment;
    }

    if (existingScoreIdx > -1) {
        contest.scores[existingScoreIdx] = currentScore;
    } else {
        contest.scores.push(currentScore);
    }
    
    saveContestData(contest);
    res.json({ success: true });
});

// Admin import dữ liệu Đội & Thí sinh từ Excel
app.post('/admin/import-data', requireAdmin, (req, res) => {
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
        const contest = getContestData();

        // 1. Nhập Đội Mentor
        teams.forEach(newTeam => {
            let existingTeam = contest.teams.find(t => t.name.trim().toLowerCase() === newTeam.name.trim().toLowerCase());
            if (!existingTeam) {
                const teamId = 'team_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                const teamObj = {
                    id: teamId,
                    name: newTeam.name.trim(),
                    mentors: newTeam.mentors.map(m => m.trim()).filter(m => m !== '')
                };
                contest.teams.push(teamObj);
                newTeam.mappedId = teamId;
            } else {
                newTeam.mappedId = existingTeam.id;
                newTeam.mentors.forEach(m => {
                    const trimmedM = m.trim();
                    if (trimmedM !== '' && !existingTeam.mentors.map(x => x.toLowerCase()).includes(trimmedM.toLowerCase())) {
                        existingTeam.mentors.push(trimmedM);
                    }
                });
            }
        });

        // 2. Nhập Thí sinh
        candidates.forEach(newCand => {
            const teamRef = teams.find(t => t.name.trim().toLowerCase() === newCand.teamName.trim().toLowerCase());
            let targetTeamId = null;
            if (teamRef) {
                targetTeamId = teamRef.mappedId;
            } else {
                const existingTeam = contest.teams.find(t => t.name.trim().toLowerCase() === newCand.teamName.trim().toLowerCase());
                if (existingTeam) {
                    targetTeamId = existingTeam.id;
                }
            }

            if (targetTeamId) {
                const candNameLower = newCand.name.trim().toLowerCase();
                const existingCand = contest.candidates.find(c => c.teamId === targetTeamId && c.name.trim().toLowerCase() === candNameLower);
                
                if (!existingCand) {
                    contest.candidates.push({
                        id: 'candidate_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        name: newCand.name.trim(),
                        sbd: newCand.sbd ? String(newCand.sbd).trim() : '',
                        teamId: targetTeamId,
                        kahoot: 0
                    });
                } else {
                    if (newCand.sbd) {
                        existingCand.sbd = String(newCand.sbd).trim();
                    }
                }
            }
        });

        saveContestData(contest);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: 'invalid_json' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
