// --- DEĞİŞKENLER ---
let currentUser = null;
let userData = {};
let logs = [];
let chartInstance = null;
let currentEditingDay = null;

// --- SAYFA YÜKLENDİĞİNDE (OTO GİRİŞ & HATIRLAMA) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Durum: Otomatik Giriş (Aktif Oturum Varsa)
    const activeUser = localStorage.getItem('patron_active_user');
    
    // 2. Durum: Son Girilen Kullanıcı Adı (Çıkış Yapılmışsa bile hatırla)
    const rememberedName = localStorage.getItem('patron_remember_name');

    if (activeUser) {
        // Oturum açıksa direkt gir
        currentUser = activeUser;
        loadUserAndStart();
    } else if (rememberedName) {
        // Oturum kapalı ama isim hafızada ise kutuya yaz
        document.getElementById('username').value = rememberedName;
    }
});

// --- GİRİŞ & AUTH ---
function login() {
    const u = document.getElementById('username').value.trim();
    if (!u) return alert("İsim girmedin Patron!");

    currentUser = u;
    
    // İsmi sonsuza kadar hatırla (Beni Hatırla)
    localStorage.setItem('patron_remember_name', u);
    
    // Aktif oturumu başlat
    localStorage.setItem('patron_active_user', u);

    loadUserAndStart();
}

function loadUserAndStart() {
    // Verileri çek
    userData = JSON.parse(localStorage.getItem('patron_user_v6_' + currentUser)) || { setupComplete: false };
    logs = JSON.parse(localStorage.getItem('patron_logs_v6')) || [];

    document.getElementById('login-screen').style.display = 'none';

    if (userData.setupComplete === false) {
        document.getElementById('setup-name').innerText = currentUser;
        document.getElementById('setup-wizard').style.display = 'flex';
    } else {
        initApp();
    }
}

function logout() {
    // Sadece "otomatik girişi" durduruyoruz
    localStorage.removeItem('patron_active_user');
    
    // Ama "remember_name" silinmiyor, yani adın kutuda kalacak.
    location.reload();
}

// --- SETUP ---
function finishSetup() {
    const days = parseInt(document.getElementById('days-select').value);
    
    let defaultProgram = {};
    for (let i = 1; i <= days; i++) {
        defaultProgram[i] = { 
            title: i + ". Gün", 
            content: "Programını düzenle...", 
            isRest: false 
        };
    }

    userData = {
        setupComplete: true,
        daysPerWeek: days,
        program: defaultProgram,
        profile: { height: '', weight: '', phone: '', email: '', photo: '' },
        water: { date: new Date().toDateString(), amount: 0 }
    };

    saveUserData();
    document.getElementById('setup-wizard').style.display = 'none';
    initApp();
}

function saveUserData() {
    localStorage.setItem('patron_user_v6_' + currentUser, JSON.stringify(userData));
}

function initApp() {
    document.getElementById('app').style.display = 'block';
    document.getElementById('header-user').innerText = currentUser.toUpperCase();
    
    if (userData.program) renderCards();
    loadProfileUI(); 
    checkWaterDate();
    initChart();
}

// --- PROGRAM KARTLARI ---
function renderCards() {
    const container = document.getElementById('cards-wrapper');
    container.innerHTML = "";
    Object.keys(userData.program).forEach(key => {
        const day = userData.program[key];
        const card = document.createElement('div');
        if (day.isRest) {
            card.className = 'day-card rest-mode';
            card.innerHTML = `<h3>OFF</h3><span>Dinlenme</span>`;
        } else {
            card.className = 'day-card';
            card.innerHTML = `<h3>${day.title}</h3><span>Antrenman</span>`;
        }
        card.onclick = () => openModal(key);
        container.appendChild(card);
    });
}

// --- MODAL ---
function openModal(key) {
    currentEditingDay = key;
    const data = userData.program[key];
    document.getElementById('modal-title').innerText = data.title;
    document.getElementById('modal-desc').innerText = data.content || "";
    
    if (data.isRest) {
        document.getElementById('rest-badge').style.display = 'block';
        document.getElementById('modal-desc').style.opacity = '0.5';
    } else {
        document.getElementById('rest-badge').style.display = 'none';
        document.getElementById('modal-desc').style.opacity = '1';
    }

    document.getElementById('view-mode').style.display = 'block';
    document.getElementById('edit-mode').style.display = 'none';
    document.getElementById('program-modal').style.display = 'flex';
}

function closeModal() { document.getElementById('program-modal').style.display = 'none'; }

function toggleEditMode() {
    const view = document.getElementById('view-mode');
    const edit = document.getElementById('edit-mode');
    const data = userData.program[currentEditingDay];

    if (view.style.display !== 'none') {
        view.style.display = 'none';
        edit.style.display = 'block';
        document.getElementById('edit-title-input').value = data.title;
        document.getElementById('edit-desc-input').value = data.content;
        document.getElementById('is-rest-check').checked = data.isRest || false;
    } else {
        view.style.display = 'block';
        edit.style.display = 'none';
    }
}

function saveProgramChanges() {
    const newTitle = document.getElementById('edit-title-input').value;
    const newContent = document.getElementById('edit-desc-input').value;
    const isRest = document.getElementById('is-rest-check').checked;

    userData.program[currentEditingDay] = { title: newTitle, content: newContent, isRest: isRest };
    saveUserData();
    renderCards();
    openModal(currentEditingDay);
}

// --- GELİŞMİŞ ANALİZ ---
function renderSetInputs() {
    const count = parseInt(document.getElementById('log-set-count').value);
    const container = document.getElementById('dynamic-sets-container');
    container.innerHTML = "";
    if (!count || count < 1) return;

    for (let i = 1; i <= count; i++) {
        container.innerHTML += `
            <div class="set-row">
                <span class="set-label">SET ${i}</span>
                <input type="number" class="set-input set-kg" placeholder="KG">
                <input type="number" class="set-input set-rep" placeholder="Tekrar">
            </div>
        `;
    }
}

function logDetailedData() {
    const ex = document.getElementById('log-exercise').value;
    const setInputs = document.querySelectorAll('.set-row');
    if (!ex || setInputs.length === 0) return alert("Eksik bilgi Patron!");

    let max1RM = 0;
    let totalVol = 0;
    let avgRep = 0;
    let totalReps = 0;

    setInputs.forEach(row => {
        const kg = parseFloat(row.querySelector('.set-kg').value) || 0;
        const rep = parseFloat(row.querySelector('.set-rep').value) || 0;
        if (kg > 0 && rep > 0) {
            totalVol += (kg * rep);
            totalReps += rep;
            const epley = kg * (1 + (rep / 30));
            if (epley > max1RM) max1RM = epley;
        }
    });

    if (totalReps > 0) avgRep = totalReps / setInputs.length;

    const entry = {
        user: currentUser,
        exercise: ex,
        estimated1RM: parseFloat(max1RM.toFixed(1)),
        volume: totalVol,
        avgRep: Math.round(avgRep),
        date: new Date().toLocaleDateString('tr-TR'),
        ts: Date.now()
    };

    logs.push(entry);
    localStorage.setItem('patron_logs_v6', JSON.stringify(logs));
    
    document.getElementById('dynamic-sets-container').innerHTML = "";
    document.getElementById('log-set-count').value = "";
    
    analyzeAndVisualize(ex, entry);
}

function analyzeAndVisualize(exerciseName, current) {
    document.getElementById('analysis-box').style.display = 'block';
    
    const history = logs.filter(l => l.user === currentUser && l.exercise.toLowerCase() === exerciseName.toLowerCase() && l.ts < current.ts);
    const prev = history.length > 0 ? history[history.length - 1] : null;

    document.getElementById('res-1rm').innerText = current.estimated1RM + " kg";
    document.getElementById('res-vol').innerText = current.volume + " kg";

    let feedback = "";
    if (prev) {
        const diff = (current.estimated1RM - prev.estimated1RM).toFixed(1);
        if (diff > 0) feedback += `<span style="color:#10b981">Güç Artışı! 1RM değerin ${diff}kg arttı.</span><br>`;
        else if (diff < 0) feedback += `<span style="color:#ef4444">Güç düşüşü var. Toparlanmaya dikkat.</span><br>`;
        else feedback += `<span style="color:#facc15">Gücünü koruyorsun.</span><br>`;
    }

    if (current.avgRep >= 1 && current.avgRep <= 5) feedback += "Hedef: Saf Güç (Strength).";
    else if (current.avgRep >= 6 && current.avgRep <= 12) feedback += "Hedef: Hipertrofi (Büyüme).";
    else feedback += "Hedef: Dayanıklılık.";

    document.getElementById('engine-result').innerHTML = feedback;
    updateChart(exerciseName);
}

function updateChart(exerciseName) {
    const history = logs.filter(l => l.user === currentUser && l.exercise.toLowerCase() === exerciseName.toLowerCase()).sort((a,b) => a.ts - b.ts);
    const labels = history.map(h => h.date);
    const data = history.map(h => h.estimated1RM);

    const ctx = document.getElementById('progressChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(124, 58, 237, 0.5)'); 
    gradient.addColorStop(1, 'rgba(124, 58, 237, 0)');

    chartInstance.data.labels = labels;
    chartInstance.data.datasets = [{
        label: 'Tahmini 1RM Gücü',
        data: data,
        borderColor: '#7c3aed',
        backgroundColor: gradient,
        borderWidth: 3,
        pointBackgroundColor: '#fff',
        pointRadius: 4,
        fill: true,
        tension: 0.4
    }];
    chartInstance.update();
}

function initChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#222' }, ticks: { color: '#666' } },
                x: { grid: { display: false }, ticks: { color: '#666' } }
            }
        }
    });
}

// --- PROFİL & RESİM YÜKLEME ---
function saveProfileData() {
    userData.profile.height = document.getElementById('p-height').value;
    userData.profile.weight = document.getElementById('p-weight').value;
    userData.profile.phone = document.getElementById('p-phone').value;
    userData.profile.email = document.getElementById('p-email').value;
    saveUserData();
    
    if (userData.profile.height && userData.profile.weight) {
        const h = userData.profile.height / 100;
        const bmi = (userData.profile.weight / (h * h)).toFixed(1);
        document.getElementById('bmi-text').innerText = `BMI Skoru: ${bmi}`;
    }
    alert("Profil Güncellendi Patron");
}

function loadProfileUI() {
    if (userData.profile.photo) {
        document.getElementById('profile-display').src = userData.profile.photo;
        document.getElementById('header-avatar').innerHTML = `<img src="${userData.profile.photo}">`;
    }
    
    if (userData.profile.height) document.getElementById('p-height').value = userData.profile.height;
    if (userData.profile.weight) document.getElementById('p-weight').value = userData.profile.weight;
    if (userData.profile.phone) document.getElementById('p-phone').value = userData.profile.phone;
    if (userData.profile.email) document.getElementById('p-email').value = userData.profile.email;
}

function uploadPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            userData.profile.photo = base64;
            saveUserData();
            document.getElementById('profile-display').src = base64;
            document.getElementById('header-avatar').innerHTML = `<img src="${base64}">`;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// Su
function checkWaterDate() {
    const today = new Date().toDateString();
    if (userData.water.date !== today) {
        userData.water.date = today;
        userData.water.amount = 0;
        saveUserData();
    }
    updateWaterUI();
}
function addWater(ml) {
    userData.water.amount += ml;
    saveUserData();
    updateWaterUI();
}
function updateWaterUI() {
    const p = Math.min((userData.water.amount / 3000) * 100, 100);
    document.getElementById('water-fill').style.width = p + "%";
    document.getElementById('water-amount').innerText = userData.water.amount;
}
function switchTab(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
}
