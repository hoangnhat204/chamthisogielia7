const fs = require('fs');
let html = fs.readFileSync('d:/chamdiemsogielia7/views/admin.html', 'utf8');

const oldLogic1 = `                    const validScores = dataToExport.filter(s => s.candidateId === cand.id && typeof s[type] !== 'undefined');
                    let sum = 0;
                    validScores.forEach(s => sum += s[type]);
                    const avg = validScores.length > 0 ? sum / validScores.length : 0;`;

const newLogic1 = `                    const validScores = dataToExport.filter(s => s.candidateId === cand.id && typeof s[type] !== 'undefined');
                    let sum = 0;
                    let count = validScores.length;
                    
                    if (type === 'thuThach' && count > 2) {
                        const raw = validScores.map(s => s[type]).sort((a,b) => a-b);
                        sum = raw.slice(1, -1).reduce((a,b) => a+b, 0);
                        count -= 2;
                    } else {
                        validScores.forEach(s => sum += s[type]);
                    }
                    
                    const avg = count > 0 ? sum / count : 0;`;

const oldLogic2 = `                const avgScore = count > 0 ? (sum / count) : null;`;

const newLogic2 = `                let avgScore = null;
                if (count > 0) {
                    if (type === 'thuThach' && count > 2) {
                        const raw = validScores.map(s => s[type]).sort((a,b) => a-b);
                        const trimmedSum = raw.slice(1, -1).reduce((a,b) => a+b, 0);
                        avgScore = trimmedSum / (count - 2);
                    } else {
                        avgScore = sum / count;
                    }
                }`;

html = html.replace(oldLogic1, newLogic1);
html = html.replace(oldLogic2, newLogic2);

fs.writeFileSync('d:/chamdiemsogielia7/views/admin.html', html);
console.log('Update successful');
