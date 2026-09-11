(() => {
  'use strict';
  // MB Gestor Premium V8.2 Luxury

  const APP_VERSION = '8.2.2';
  const STORAGE_KEY = 'mb_gestor_premium_v1';
  const DEFAULT_STATE = {
    version: 1,
    students: [],
    expenses: [],
    payments: [],
    schedule: {},
    attendance: {},
    makeups: {},
    reminderDrafts: [],
    birthdayNotifications: {},
    settings: {
      studioName: 'Studio Márcio Bueno',
      trainerName: 'Márcio Bueno',
      chargeDaysBefore: 3,
      currency: 'BRL',
      financialValuesVisible: false
    }
  };

  const NAV = [
    {id:'dashboard', label:'Início', icon:'home', title:'Visão geral'},
    {id:'students', label:'Alunos', icon:'users', title:'Alunos'},
    {id:'finance', label:'Financeiro', icon:'wallet', title:'Financeiro'},
    {id:'charges', label:'Cobranças', icon:'bell', title:'Cobranças'},
    {id:'reminders', label:'Lembretes', icon:'message', title:'Lembretes e WhatsApp'},
    {id:'consent', label:'Termos', icon:'file', title:'Termos de consentimento'},
    {id:'schedule', label:'Agenda', icon:'calendar', title:'Agenda semanal'},
    {id:'settings', label:'Ajustes', icon:'settings', title:'Ajustes'}
  ];

  let state = loadState();
  let currentView = 'dashboard';
  let deferredInstallPrompt = null;
  let financeTab = 'summary';
  let chargeTab = 'all';
  let studentFilter = 'all';
  let scheduleCompact = false;
  let selectedScheduleDay = ({1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'}[new Date().getDay()] || 'mon');
  // Privacidade persistente: o app lembra se os valores ficaram ocultos ou visíveis.
  let financialValuesVisible = Boolean(state.settings?.financialValuesVisible);

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const viewEl = $('#view');
  const pageTitle = $('#pageTitle');
  const modalRoot = $('#modalRoot');
  const toastRoot = $('#toastRoot');

  function uid(prefix='id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        students: Array.isArray(parsed.students) ? parsed.students : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        payments: Array.isArray(parsed.payments) ? parsed.payments : [],
        schedule: (parsed.schedule && typeof parsed.schedule === 'object') ? parsed.schedule : {},
        attendance: (parsed.attendance && typeof parsed.attendance === 'object') ? parsed.attendance : {},
        makeups: (parsed.makeups && typeof parsed.makeups === 'object') ? parsed.makeups : {},
        reminderDrafts: Array.isArray(parsed.reminderDrafts) ? parsed.reminderDrafts : [],
        birthdayNotifications: (parsed.birthdayNotifications && typeof parsed.birthdayNotifications === 'object') ? parsed.birthdayNotifications : {},
        settings: {...DEFAULT_STATE.settings, ...(parsed.settings || {})}
      };
    } catch (err) {
      console.error('Falha ao carregar dados', err);
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function escapeHTML(value='') {
    return String(value)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function icon(name) {
    return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function parseLocalDate(value) {
    if (!value) return null;
    const [y,m,d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m-1, d, 12, 0, 0, 0);
  }

  function todayNoon() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0);
  }

  function isoToday() {
    const d = todayNoon();
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }

  function fmtDate(value) {
    const d = parseLocalDate(value);
    return d ? new Intl.DateTimeFormat('pt-BR').format(d) : '—';
  }

  function fmtMoney(value) {
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:state.settings.currency || 'BRL'}).format(Number(value)||0);
  }

  function privateMoney(value) { return financialValuesVisible ? fmtMoney(value) : 'R$ •••••'; }
  function toggleFinancialVisibility() { financialValuesVisible=!financialValuesVisible; state.settings.financialValuesVisible=financialValuesVisible; saveState(); render(); }

  function ageFromBirth(value) {
    const birth = parseLocalDate(value);
    if (!birth) return null;
    const now = todayNoon();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return Math.max(0, age);
  }


  function studioTime(value) {
    const start=parseLocalDate(value); if(!start) return '—';
    const now=todayNoon(); if(start>now) return 'Ainda não iniciou';
    let years=now.getFullYear()-start.getFullYear();
    let months=now.getMonth()-start.getMonth();
    if(now.getDate()<start.getDate()) months--;
    if(months<0){years--;months+=12;}
    const parts=[];
    if(years) parts.push(`${years} ano${years===1?'':'s'}`);
    if(months) parts.push(`${months} ${months===1?'mês':'meses'}`);
    return parts.length?parts.join(' e '):'Menos de 1 mês';
  }

  function birthdayInfo(s) {
    const b=parseLocalDate(s.birthDate); if(!b) return null;
    const now=todayNoon();
    let next=new Date(now.getFullYear(),b.getMonth(),b.getDate(),12);
    if(next<now) next=new Date(now.getFullYear()+1,b.getMonth(),b.getDate(),12);
    return {days:Math.round((next-now)/86400000), next};
  }

  function birthdayStudents(maxDays=7){
    return activeStudents().map(s=>({s,info:birthdayInfo(s)}))
      .filter(x=>x.info && x.info.days<=maxDays).sort((a,b)=>a.info.days-b.info.days);
  }

  const SCHEDULE_DAYS=[
    {id:'mon',label:'Segunda'},{id:'tue',label:'Terça'},{id:'wed',label:'Quarta'},
    {id:'thu',label:'Quinta'},{id:'fri',label:'Sexta'}
  ];
  const WEEK_HOURS=['06:00','07:00','08:00','09:00','16:00','17:00','18:00','19:00'];
  const FRIDAY_HOURS=['06:00','07:00','08:00','09:00','10:00'];
  function scheduleHours(day){return day==='fri'?FRIDAY_HOURS:WEEK_HOURS}
  function slotKey(day,time){return `${day}_${time}`}
  function slotStudents(day,time){return Array.isArray(state.schedule?.[slotKey(day,time)])?state.schedule[slotKey(day,time)]:[]}

  function isoDate(d){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
  function addDays(date,days){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);d.setDate(d.getDate()+days);return d}
  function mondayOf(date=todayNoon()){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);const wd=d.getDay()||7;d.setDate(d.getDate()-wd+1);return d}
  let scheduleWeekStart=mondayOf();
  function scheduleDateForDay(day){const idx=SCHEDULE_DAYS.findIndex(d=>d.id===day);return isoDate(addDays(scheduleWeekStart,Math.max(0,idx)))}
  function attendanceKey(date,day,time){return `${date}__${slotKey(day,time)}`}
  function attendanceMap(date,day,time){return state.attendance?.[attendanceKey(date,day,time)]||{}}
  function attendanceStatus(date,day,time,studentId){return attendanceMap(date,day,time)[studentId]||''}
  function setAttendance(date,day,time,studentId,status){state.attendance=state.attendance||{};const k=attendanceKey(date,day,time);state.attendance[k]=state.attendance[k]||{};if(status)state.attendance[k][studentId]=status;else delete state.attendance[k][studentId];saveState()}
  function monthLabel(key){if(!/^\d{4}-\d{2}$/.test(key))return key;const [y,m]=key.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1,12))}
  function monthlyAttendanceCount(studentId,mk=monthKey()){let count=0;Object.entries(state.attendance||{}).forEach(([k,map])=>{const date=k.slice(0,10);if(date.startsWith(mk)&&map&&map[studentId]==='present')count++});return count}

  function monthlyAttendanceStats(studentId,mk=monthKey()){
    let present=0, absent=0, makeups=0;
    Object.entries(state.attendance||{}).forEach(([k,map])=>{
      const date=k.slice(0,10); if(!date.startsWith(mk)||!map) return;
      if(map[studentId]==='present') present++;
      if(map[studentId]==='absent') absent++;
      if(state.makeups?.[k]===studentId && map[studentId]==='present') makeups++;
    });
    return {present,absent,makeups};
  }

  function attendanceHistory(studentId){
    const rows=[];
    Object.entries(state.attendance||{}).forEach(([k,map])=>{
      if(!map || !map[studentId]) return;
      const date=k.slice(0,10), parts=k.split('__'), slot=(parts[1]||'').split('_');
      rows.push({date,status:map[studentId],isMakeup:state.makeups?.[k]===studentId,time:slot.slice(1).join('_').replace('-',':')||''});
    });
    return rows.sort((a,b)=>b.date.localeCompare(a.date));
  }

  function birthdaysThisMonth(){
    const m=todayNoon().getMonth();
    return state.students.filter(s=>{const b=parseLocalDate(s.birthDate);return b&&b.getMonth()===m;}).sort((a,b)=>parseLocalDate(a.birthDate).getDate()-parseLocalDate(b.birthDate).getDate());
  }

  function occupancyStats(){
    const slots=[];SCHEDULE_DAYS.forEach(d=>scheduleHours(d.id).forEach(time=>{const ids=slotStudents(d.id,time);slots.push({day:d.id,label:d.label,time,count:ids.length});}));
    const totalCapacity=slots.length*4,used=slots.reduce((a,x)=>a+x.count,0),full=slots.filter(x=>x.count>=4).length,empty=slots.filter(x=>x.count===0).length,percent=totalCapacity?Math.round(used/totalCapacity*100):0;
    return {slots,totalCapacity,used,full,empty,percent,busiest:[...slots].sort((a,b)=>b.count-a.count||a.time.localeCompare(b.time)).slice(0,5)};
  }

  function makeupSummary(){
    const now=todayNoon(), end=addDays(now,7), mk=monthKey();
    let scheduledNext7=0, completedMonth=0;
    Object.entries(state.makeups||{}).forEach(([k,studentId])=>{
      if(!studentId) return;
      const dateStr=k.slice(0,10), d=parseLocalDate(dateStr);
      if(d && d>=now && d<=end) scheduledNext7++;
      if(dateStr.startsWith(mk) && state.attendance?.[k]?.[studentId]==='present') completedMonth++;
    });
    return {scheduledNext7,completedMonth};
  }

  function paymentsByMonth(){
    const groups={};
    state.payments.forEach(p=>{const mk=monthKey(p.date); if(!mk)return; (groups[mk] ||= []).push(p)});
    return Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0]));
  }

  function daysBetween(a,b) {
    const one = parseLocalDate(a);
    const two = b instanceof Date ? b : parseLocalDate(b);
    if (!one || !two) return 99999;
    return Math.round((one-two)/86400000);
  }

  function dueInfo(student) {
    const days = daysBetween(student.dueDate, todayNoon());
    if (days < 0) return {key:'overdue', cls:'danger', text:`Vencida há ${Math.abs(days)} dia${Math.abs(days)===1?'':'s'}`, days};
    if (days === 0) return {key:'today', cls:'warn', text:'Vence hoje', days};
    if (days <= Number(state.settings.chargeDaysBefore || 3)) return {key:'soon', cls:'warn', text:`Vence em ${days} dia${days===1?'':'s'}`, days};
    return {key:'ok', cls:'ok', text:`Em dia • ${fmtDate(student.dueDate)}`, days};
  }

  function activeStudents() {
    return state.students.filter(s => s.active !== false);
  }

  function monthKey(dateValue) {
    const d = dateValue ? parseLocalDate(dateValue) : todayNoon();
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function metrics() {
    const students = activeStudents();
    const expected = students.reduce((a,s)=>a+(Number(s.monthlyFee)||0),0);
    const mk = monthKey();
    const monthPayments = state.payments.filter(p=>monthKey(p.date)===mk);
    const received = monthPayments.reduce((a,p)=>a+(Number(p.amount)||0),0);

    // V6.3: a divisão PIX/Dinheiro segue SEMPRE a forma de pagamento
    // preferencial atual da ficha do aluno. Também aceita registros legados
    // que tenham salvo "Dinheiro"/"PIX" por extenso.
    const normalizePaymentMethod = (value) => {
      const v = String(value || '').trim().toLowerCase();
      if (v === 'cash' || v === 'dinheiro') return 'cash';
      if (v === 'pix') return 'pix';
      return '';
    };
    const paymentMethodFor = (p) => {
      const student = state.students.find(s=>String(s.id)===String(p.studentId));
      const preferred = normalizePaymentMethod(student?.paymentMethod);
      if (preferred) return preferred;
      const legacy = normalizePaymentMethod(p.paymentMethod);
      if (legacy) return legacy;
      // Mantém a conciliação: todo recebimento sem classificação conhecida
      // continua compondo o total e entra provisoriamente em PIX.
      return 'pix';
    };

    const pix = monthPayments.reduce((sum,p)=>sum+(paymentMethodFor(p)==='pix'?(Number(p.amount)||0):0),0);
    const cash = monthPayments.reduce((sum,p)=>sum+(paymentMethodFor(p)==='cash'?(Number(p.amount)||0):0),0);
    // V7: potencial de recebimento por forma preferencial, independente de pagamento realizado.
    const potentialPix = students.filter(s=>s.paymentMethod!=='cash').reduce((a,s)=>a+(Number(s.monthlyFee)||0),0);
    const potentialCash = students.filter(s=>s.paymentMethod==='cash').reduce((a,s)=>a+(Number(s.monthlyFee)||0),0);
    const remainingPix = Math.max(0, potentialPix-pix);
    const remainingCash = Math.max(0, potentialCash-cash);
    const remainingTotal = Math.max(0, expected-received);
    const expenses = state.expenses.filter(e=>monthKey(e.date)===mk).reduce((a,e)=>a+(Number(e.amount)||0),0);
    const overdueStudents = students.filter(s=>dueInfo(s).key==='overdue');
    const overdue = overdueStudents.length;
    const overdueValue = overdueStudents.reduce((a,s)=>a+(Number(s.monthlyFee)||0),0);
    const soon = students.filter(s=>['today','soon'].includes(dueInfo(s).key)).length;
    const makeups = makeupSummary();
    return {students:students.length, expected, received, pix, cash, potentialPix, potentialCash, remainingPix, remainingCash, remainingTotal, expenses, net:received-expenses, overdue, overdueValue, soon, makeups};
  }

  const MOBILE_NAV_IDS=['dashboard','schedule','students','finance'];
  const MORE_NAV_IDS=['charges','reminders','consent','settings'];

  function renderNav() {
    const desktop = $('#desktopNav');
    const mobile = $('#mobileNav');
    desktop.innerHTML = NAV.map(n=>navButton(n)).join('');
    const primary=MOBILE_NAV_IDS.map(id=>NAV.find(n=>n.id===id)).filter(Boolean);
    mobile.innerHTML = primary.map(n=>navButton(n)).join('') + `<button class="nav-btn ${MORE_NAV_IDS.includes(currentView)?'active':''}" id="mobileMore" type="button">${icon('more')}<span>Mais</span></button>`;
    $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
    $('#mobileMore')?.addEventListener('click',openMoreMenu);
  }

  function navButton(n) {
    return `<button class="nav-btn ${currentView===n.id?'active':''}" data-nav="${n.id}" type="button">${icon(n.icon)}<span>${n.label}</span></button>`;
  }

  function openMoreMenu(){
    const items=MORE_NAV_IDS.map(id=>NAV.find(n=>n.id===id)).filter(Boolean);
    openModal('Mais opções',`<div class="more-menu-grid">${items.map(n=>`<button type="button" class="more-menu-item" data-more-nav="${n.id}"><span class="more-menu-icon">${icon(n.icon)}</span><span><strong>${n.label}</strong><small>${n.title}</small></span></button>`).join('')}</div>`);
    $$('[data-more-nav]',modalRoot).forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.moreNav;closeModal();navigate(id)}));
  }

  function navigate(id) {
    currentView = NAV.some(n=>n.id===id) ? id : 'dashboard';
    const item = NAV.find(n=>n.id===currentView);
    pageTitle.textContent = item?.title || 'MB Gestor';
    renderNav();
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function render() {
    const renderer = {
      dashboard: renderDashboard,
      students: renderStudents,
      finance: renderFinance,
      charges: renderCharges,
      reminders: renderReminders,
      consent: renderConsent,
      schedule: renderSchedule,
      settings: renderSettings
    }[currentView] || renderDashboard;
    renderer();
  }

  function metricCard(iconName, value, label, cls='') {
    return `<article class="metric ${cls}"><div class="metric-icon">${icon(iconName)}</div><div class="value">${value}</div><div class="label">${label}</div></article>`;
  }

  function greetingText(){
    const h=new Date().getHours();
    return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  }

  function todayStudioSummary(){
    const now=todayNoon(), jsDay=now.getDay();
    const dayId={1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'}[jsDay]||'';
    const date=isoToday();
    let classes=0, fixedStudents=0, makeups=0, present=0, absent=0;
    if(dayId){
      scheduleHours(dayId).forEach(time=>{
        const fixed=slotStudents(dayId,time);
        const k=attendanceKey(date,dayId,time);
        const makeupId=state.makeups?.[k];
        if(fixed.length||makeupId) classes++;
        fixedStudents+=fixed.length;
        if(makeupId) makeups++;
        const map=state.attendance?.[k]||{};
        present+=Object.values(map).filter(v=>v==='present').length;
        absent+=Object.values(map).filter(v=>v==='absent').length;
      });
    }
    const attention=activeStudents().filter(s=>dueInfo(s).days<=Number(state.settings.chargeDaysBefore||3)).length;
    return {dayId,classes,fixedStudents,makeups,present,absent,attention};
  }

  function renderDashboard() {
    const m=metrics(), today=todayStudioSummary();
    const upcoming=activeStudents().map(s=>({s,info:dueInfo(s)})).filter(x=>x.info.days<=7).sort((a,b)=>a.info.days-b.info.days).slice(0,6);
    const firstName=(state.settings.trainerName||'Márcio').trim().split(/\s+/)[0];
    viewEl.innerHTML=`
      <section class="hero luxury-hero">
        <div class="luxury-glow"></div>
        <div class="hero-grid">
          <div class="hero-copy">
            <span class="badge">MB Gestor • Private Edition</span>
            <p class="luxury-kicker">${greetingText()}, ${escapeHTML(firstName)}</p>
            <h2>Seu Studio.<br><em>Sob controle.</em></h2>
            <p>Uma visão elegante e objetiva do que importa hoje.</p>
            <div class="hero-actions"><button class="btn btn-primary btn-small" data-nav="schedule">${icon('calendar')} Ver agenda</button><button class="btn btn-ghost btn-small" data-nav="students">${icon('users')} Alunos</button></div>
          </div>
          <div class="luxury-logo-wrap"><img class="hero-logo" src="assets/logo-interna.jpg" alt="Identidade Márcio Bueno Personal Trainer" /><span>PREMIUM</span></div>
        </div>
      </section>

      <div class="section-head luxury-section-head"><div><span class="section-overline">HOJE</span><h3>Resumo do dia</h3><p>${today.dayId?'Agenda, alunos e pendências em um único olhar':'Hoje não há grade fixa de aulas.'}</p></div><span class="live-dot">Atual</span></div>
      <section class="today-grid">
        <article class="today-card actionable" data-nav="schedule"><div class="today-icon">${icon('calendar')}</div><div><strong>${today.classes}</strong><span>Aulas hoje</span><small>${today.fixedStudents} aluno${today.fixedStudents===1?'':'s'} previsto${today.fixedStudents===1?'':'s'}</small></div></article>
        <article class="today-card actionable" data-nav="schedule"><div class="today-icon">${icon('check')}</div><div><strong>${today.present}</strong><span>Presenças</span><small>${today.absent} falta${today.absent===1?'':'s'} registrada${today.absent===1?'':'s'}</small></div></article>
        <article class="today-card actionable" data-nav="schedule"><div class="today-icon">${icon('users')}</div><div><strong>${today.makeups}</strong><span>Reposições</span><small>Agendadas para hoje</small></div></article>
        <article class="today-card actionable ${today.attention?'attention':''}" data-nav="charges"><div class="today-icon">${icon('bell')}</div><div><strong>${today.attention}</strong><span>Financeiro</span><small>Mensalidades que pedem atenção</small></div></article>
      </section>

      ${(today.attention||today.makeups||birthdayStudents(7).length)?`<section class="attention-hub"><div class="attention-hub-head"><span>${icon('bell')}</span><div><strong>Atenção</strong><small>O que merece uma ação rápida</small></div></div><div class="attention-hub-items">${today.attention?`<button data-nav="charges"><strong>${today.attention}</strong><span>mensalidade${today.attention===1?'':'s'} para acompanhar</span></button>`:''}${today.makeups?`<button data-nav="schedule"><strong>${today.makeups}</strong><span>reposição${today.makeups===1?'':'ões'} hoje</span></button>`:''}${birthdayStudents(7).length?`<button data-nav="students"><strong>${birthdayStudents(7).length}</strong><span>aniversário${birthdayStudents(7).length===1?'':'s'} em até 7 dias</span></button>`:''}</div></section>`:''}

      <section class="metrics luxury-metrics">
        ${metricCard('users',m.students,'Alunos ativos')}
        ${metricCard('wallet',privateMoney(m.expected),'Receita prevista')}
        ${metricCard('chart',privateMoney(m.received),'Recebido no mês','good')}
        ${metricCard('bell',m.overdue,'Mensalidades vencidas',m.overdue?'danger':'good')}
      </section>

      <div class="section-head luxury-section-head"><div><span class="section-overline">PERFORMANCE</span><h3>Saúde do Studio</h3><p>Indicadores que merecem sua atenção</p></div></div>
      <section class="cards grid2 luxury-panels">
        <article class="card"><div class="premium-card-title"><span>Financeiro</span>${icon('wallet')}</div><div class="list-row"><div class="list-main"><strong>A receber no mês</strong><span>Previsto menos recebido</span></div><strong>${privateMoney(m.remainingTotal)}</strong></div><div class="list-row"><div class="list-main"><strong>Valor vencido</strong><span>${m.overdue} mensalidade${m.overdue===1?'':'s'} vencida${m.overdue===1?'':'s'}</span></div><strong class="${m.overdue?'money-negative':''}">${privateMoney(m.overdueValue)}</strong></div></article>
        <article class="card"><div class="premium-card-title"><span>Agenda</span>${icon('calendar')}</div><div class="list-row"><div class="list-main"><strong>Reposições próximas</strong><span>Próximos 7 dias</span></div><strong>${m.makeups.scheduledNext7}</strong></div><div class="list-row"><div class="list-main"><strong>Realizadas no mês</strong><span>Contabilizadas como presença</span></div><strong>${m.makeups.completedMonth}</strong></div></article>
      </section>

      <div class="section-head luxury-section-head"><div><span class="section-overline">FINANCEIRO</span><h3>Visão financeira</h3><p>Mês atual</p></div><div class="privacy-actions"><button class="mini-icon" id="toggleFinancePrivacy" type="button" title="Mostrar ou ocultar valores">${icon(financialValuesVisible?'eye-off':'eye')}</button><button class="btn btn-secondary btn-small" data-nav="finance">Detalhes</button></div></div>
      <section class="finance-grid luxury-finance">
        <article class="card highlight"><div class="premium-card-title"><span>Fluxo do mês</span><span class="gold-mark">MB</span></div><div class="list-row"><div class="list-main"><strong>Receitas recebidas</strong><span>Pagamentos registrados</span></div><strong class="money-positive">${privateMoney(m.received)}</strong></div><div class="list-row"><div class="list-main"><strong>Gastos</strong><span>Despesas cadastradas</span></div><strong class="money-negative">${privateMoney(m.expenses)}</strong></div><div class="list-row balance-row"><div class="list-main"><strong>Saldo do mês</strong><span>Receitas menos gastos</span></div><strong class="${m.net>=0?'money-positive':'money-negative'}">${privateMoney(m.net)}</strong></div></article>
        <article class="card"><div class="premium-card-title"><span>Recebimentos</span>${icon('chart')}</div><div class="list-row"><div class="list-main"><strong>Mensalidades vencidas</strong><span>Precisam de atenção</span></div><span class="status ${m.overdue?'danger':'ok'}">${m.overdue}</span></div><div class="list-row"><div class="list-main"><strong>Vencendo em breve</strong><span>Próximos ${state.settings.chargeDaysBefore} dias</span></div><span class="status ${m.soon?'warn':'ok'}">${m.soon}</span></div><div class="list-row"><div class="list-main"><strong>Potencial PIX</strong><span>Base ativa</span></div><strong>${privateMoney(m.potentialPix)}</strong></div><div class="list-row"><div class="list-main"><strong>Potencial dinheiro</strong><span>Base ativa</span></div><strong>${privateMoney(m.potentialCash)}</strong></div></article>
      </section>
      ${renderBirthdayPanel()}
      <div class="section-head luxury-section-head"><div><span class="section-overline">PRÓXIMOS DIAS</span><h3>Vencimentos</h3><p>Até 7 dias e mensalidades já vencidas</p></div><button class="btn btn-primary btn-small" id="quickAddStudent">${icon('plus')} Novo aluno</button></div>
      <section class="cards">${upcoming.length?upcoming.map(({s,info})=>chargeMiniRow(s,info)).join(''):emptyState('Tudo tranquilo por aqui','Nenhuma mensalidade vencida ou com vencimento nos próximos 7 dias.')}</section>`;
    $('#quickAddStudent')?.addEventListener('click',()=>openStudentModal());
    $('#toggleFinancePrivacy')?.addEventListener('click',toggleFinancialVisibility);
    $$('[data-nav]',viewEl).forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
    $$('.js-charge-whatsapp',viewEl).forEach(b=>b.addEventListener('click',()=>sendChargeWhatsApp(b.dataset.id)));
  }

  function emptyState(title, text) {
    return `<div class="empty"><strong>${escapeHTML(title)}</strong>${escapeHTML(text)}</div>`;
  }

  function chargeMiniRow(student, info) {
    return `<article class="card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(student.name)}</strong><span>${info.text} • ${fmtMoney(student.monthlyFee)}</span></div><button class="mini-icon js-charge-whatsapp" data-id="${student.id}" title="Enviar cobrança">${icon('message')}</button></div></article>`;
  }

  function renderStudents() {
    const students=[...state.students].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const activeCount=students.filter(s=>s.active!==false).length,inactiveCount=students.length-activeCount,monthBirthdays=birthdaysThisMonth();
    viewEl.innerHTML=`
      <div class="section-head"><div><h3>Cadastro de alunos</h3><p>${activeCount} ativo${activeCount===1?'':'s'} • ${inactiveCount} inativo${inactiveCount===1?'':'s'}</p></div><button class="btn btn-primary" id="addStudent">${icon('plus')} Novo aluno</button></div>
      <div class="student-toolbar"><div class="search-wrap">${icon('search')}<input id="studentSearch" type="search" placeholder="Buscar por nome, WhatsApp ou e-mail" autocomplete="off" /></div><div class="tabs student-filter-tabs"><button class="tab ${studentFilter==='all'?'active':''}" data-student-filter="all">Todos (${students.length})</button><button class="tab ${studentFilter==='active'?'active':''}" data-student-filter="active">Ativos (${activeCount})</button><button class="tab ${studentFilter==='inactive'?'active':''}" data-student-filter="inactive">Inativos (${inactiveCount})</button></div></div>
      ${monthBirthdays.length?`<div class="birthday-month-strip"><strong>🎂 Aniversariantes do mês</strong><span>${monthBirthdays.map(s=>`${escapeHTML(s.name)} • ${String(parseLocalDate(s.birthDate).getDate()).padStart(2,'0')}/${String(parseLocalDate(s.birthDate).getMonth()+1).padStart(2,'0')}`).join(' &nbsp; • &nbsp; ')}</span></div>`:''}
      <section id="studentsList" class="cards"></section>`;
    const list=$('#studentsList');
    const draw=()=>{const q=($('#studentSearch')?.value||'').trim().toLowerCase();const filtered=students.filter(s=>{const text=[s.name,s.whatsapp,s.email].some(v=>String(v||'').toLowerCase().includes(q));const status=studentFilter==='all'||(studentFilter==='active'&&s.active!==false)||(studentFilter==='inactive'&&s.active===false);return text&&status;});list.innerHTML=filtered.length?filtered.map(studentCard).join(''):emptyState('Nenhum aluno encontrado',q?'Tente outro termo de busca.':'Nenhum aluno neste filtro.');bindStudentActions();};
    draw();$('#studentSearch').addEventListener('input',draw);$$('[data-student-filter]',viewEl).forEach(b=>b.addEventListener('click',()=>{studentFilter=b.dataset.studentFilter;$$('[data-student-filter]',viewEl).forEach(x=>x.classList.toggle('active',x.dataset.studentFilter===studentFilter));draw();}));$('#addStudent').addEventListener('click',()=>openStudentModal());
  }

  function studentCard(s) {
    const age = ageFromBirth(s.birthDate);
    const info = dueInfo(s);
    const mk = monthKey();
    const trainingCount = monthlyAttendanceCount(s.id,mk);
    return `<article class="card student-card">
      <div class="student-profile">
        <div class="student-photo">${s.photoData?`<img src="${s.photoData}" alt="Foto de ${escapeHTML(s.name)}" />`:`<span>${escapeHTML((s.name||'?').trim().charAt(0).toUpperCase())}</span>`}</div>
        <div class="student-info">
        <div class="student-name">${escapeHTML(s.name)}</div>
        <div class="student-meta"><span><strong>${age ?? '—'} anos</strong></span><span>${escapeHTML(s.whatsapp||'Sem WhatsApp')}</span><span>${escapeHTML(s.email||'Sem e-mail')}</span></div>
        <div class="student-meta"><span>Início: <strong>${fmtDate(s.startDate)}</strong></span><span>No Studio: <strong>${studioTime(s.startDate)}</strong></span><span>Vencimento: <strong>${fmtDate(s.dueDate)}</strong></span><span><strong>${fmtMoney(s.monthlyFee)}</strong></span></div>
        <div style="margin-top:10px"><span class="status ${info.cls}">${info.text}</span>${s.active===false?' <span class="status neutral">Inativo</span>':''} <span class="status neutral">🏋️ Treinos em ${monthLabel(mk).replace(/ de \d{4}$/,'')}: ${trainingCount}</span></div>
        </div>
      </div>
      <div class="student-actions">
        <button class="mini-icon js-student-history" data-id="${s.id}" title="Histórico de presença e faltas">${icon('calendar')}</button>
        <button class="mini-icon js-student-training-whatsapp" data-id="${s.id}" data-month="${mk}" title="Enviar treinos pelo WhatsApp">${icon('message')}</button>
        <button class="mini-icon js-edit-student" data-id="${s.id}" title="Editar aluno">${icon('edit')}</button>
        <button class="mini-icon danger js-delete-student" data-id="${s.id}" title="Excluir aluno">${icon('trash')}</button>
      </div>
    </article>`;
  }

  function bindStudentActions() {
    $$('.js-student-history',viewEl).forEach(b=>b.addEventListener('click',()=>openStudentHistory(b.dataset.id)));
    $$('.js-student-training-whatsapp',viewEl).forEach(b=>b.addEventListener('click',()=>sendMonthlyAttendanceWhatsApp(b.dataset.id,b.dataset.month)));
    $$('.js-edit-student',viewEl).forEach(b=>b.addEventListener('click',()=>openStudentModal(b.dataset.id)));
    $$('.js-delete-student',viewEl).forEach(b=>b.addEventListener('click',()=>confirmDeleteStudent(b.dataset.id)));
  }

  function openStudentHistory(id){
    const s=state.students.find(x=>x.id===id);if(!s)return;const rows=attendanceHistory(id),present=rows.filter(x=>x.status==='present').length,absent=rows.filter(x=>x.status==='absent').length,makeups=rows.filter(x=>x.isMakeup&&x.status==='present').length;
    openModal(`Histórico • ${s.name}`,`<section class="metrics history-metrics">${metricCard('check',present,'Presenças','good')}${metricCard('x',absent,'Faltas',absent?'danger':'')}${metricCard('calendar',makeups,'Reposições')}</section><div class="history-list">${rows.length?rows.map(r=>`<div class="history-row"><div><strong>${fmtDate(r.date)}</strong><span>${r.isMakeup?'Reposição • ':''}${escapeHTML(r.time||'')}</span></div><span class="status ${r.status==='present'?'ok':'danger'}">${r.status==='present'?'Presente':'Falta'}</span></div>`).join(''):emptyState('Sem histórico','Ainda não há presenças ou faltas registradas para este aluno.')}</div>`);
  }

  function openStudentModal(id=null) {
    const s = id ? state.students.find(x=>x.id===id) : null;
    const title = s ? 'Editar aluno' : 'Novo aluno';
    openModal(title, `
      <form id="studentForm" class="form-grid two">
        <div class="field" style="grid-column:1/-1"><label>Foto do aluno</label><div class="photo-picker"><div id="photoPreview" class="photo-preview">${s?.photoData?`<img src="${s.photoData}" alt="Foto do aluno" />`:`<span>${escapeHTML((s?.name||'?').trim().charAt(0).toUpperCase())}</span>`}</div><div><input id="studentPhoto" type="file" accept="image/*" /><small>Opcional. A foto será reduzida e salva somente no app.</small><button id="removePhoto" type="button" class="btn btn-secondary btn-small ${s?.photoData?'':'hidden'}" style="margin-top:8px">Remover foto</button></div></div></div>
        <div class="field" style="grid-column:1/-1"><label>Nome completo *</label><input name="name" required value="${escapeHTML(s?.name||'')}" placeholder="Nome do aluno" /></div>
        <div class="field"><label>Data de nascimento *</label><input name="birthDate" type="date" required value="${escapeHTML(s?.birthDate||'')}" /></div>
        <div class="field"><label>Idade</label><input id="agePreview" disabled value="${s?.birthDate ? `${ageFromBirth(s.birthDate)} anos` : 'Calculada automaticamente'}" /></div>
        <div class="field"><label>WhatsApp *</label><input name="whatsapp" inputmode="tel" required value="${escapeHTML(s?.whatsapp||'')}" placeholder="(31) 99999-9999" /></div>
        <div class="field"><label>E-mail</label><input name="email" type="email" value="${escapeHTML(s?.email||'')}" placeholder="aluno@email.com" /></div>
        <div class="field"><label>Data de início dos treinos *</label><input name="startDate" type="date" required value="${escapeHTML(s?.startDate||isoToday())}" /></div>
        <div class="field"><label>Vencimento da mensalidade *</label><input name="dueDate" type="date" required value="${escapeHTML(s?.dueDate||isoToday())}" /></div>
        <div class="field"><label>Valor da mensalidade *</label><input name="monthlyFee" type="number" min="0" step="0.01" required value="${escapeHTML(s?.monthlyFee ?? '')}" placeholder="0,00" /></div>
        <div class="field"><label>Forma de pagamento preferencial</label><select name="paymentMethod"><option value="pix" ${s?.paymentMethod!=='cash'?'selected':''}>PIX</option><option value="cash" ${s?.paymentMethod==='cash'?'selected':''}>Dinheiro</option></select></div>
        <div class="field"><label>Situação</label><select name="active"><option value="true" ${s?.active!==false?'selected':''}>Ativo</option><option value="false" ${s?.active===false?'selected':''}>Inativo</option></select></div>
        <div class="modal-actions" style="grid-column:1/-1"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} ${s?'Salvar alterações':'Criar aluno'}</button></div>
      </form>
    `);
    const form = $('#studentForm');
    let photoData=s?.photoData||'';
    const photoInput=$('#studentPhoto');
    const photoPreview=$('#photoPreview');
    const removePhoto=$('#removePhoto');
    async function compressPhoto(file){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=320,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',.72))};img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)});}
    photoInput.addEventListener('change',async()=>{const file=photoInput.files?.[0];if(!file)return;try{photoData=await compressPhoto(file);photoPreview.innerHTML=`<img src="${photoData}" alt="Foto do aluno" />`;removePhoto.classList.remove('hidden')}catch(e){toast('Não foi possível carregar essa foto.')}});
    removePhoto.addEventListener('click',()=>{photoData='';photoInput.value='';photoPreview.innerHTML='<span>?</span>';removePhoto.classList.add('hidden')});
    form.birthDate.addEventListener('change',()=>{$('#agePreview').value = form.birthDate.value ? `${ageFromBirth(form.birthDate.value)} anos` : 'Calculada automaticamente';});
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const fd = new FormData(form);
      const record = {
        id: s?.id || uid('stu'),
        name: String(fd.get('name')).trim(),
        birthDate: String(fd.get('birthDate')),
        whatsapp: String(fd.get('whatsapp')).trim(),
        email: String(fd.get('email')).trim(),
        startDate: String(fd.get('startDate')),
        dueDate: String(fd.get('dueDate')),
        monthlyFee: Number(fd.get('monthlyFee')) || 0,
        paymentMethod: String(fd.get('paymentMethod')||'pix'),
        active: String(fd.get('active')) === 'true',
        photoData,
        consent: s?.consent || {sentAt:null,acceptedAt:null},
        createdAt: s?.createdAt || new Date().toISOString()
      };
      if (s) state.students = state.students.map(x=>x.id===s.id?record:x); else state.students.push(record);
      saveState(); closeModal(); toast(s?'Aluno atualizado.':'Aluno criado com sucesso.'); render();
    });
  }

  function confirmDeleteStudent(id) {
    const s = state.students.find(x=>x.id===id); if (!s) return;
    openModal('Excluir aluno', `<div class="notice">Você está prestes a excluir <strong>${escapeHTML(s.name)}</strong>. Os pagamentos já registrados serão mantidos no histórico financeiro.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmDelete">${icon('trash')} Excluir</button></div>`);
    $('#confirmDelete').addEventListener('click',()=>{state.students=state.students.filter(x=>x.id!==id); saveState(); closeModal(); toast('Aluno excluído.'); render();});
  }

  function renderFinance() {
    const m = metrics();
    const tabs = [
      ['summary','Resumo'],['payments','Receitas'],['expenses','Gastos']
    ];
    viewEl.innerHTML = `
      <div class="tabs">${tabs.map(([id,l])=>`<button class="tab ${financeTab===id?'active':''}" data-fin-tab="${id}">${l}</button>`).join('')}</div>
      <div id="financeContent"></div>`;
    $$('[data-fin-tab]').forEach(b=>b.addEventListener('click',()=>{financeTab=b.dataset.finTab;renderFinance();}));
    const c = $('#financeContent');
    if (financeTab==='summary') {
      c.innerHTML = `
        <section class="metrics">
          ${metricCard('wallet',privateMoney(m.expected),'Receita mensal prevista')}
          ${metricCard('chart',privateMoney(m.received),'Receita recebida','good')}
          ${metricCard('receipt',privateMoney(m.expenses),'Gastos do mês',m.expenses?'danger':'')}
          ${metricCard('wallet',privateMoney(m.net),'Saldo do mês',m.net>=0?'good':'danger')}
        </section>
        <div class="section-head"><div><h3>Visão do mês</h3><p>Valores calculados automaticamente</p></div><button class="mini-icon" id="toggleFinancePrivacy" type="button" title="Mostrar ou ocultar valores">${icon(financialValuesVisible?'eye-off':'eye')}</button></div>
        <section class="cards grid2 payment-breakdown">
          <article class="card"><div class="list-row"><div class="list-main"><strong>Potencial via PIX</strong><span>Todos os alunos ativos cadastrados como PIX</span></div><strong>${privateMoney(m.potentialPix)}</strong></div><div class="list-row"><div class="list-main"><strong>Já recebido via PIX</strong><span>Mês atual</span></div><strong class="money-positive">${privateMoney(m.pix)}</strong></div><div class="list-row"><div class="list-main"><strong>Potencial ainda a receber</strong><span>PIX</span></div><strong>${privateMoney(m.remainingPix)}</strong></div></article>
          <article class="card"><div class="list-row"><div class="list-main"><strong>Potencial em dinheiro</strong><span>Todos os alunos ativos cadastrados como Dinheiro</span></div><strong>${privateMoney(m.potentialCash)}</strong></div><div class="list-row"><div class="list-main"><strong>Já recebido em dinheiro</strong><span>Mês atual</span></div><strong class="money-positive">${privateMoney(m.cash)}</strong></div><div class="list-row"><div class="list-main"><strong>Potencial ainda a receber</strong><span>Dinheiro</span></div><strong>${privateMoney(m.remainingCash)}</strong></div></article>
        </section>
        <section class="cards grid2"><article class="card"><div class="list-row"><div class="list-main"><strong>Alunos ativos</strong><span>Base de mensalidades</span></div><strong>${m.students}</strong></div><div class="list-row"><div class="list-main"><strong>Ticket médio</strong><span>Média por aluno ativo</span></div><strong>${privateMoney(m.students?m.expected/m.students:0)}</strong></div><div class="list-row"><div class="list-main"><strong>Em atraso</strong><span>${m.overdue} aluno${m.overdue===1?'':'s'} • valor pendente</span></div><strong>${privateMoney(m.overdueValue)}</strong></div></article><article class="card"><div class="notice">A receita prevista é a soma das mensalidades cadastradas. A receita recebida só aumenta quando você registra um pagamento na aba Cobranças ou Receitas.</div></article></section>`;
          $('#toggleFinancePrivacy')?.addEventListener('click',toggleFinancialVisibility);
    } else if (financeTab==='payments') renderPayments(c);
    else renderExpenses(c);
  }

  function renderPayments(c) {
    const groups=paymentsByMonth();
    const current=monthKey();
    const students=activeStudents();
    const currentPaidIds=new Set(state.payments.filter(p=>monthKey(p.date)===current).map(p=>String(p.studentId)));
    const pending=students.filter(s=>!currentPaidIds.has(String(s.id)));
    c.innerHTML = `
      <div class="section-head"><div><h3>Receitas e histórico</h3><p>Pagamentos preservados mês a mês</p></div><button class="btn btn-primary" id="addPayment">${icon('plus')} Registrar receita</button></div>
      <section class="card"><div class="list-row"><div class="list-main"><strong>Situação do mês atual</strong><span>${students.length-currentPaidIds.size} aluno${students.length-currentPaidIds.size===1?'':'s'} sem pagamento registrado</span></div><strong>${privateMoney(pending.reduce((a,s)=>a+(Number(s.monthlyFee)||0),0))}</strong></div></section>
      ${groups.length?groups.map(([mk,payments])=>{const total=payments.reduce((a,p)=>a+(Number(p.amount)||0),0);return `<div class="section-head"><div><h3>${monthLabel(mk)}</h3><p>${payments.length} pagamento${payments.length===1?'':'s'} • ${fmtMoney(total)}</p></div></div><section class="cards">${payments.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(p=>{const st=state.students.find(x=>String(x.id)===String(p.studentId)); const method=st?.paymentMethod==='cash'?'Dinheiro':'PIX'; return `<article class="card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(st?.name||p.studentName||'Aluno removido')}</strong><span>${fmtDate(p.date)} • ${escapeHTML(p.reference||'Mensalidade')} • ${method}</span></div><strong class="money-positive">${fmtMoney(p.amount)}</strong></div></article>`}).join('')}</section>`}).join(''):emptyState('Nenhuma receita registrada','Registre pagamentos para acompanhar o caixa real do studio.')}
      ${pending.length?`<div class="section-head"><div><h3>Ainda sem pagamento neste mês</h3><p>Baseado nos registros de receitas</p></div></div><section class="cards">${pending.map(st=>`<article class="card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(st.name)}</strong><span>${st.paymentMethod==='cash'?'Dinheiro':'PIX'} • ${fmtMoney(st.monthlyFee)}</span></div><button class="btn btn-secondary btn-small js-register-pending" data-id="${st.id}">Registrar</button></div></article>`).join('')}</section>`:''}`;
    $('#addPayment').addEventListener('click',()=>openPaymentModal());
    $$('.js-register-pending',c).forEach(b=>b.addEventListener('click',()=>openPaymentModal(b.dataset.id)));
  }

  function openPaymentModal(preselectedId='') {
    const students = activeStudents();
    if (!students.length) return toast('Cadastre um aluno antes de registrar uma mensalidade.');
    openModal('Registrar receita', `<form id="paymentForm" class="form-grid"><div class="field"><label>Aluno *</label><select name="studentId" required>${students.map(s=>`<option value="${s.id}" ${s.id===preselectedId?'selected':''}>${escapeHTML(s.name)}</option>`).join('')}</select></div><div class="form-grid two"><div class="field"><label>Data *</label><input type="date" name="date" required value="${isoToday()}" /></div><div class="field"><label>Valor *</label><input type="number" name="amount" step="0.01" min="0" required /></div></div><div class="field"><label>Forma de pagamento *</label><select name="paymentMethod" required><option value="pix">PIX</option><option value="cash">Dinheiro</option></select></div><div class="field"><label>Referência</label><input name="reference" value="Mensalidade" /></div><div class="field"><label><input id="advanceDue" type="checkbox" checked style="width:auto;margin-right:8px" /> Avançar vencimento do aluno em 1 mês</label></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} Registrar</button></div></form>`);
    const form=$('#paymentForm');
    const syncAmount=()=>{const s=state.students.find(x=>x.id===form.studentId.value); if(s) form.amount.value=Number(s.monthlyFee||0).toFixed(2);};
    const syncPaymentMethod=()=>{const s=state.students.find(x=>x.id===form.studentId.value); if(s) form.paymentMethod.value=s.paymentMethod||'pix';};
    form.studentId.addEventListener('change',()=>{syncAmount();syncPaymentMethod();}); syncAmount(); syncPaymentMethod();
    form.addEventListener('submit',e=>{e.preventDefault(); const fd=new FormData(form); const sid=String(fd.get('studentId')); const s=state.students.find(x=>x.id===sid); const payment={id:uid('pay'),studentId:sid,studentName:s?.name||'',date:String(fd.get('date')),amount:Number(fd.get('amount'))||0,paymentMethod:String(fd.get('paymentMethod')||'pix'),reference:String(fd.get('reference')).trim(),createdAt:new Date().toISOString()}; state.payments.push(payment); if($('#advanceDue').checked && s){s.dueDate=addMonthsISO(s.dueDate||isoToday(),1);} saveState(); closeModal(); toast('Receita registrada.'); render();});
  }

  function addMonthsISO(value, months) {
    const d=parseLocalDate(value)||todayNoon();
    const originalDay=d.getDate();
    d.setDate(1); d.setMonth(d.getMonth()+months);
    const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(originalDay,last));
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }

  function renderExpenses(c) {
    const expenses=[...state.expenses].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    c.innerHTML=`<div class="section-head"><div><h3>Gastos</h3><p>Despesas do studio</p></div><button class="btn btn-primary" id="addExpense">${icon('plus')} Novo gasto</button></div><section class="cards">${expenses.length?expenses.map(e=>`<article class="card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(e.description)}</strong><span>${fmtDate(e.date)} • ${escapeHTML(e.category||'Outros')}</span></div><div style="display:flex;align-items:center;gap:8px"><strong class="money-negative">${fmtMoney(e.amount)}</strong><button class="mini-icon danger js-del-expense" data-id="${e.id}">${icon('trash')}</button></div></div></article>`).join(''):emptyState('Nenhum gasto cadastrado','Cadastre aluguel, energia, equipamentos e outras despesas.')}</section>`;
    $('#addExpense').addEventListener('click',openExpenseModal); $$('.js-del-expense',c).forEach(b=>b.addEventListener('click',()=>{state.expenses=state.expenses.filter(e=>e.id!==b.dataset.id);saveState();render();}));
  }

  function openExpenseModal() {
    openModal('Novo gasto',`<form id="expenseForm" class="form-grid"><div class="field"><label>Descrição *</label><input name="description" required placeholder="Ex.: Energia elétrica" /></div><div class="form-grid two"><div class="field"><label>Categoria</label><select name="category"><option>Estrutura</option><option>Energia</option><option>Água</option><option>Equipamentos</option><option>Manutenção</option><option>Marketing</option><option>Impostos</option><option>Outros</option></select></div><div class="field"><label>Data *</label><input type="date" name="date" required value="${isoToday()}" /></div></div><div class="field"><label>Valor *</label><input type="number" name="amount" min="0" step="0.01" required /></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} Salvar gasto</button></div></form>`);
    $('#expenseForm').addEventListener('submit',e=>{e.preventDefault(); const fd=new FormData(e.currentTarget); state.expenses.push({id:uid('exp'),description:String(fd.get('description')).trim(),category:String(fd.get('category')),date:String(fd.get('date')),amount:Number(fd.get('amount'))||0,createdAt:new Date().toISOString()}); saveState(); closeModal(); toast('Gasto registrado.'); render();});
  }

  function renderCharges() {
    const students=activeStudents().map(s=>({s,info:dueInfo(s)})).sort((a,b)=>a.info.days-b.info.days);
    const tabs=[['all','Todos'],['overdue','Vencidos'],['soon','Vencendo']];
    const filtered=students.filter(x=>chargeTab==='all'||(chargeTab==='overdue'?x.info.key==='overdue':['today','soon'].includes(x.info.key)));
    viewEl.innerHTML=`<div class="tabs">${tabs.map(([id,l])=>`<button class="tab ${chargeTab===id?'active':''}" data-charge-tab="${id}">${l}</button>`).join('')}</div><div class="notice">O botão de WhatsApp abre uma mensagem pronta. O envio só acontece quando você confirma no WhatsApp.</div><div class="section-head"><div><h3>Lembretes de mensalidade</h3><p>Vencimentos e cobranças</p></div></div><section class="cards">${filtered.length?filtered.map(({s,info})=>`<article class="card"><div class="student-card"><div><div class="student-name">${escapeHTML(s.name)}</div><div class="student-meta"><span>Vencimento: <strong>${fmtDate(s.dueDate)}</strong></span><span><strong>${fmtMoney(s.monthlyFee)}</strong></span></div><div style="margin-top:9px"><span class="status ${info.cls}">${info.text}</span></div></div><div class="student-actions"><button class="mini-icon js-charge-whatsapp" data-id="${s.id}" title="WhatsApp">${icon('message')}</button><button class="mini-icon js-mark-paid" data-id="${s.id}" title="Registrar pagamento">${icon('check')}</button></div></div></article>`).join(''):emptyState('Nenhum aluno nessa situação','As cobranças aparecerão aqui conforme as datas de vencimento.')}</section>`;
    $$('[data-charge-tab]').forEach(b=>b.addEventListener('click',()=>{chargeTab=b.dataset.chargeTab;renderCharges();}));
    $$('.js-charge-whatsapp').forEach(b=>b.addEventListener('click',()=>sendChargeWhatsApp(b.dataset.id)));
    $$('.js-mark-paid').forEach(b=>b.addEventListener('click',()=>openPaymentModal(b.dataset.id)));
  }

  function cleanPhone(value) {
    const digits=String(value||'').replace(/\D/g,'');
    if (!digits) return '';
    return digits.startsWith('55') ? digits : `55${digits}`;
  }

  function chargeMessage(s) {
    const info=dueInfo(s);
    const first=s.name.split(' ')[0];
    if (info.key==='overdue') return `Olá, ${first}! Tudo bem? Passando para lembrar que sua mensalidade do Studio Márcio Bueno, no valor de ${fmtMoney(s.monthlyFee)}, venceu em ${fmtDate(s.dueDate)}. Quando puder, me confirme o pagamento. Obrigado!`;
    if (info.key==='today') return `Olá, ${first}! Tudo bem? Passando para lembrar que sua mensalidade do Studio Márcio Bueno, no valor de ${fmtMoney(s.monthlyFee)}, vence hoje (${fmtDate(s.dueDate)}). Obrigado!`;
    return `Olá, ${first}! Tudo bem? Só passando para lembrar que sua mensalidade do Studio Márcio Bueno, no valor de ${fmtMoney(s.monthlyFee)}, vence em ${fmtDate(s.dueDate)}. Obrigado!`;
  }

  function sendChargeWhatsApp(id) {
    const s=state.students.find(x=>x.id===id); if(!s)return;
    const phone=cleanPhone(s.whatsapp);
    if(!phone)return toast('Cadastre um WhatsApp válido para este aluno.');
    const url=`https://wa.me/${phone}?text=${encodeURIComponent(chargeMessage(s))}`;
    window.open(url,'_blank','noopener,noreferrer');
  }

  function consentText(s) {
    const age=ageFromBirth(s.birthDate);
    return `TERMO DE CONSENTIMENTO E AUTODECLARAÇÃO PARA PRÁTICA DE ATIVIDADE FÍSICA\n\nEu, ${s.name}, ${age ?? '___'} anos, declaro que as informações sobre minha saúde fornecidas ao profissional responsável são verdadeiras e que não tenho conhecimento de condição que me impeça de participar das atividades físicas propostas.\n\nComprometo-me a informar imediatamente qualquer dor, mal-estar, alteração de saúde, uso de medicamento relevante ou orientação médica que possa interferir na prática de exercícios.\n\nEstou ciente de que este termo não substitui avaliação, diagnóstico ou liberação médica quando houver indicação, sintomas, fatores de risco ou recomendação de profissional de saúde.\n\nAo responder “LI E ACEITO” a esta mensagem, confirmo que li e compreendi o conteúdo acima e autorizo o registro deste aceite pelo Studio Márcio Bueno.\n\nData: ${fmtDate(isoToday())}\nStudio Márcio Bueno • Personal Trainer`;
  }

  function formatPhoneBR(value){
    const digits=String(value||'').replace(/\D/g,'');
    let n=digits.startsWith('55')?digits.slice(2):digits;
    if(n.length===11) return `+55 (${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
    if(n.length===10) return `+55 (${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    return value||'Sem WhatsApp';
  }

  function reminderTemplate(type){
    const templates={
      frequency:'Olá, [nome]! Seu resumo de [mes] no Studio Márcio Bueno: você realizou [treinos] treino(s), teve [faltas] falta(s) e [reposicoes] reposição(ões). Continue firme! 💪',
      charge:'Olá, [nome]! Tudo bem? Passando para lembrar sobre sua mensalidade do Studio Márcio Bueno. Quando puder, me confirme o pagamento. Obrigado!',
      birthday:'Olá, [nome]! 🎉 Passando para desejar um feliz aniversário! Que seu novo ciclo seja cheio de saúde, conquistas e bons momentos. Um abraço do Studio Márcio Bueno!',
      absence:'Olá, [nome]! Tudo bem? Sentimos sua falta nos últimos treinos. Quando puder, me avise para organizarmos sua rotina e mantermos a frequência. 💪',
      general:'Olá, [nome]! Tudo bem? Passando para deixar um lembrete do Studio Márcio Bueno.'
    };
    return templates[type]||templates.general;
  }

  function personalizeReminder(template, student, mk=monthKey()){
    const st=monthlyAttendanceStats(student.id,mk);
    const first=(student.name||'').trim().split(/\s+/)[0]||student.name||'aluno';
    return String(template||'')
      .replaceAll('[nome]',first)
      .replaceAll('[treinos]',String(st.present))
      .replaceAll('[faltas]',String(st.absent))
      .replaceAll('[reposicoes]',String(st.makeups))
      .replaceAll('[mes]',monthLabel(mk));
  }

  function renderReminders(){
    const students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const mk=monthKey();
    const overdueIds=new Set(students.filter(s=>dueInfo(s).key==='overdue').map(s=>String(s.id)));
    const birthdayIds=new Set(birthdayStudents(7).map(x=>String(x.s.id)));
    const absentIds=new Set(students.filter(s=>monthlyAttendanceStats(s.id,mk).absent>0).map(s=>String(s.id)));
    const zeroIds=new Set(students.filter(s=>monthlyAttendanceStats(s.id,mk).present===0).map(s=>String(s.id)));
    const lowIds=new Set(students.filter(s=>{const n=monthlyAttendanceStats(s.id,mk).present;return n>=1&&n<=4}).map(s=>String(s.id)));
    const midIds=new Set(students.filter(s=>{const n=monthlyAttendanceStats(s.id,mk).present;return n>=5&&n<=8}).map(s=>String(s.id)));
    const highIds=new Set(students.filter(s=>monthlyAttendanceStats(s.id,mk).present>=9).map(s=>String(s.id)));
    let activeFilter='all';
    let sendMode='group';
    const selectedIds=new Set();

    const filterMeta={
      all:{label:'Todos',icon:'users',ids:new Set(students.map(s=>String(s.id)))},
      zero:{label:'0 treinos',icon:'calendar',ids:zeroIds},
      low:{label:'1–4 treinos',icon:'chart',ids:lowIds},
      mid:{label:'5–8 treinos',icon:'chart',ids:midIds},
      high:{label:'9+ treinos',icon:'chart',ids:highIds},
      overdue:{label:'Vencidos',icon:'bell',ids:overdueIds},
      birthday:{label:'Aniversários 7 dias',icon:'calendar',ids:birthdayIds},
      absent:{label:'Com faltas',icon:'users',ids:absentIds}
    };

    viewEl.innerHTML=`<div class="notice reminder-intro">${icon('message')}<div><strong>Central de comunicação</strong><span>Envie mensagens individuais ou prepare um grupo de alunos. Cada conversa abre separadamente no WhatsApp para sua confirmação.</span></div></div>
      <div class="section-head"><div><h3>Lembretes e WhatsApp</h3><p>Seleção manual, filtros rápidos e frequência mensal automática</p></div></div>
      <section class="card reminder-card">
        <div class="reminder-mode-switch" role="tablist" aria-label="Modo de envio">
          <button type="button" class="reminder-mode" data-mode="individual">${icon('users')} Individual</button>
          <button type="button" class="reminder-mode active" data-mode="group">${icon('message')} Grupo de alunos</button>
        </div>
        <div class="field"><label>Mensagem</label><textarea id="reminderMessage" placeholder="Escolha um modelo ou escreva sua mensagem."></textarea><small>Campos automáticos: <strong>[nome]</strong>, <strong>[treinos]</strong>, <strong>[faltas]</strong>, <strong>[reposicoes]</strong> e <strong>[mes]</strong>.</small></div>
        <div class="reminder-template-head"><strong>Mensagens prontas</strong><span>Personalizadas automaticamente para cada aluno</span></div>
        <div class="reminder-templates">
          <button type="button" class="btn btn-primary btn-small js-template" data-template="frequency">${icon('calendar')} Frequência do mês</button>
          <button type="button" class="btn btn-secondary btn-small js-template" data-template="charge">${icon('bell')} Cobrança</button>
          <button type="button" class="btn btn-secondary btn-small js-template" data-template="birthday">${icon('calendar')} Aniversário</button>
          <button type="button" class="btn btn-secondary btn-small js-template" data-template="absence">${icon('users')} Retorno</button>
          <button type="button" class="btn btn-secondary btn-small js-template" data-template="general">${icon('message')} Geral</button>
        </div>

        <div class="reminder-filter-head"><div><strong>Selecionar alunos</strong><span id="reminderFilterCaption">Seleção manual • exibindo todos os alunos ativos</span></div><span class="status neutral" id="reminderSelectedCount">0 selecionados</span></div>
        <div class="reminder-filter-groups">
          <div><small class="reminder-group-label">Frequência em ${escapeHTML(monthLabel(mk))}</small><div class="reminder-toolbar">${['zero','low','mid','high'].map(key=>{const m=filterMeta[key];return `<button type="button" class="btn btn-secondary btn-small reminder-filter" data-filter="${key}">${m.label} <span class="filter-count">${m.ids.size}</span></button>`}).join('')}</div></div>
          <div><small class="reminder-group-label">Outros filtros</small><div class="reminder-toolbar" id="reminderFilters">
            ${['all','overdue','birthday','absent'].map(key=>{const m=filterMeta[key];return `<button type="button" class="btn btn-secondary btn-small reminder-filter ${key==='all'?'active':''}" data-filter="${key}">${icon(m.icon)} ${m.label} <span class="filter-count">${m.ids.size}</span></button>`}).join('')}
            <button type="button" class="btn btn-secondary btn-small" id="selectVisible">${icon('check')} Selecionar visíveis</button>
            <button type="button" class="btn btn-secondary btn-small" id="clearReminder">${icon('x')} Limpar</button>
          </div></div>
        </div>

        <div id="reminderStudents" class="reminder-students"></div>
        <div class="reminder-footer"><div class="reminder-selection-summary" id="reminderSelectionSummary">Nenhum aluno selecionado</div><button type="button" class="btn btn-primary" id="prepareReminder">${icon('message')} Preparar WhatsApp</button></div>
      </section><section id="reminderQueue" class="cards" style="margin-top:12px"></section>`;

    const visibleStudents=()=>{
      const ids=filterMeta[activeFilter].ids;
      return students.filter(s=>ids.has(String(s.id)));
    };
    const updateSummary=()=>{
      const n=selectedIds.size;
      $('#reminderSelectedCount').textContent=`${n} selecionado${n===1?'':'s'}`;
      $('#reminderSelectionSummary').textContent=n?`${n} aluno${n===1?'':'s'} selecionado${n===1?'':'s'} • modo ${sendMode==='individual'?'individual':'grupo'}`:'Nenhum aluno selecionado';
    };
    const drawStudents=()=>{
      const list=visibleStudents();
      const root=$('#reminderStudents');
      $('#reminderFilterCaption').textContent=`Seleção ${sendMode==='individual'?'individual':'em grupo'} • ${list.length} de ${students.length} alunos`;
      root.innerHTML=list.length?list.map(s=>{
        const sid=String(s.id), checked=selectedIds.has(sid), info=dueInfo(s), st=monthlyAttendanceStats(s.id,mk);
        const tags=[`<span class="status neutral">${st.present} treino${st.present===1?'':'s'}</span>`];
        if(info.key==='overdue') tags.push('<span class="status danger">Vencido</span>');
        if(birthdayIds.has(sid)) tags.push('<span class="status warn">Aniversário</span>');
        if(st.absent>0) tags.push(`<span class="status neutral">${st.absent} falta${st.absent===1?'':'s'}</span>`);
        const inputType=sendMode==='individual'?'radio':'checkbox';
        return `<label class="reminder-student ${checked?'selected':''}"><input type="${inputType}" name="reminderStudent" value="${escapeHTML(sid)}" ${checked?'checked':''}><span class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span><span class="reminder-student-info"><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(formatPhoneBR(s.whatsapp))}</small><span class="reminder-tags">${tags.join('')}</span></span></label>`;
      }).join(''):`<div class="empty compact"><strong>Nenhum aluno neste filtro</strong>Não há alunos que atendam a este critério no momento.</div>`;
      $$('input[name="reminderStudent"]',root).forEach(x=>x.addEventListener('change',()=>{
        if(sendMode==='individual'){selectedIds.clear(); if(x.checked) selectedIds.add(String(x.value)); drawStudents(); return;}
        if(x.checked)selectedIds.add(String(x.value));else selectedIds.delete(String(x.value));
        x.closest('.reminder-student')?.classList.toggle('selected',x.checked);updateSummary();
      }));
      updateSummary();
    };
    const applyFilter=(key)=>{
      activeFilter=key;
      $$('.reminder-filter',viewEl).forEach(b=>b.classList.toggle('active',b.dataset.filter===key));
      drawStudents();
    };

    $$('.reminder-mode',viewEl).forEach(b=>b.addEventListener('click',()=>{
      sendMode=b.dataset.mode;
      selectedIds.clear();
      $$('.reminder-mode',viewEl).forEach(x=>x.classList.toggle('active',x===b));
      drawStudents();
      $('#reminderQueue').innerHTML='';
    }));
    $$('.reminder-filter',viewEl).forEach(b=>b.addEventListener('click',()=>applyFilter(b.dataset.filter)));
    $$('.js-template',viewEl).forEach(b=>b.addEventListener('click',()=>{const ta=$('#reminderMessage');ta.value=reminderTemplate(b.dataset.template);ta.focus();toast('Modelo inserido. Os dados serão personalizados para cada aluno.');}));
    $('#selectVisible').addEventListener('click',()=>{
      const list=visibleStudents();
      if(sendMode==='individual'){
        if(list[0]) selectedIds.clear(), selectedIds.add(String(list[0].id));
      } else {
        list.forEach(s=>selectedIds.add(String(s.id)));
      }
      drawStudents();
    });
    $('#clearReminder').addEventListener('click',()=>{selectedIds.clear();drawStudents();$('#reminderQueue').innerHTML='';toast('Seleção limpa.');});
    $('#prepareReminder').addEventListener('click',()=>{
      const msg=$('#reminderMessage').value.trim();if(!msg)return toast('Escreva ou escolha uma mensagem primeiro.');
      const ids=[...selectedIds];if(!ids.length)return toast('Selecione pelo menos um aluno.');
      if(sendMode==='individual' && ids.length>1) return toast('No modo individual, selecione somente um aluno.');
      const selected=ids.map(id=>state.students.find(s=>String(s.id)===String(id))).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
      $('#reminderQueue').innerHTML=`<div class="section-head"><div><h3>${sendMode==='individual'?'Envio individual':'Envios do grupo'}</h3><p>${selected.length} conversa${selected.length===1?'':'s'} preparada${selected.length===1?'':'s'} • cada aluno recebe seus próprios dados</p></div></div>`+selected.map(s=>{
        const phone=cleanPhone(s.whatsapp);
        const text=personalizeReminder(msg,s,mk);
        return `<article class="card reminder-ready"><div class="list-row"><div class="student-profile"><span class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span><div class="list-main"><strong>${escapeHTML(s.name)}</strong><span>${phone?escapeHTML(formatPhoneBR(s.whatsapp)):'WhatsApp não cadastrado'}</span><small>${escapeHTML(text)}</small></div></div>${phone?`<button class="btn btn-primary btn-small js-open-reminder" data-url="https://wa.me/${phone}?text=${encodeURIComponent(text)}">${icon('message')} Abrir WhatsApp</button>`:'<span class="status danger">Sem número</span>'}</div></article>`;
      }).join('');
      $$('.js-open-reminder',viewEl).forEach(b=>b.addEventListener('click',()=>window.open(b.dataset.url,'_blank','noopener,noreferrer')));
      $('#reminderQueue').scrollIntoView({behavior:'smooth',block:'start'});
    });
    $('#reminderMessage').value=reminderTemplate('frequency');
    drawStudents();
  }

  function renderConsent() {
    const students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    viewEl.innerHTML=`<div class="notice">Este modelo é uma autodeclaração de consentimento e não substitui avaliação ou liberação médica quando indicada.</div><div class="section-head"><div><h3>Termos dos alunos</h3><p>Envie, copie e registre o aceite</p></div></div><section class="cards">${students.length?students.map(s=>{const c=s.consent||{};return `<article class="card"><div class="student-card"><div><div class="student-name">${escapeHTML(s.name)}</div><div class="student-meta"><span>Enviado: <strong>${c.sentAt?fmtDate(c.sentAt.slice(0,10)):'Não'}</strong></span><span>Aceite: <strong>${c.acceptedAt?fmtDate(c.acceptedAt.slice(0,10)):'Pendente'}</strong></span></div></div><div class="student-actions"><button class="mini-icon js-open-term" data-id="${s.id}" title="Abrir termo">${icon('file')}</button></div></div></article>`}).join(''):emptyState('Nenhum aluno ativo','Cadastre alunos para gerar os termos.')}</section>`;
    $$('.js-open-term').forEach(b=>b.addEventListener('click',()=>openConsentModal(b.dataset.id)));
  }

  function openConsentModal(id) {
    const s=state.students.find(x=>x.id===id); if(!s)return;
    const text=consentText(s);
    openModal('Termo de consentimento',`<div class="consent-box" id="consentText">${escapeHTML(text)}</div><div class="modal-actions"><button class="btn btn-secondary" id="copyConsent">Copiar</button><button class="btn btn-primary" id="sendConsent">${icon('message')} WhatsApp</button></div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Fechar</button><button class="btn btn-primary" id="acceptConsent">${icon('check')} Registrar aceite</button></div>`);
    $('#copyConsent').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text);toast('Termo copiado.');}catch{fallbackCopy(text);}});
    $('#sendConsent').addEventListener('click',()=>{const phone=cleanPhone(s.whatsapp);if(!phone)return toast('Cadastre o WhatsApp deste aluno.'); s.consent=s.consent||{}; s.consent.sentAt=new Date().toISOString(); saveState(); window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');});
    $('#acceptConsent').addEventListener('click',()=>{s.consent=s.consent||{};s.consent.acceptedAt=new Date().toISOString();saveState();closeModal();toast('Aceite registrado.');render();});
  }

  function fallbackCopy(text){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Texto copiado.');}


  function renderBirthdayPanel(){
    const items=birthdayStudents(7);
    if(!items.length) return '';
    return `<div class="section-head"><div><h3>🎂 Aniversários</h3><p>Hoje e próximos 7 dias</p></div></div>
      <section class="cards">${items.map(({s,info})=>`<article class="card birthday-card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(s.name)}</strong><span>${info.days===0?'🎉 Aniversário hoje':`Em ${info.days} dia${info.days===1?'':'s'} • ${fmtDate(`${info.next.getFullYear()}-${String(info.next.getMonth()+1).padStart(2,'0')}-${String(info.next.getDate()).padStart(2,'0')}`)}`}</span></div><span class="status ${info.days===0?'warn':'neutral'}">${info.days===0?'HOJE':'EM BREVE'}</span></div></article>`).join('')}</section>`;
  }

  function renderSchedule(){
    const weekEnd=addDays(scheduleWeekStart,4),mk=monthKey(),students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),occ=occupancyStats();
    const day=SCHEDULE_DAYS.find(d=>d.id===selectedScheduleDay)||SCHEDULE_DAYS[0];
    const date=scheduleDateForDay(day.id);
    const slots=scheduleHours(day.id);
    const dayStats=slots.reduce((acc,time)=>{
      const ids=slotStudents(day.id,time),makeupId=makeupStudentId(date,day.id,time),map=attendanceMap(date,day.id,time);
      if(ids.length||makeupId)acc.classes++;
      acc.fixed+=ids.length;
      if(makeupId)acc.makeups++;
      [...ids,...(makeupId?[makeupId]:[])].forEach(id=>{if(map[id]==='present')acc.present++;if(map[id]==='absent')acc.absent++;});
      return acc;
    },{classes:0,fixed:0,makeups:0,present:0,absent:0});

    viewEl.innerHTML=`
      <section class="schedule-pro-head">
        <div><span class="section-overline">AGENDA PREMIUM</span><h3>Agenda semanal</h3><p>Personal • até 4 alunos fixos por horário • reposição em vaga extra</p></div>
        <span class="schedule-pro-badge">${icon('calendar')} ${escapeHTML(monthLabel(mk))}</span>
      </section>

      <div class="week-nav schedule-week-nav"><button class="mini-icon" id="prevWeek" title="Semana anterior">‹</button><div class="week-label"><strong>${fmtDate(isoDate(scheduleWeekStart))} — ${fmtDate(isoDate(weekEnd))}</strong><button class="link-btn" id="currentWeek">Semana atual</button></div><button class="mini-icon" id="nextWeek" title="Próxima semana">›</button></div>

      <div class="schedule-day-tabs" role="tablist">${SCHEDULE_DAYS.map(d=>{
        const dte=parseLocalDate(scheduleDateForDay(d.id));
        const short=d.label.slice(0,3).toUpperCase();
        const active=d.id===day.id;
        return `<button type="button" class="schedule-day-tab ${active?'active':''}" data-schedule-day="${d.id}" role="tab" aria-selected="${active}"><small>${short}</small><strong>${String(dte.getDate()).padStart(2,'0')}</strong></button>`;
      }).join('')}</div>

      <section class="schedule-day-summary">
        <div><span class="section-overline">${day.label.toUpperCase()}</span><h3>${day.label}, ${fmtDate(date)}</h3><p>${dayStats.classes} aula${dayStats.classes===1?'':'s'} • ${dayStats.fixed} aluno${dayStats.fixed===1?'':'s'} fixo${dayStats.fixed===1?'':'s'} • ${dayStats.makeups} ${dayStats.makeups===1?'reposição':'reposições'}</p></div>
        <div class="schedule-day-mini"><span>✓ ${dayStats.present}</span><span>✕ ${dayStats.absent}</span></div>
      </section>

      <div class="schedule-pro-list">${slots.map(t=>scheduleSlotHTML(day.id,t)).join('')}</div>

      <section class="schedule-insights">
        <article class="card"><div class="premium-card-title"><span>Ocupação geral</span>${icon('chart')}</div><div class="schedule-kpi">${occ.percent}%</div><small>${occ.used}/${occ.totalCapacity} vagas fixas ocupadas</small></article>
        <article class="card"><div class="premium-card-title"><span>Reposições</span>${icon('users')}</div><div class="schedule-kpi">${makeupSummary().scheduledNext7}</div><small>agendadas nos próximos 7 dias</small></article>
      </section>

      <div class="section-head"><div><h3>Resumo mensal de treinos</h3><p>${monthLabel(mk)} • presenças registradas, incluindo reposições</p></div></div>
      <section class="cards">${students.length?students.map(s=>monthlyReportRow(s,mk)).join(''):emptyState('Nenhum aluno ativo','Cadastre alunos para gerar o resumo mensal.')}</section>`;

    $$('.schedule-slot',viewEl).forEach(b=>b.addEventListener('click',()=>openScheduleSlot(b.dataset.day,b.dataset.time)));
    $$('.schedule-day-tab',viewEl).forEach(b=>b.addEventListener('click',()=>{selectedScheduleDay=b.dataset.scheduleDay;renderSchedule()}));
    $('#prevWeek').addEventListener('click',()=>{scheduleWeekStart=addDays(scheduleWeekStart,-7);renderSchedule()});
    $('#nextWeek').addEventListener('click',()=>{scheduleWeekStart=addDays(scheduleWeekStart,7);renderSchedule()});
    $('#currentWeek').addEventListener('click',()=>{scheduleWeekStart=mondayOf();selectedScheduleDay=({1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'}[new Date().getDay()]||'mon');renderSchedule()});
    $$('.js-month-whatsapp',viewEl).forEach(b=>b.addEventListener('click',()=>sendMonthlyAttendanceWhatsApp(b.dataset.id,mk)));
  }

  function monthlyReportRow(s,mk){
    const st=monthlyAttendanceStats(s.id,mk);
    const makeupText=st.makeups===1?'sendo 1 reposição':`sendo ${st.makeups} reposições`;
    return `<article class="card monthly-report-card"><div class="list-row"><div class="student-profile"><div class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</div><div class="list-main"><strong>${escapeHTML(s.name)}</strong><span><strong>${st.present} treino${st.present===1?'':'s'} realizado${st.present===1?'':'s'}</strong> • ${st.absent} falta${st.absent===1?'':'s'} • ${makeupText}</span><small>${monthLabel(mk)}</small></div></div><button class="mini-icon js-month-whatsapp" data-id="${s.id}" title="Enviar resumo mensal pelo WhatsApp">${icon('message')}</button></div></article>`;
  }

  function sendMonthlyAttendanceWhatsApp(id,mk){
    const s=state.students.find(x=>x.id===id);if(!s)return;const phone=cleanPhone(s.whatsapp);if(!phone)return toast('Cadastre um WhatsApp válido para este aluno.');
    const st=monthlyAttendanceStats(id,mk);const first=(s.name||'').split(' ')[0]||s.name;
    const makeupText=st.makeups===1?'sendo 1 reposição':`sendo ${st.makeups} reposições`;
    const text=`Olá, ${first}! Seu resumo de ${monthLabel(mk)} no Studio Márcio Bueno: ${st.present} treino${st.present===1?'':'s'} realizado${st.present===1?'':'s'}, ${st.absent} falta${st.absent===1?'':'s'}, ${makeupText}. 💪`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');
  }

  function scheduleSlotHTML(day,time){
    const ids=slotStudents(day,time),date=scheduleDateForDay(day),map=attendanceMap(date,day,time);
    const enrolled=ids.map(id=>state.students.find(s=>s.id===id)).filter(Boolean);
    const makeupId=makeupStudentId(date,day,time), makeup=state.students.find(s=>s.id===makeupId);
    const allIds=makeupId?[...ids,makeupId]:ids;
    const present=allIds.filter(id=>map[id]==='present').length, absent=allIds.filter(id=>map[id]==='absent').length;
    const vacancies=Math.max(0,4-ids.length);
    const countClass=ids.length>=4?'full':ids.length>=3?'busy':ids.length?'active':'empty';
    return `<button type="button" class="schedule-slot schedule-slot-pro ${countClass} ${makeup?'has-makeup':''}" data-day="${day}" data-time="${time}">
      <span class="schedule-time-rail"><strong>${time}</strong><small>PERSONAL</small></span>
      <span class="schedule-slot-body">
        <span class="schedule-slot-top"><strong>Personal</strong><span class="schedule-pills"><span class="schedule-capacity">${ids.length}/4${makeup?' + R':''}</span><span class="schedule-vacancy">${vacancies} vaga${vacancies===1?'':'s'}</span></span></span>
        <span class="schedule-people">${enrolled.length?enrolled.map(s=>`<span class="schedule-person"><span class="schedule-initial">${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span><span>${escapeHTML(s.name)}</span></span>`).join(''):`<span class="schedule-empty-line">${icon('users')} Vagas disponíveis</span>`}</span>
        ${makeup?`<span class="schedule-makeup-line"><span class="makeup-square">R</span><strong>${escapeHTML(makeup.name)}</strong><em>Reposição</em></span>`:''}
        ${(present||absent)?`<span class="attendance-mini"><span>✓ ${present} presença${present===1?'':'s'}</span><span>✕ ${absent} falta${absent===1?'':'s'}</span></span>`:''}
      </span>
      <span class="schedule-chevron">›</span>
    </button>`;
  }

  function makeupStudentId(date,day,time){return state.makeups?.[attendanceKey(date,day,time)]||''}
  function setMakeupStudent(date,day,time,studentId){
    state.makeups=state.makeups||{};
    const k=attendanceKey(date,day,time);
    if(studentId){state.makeups[k]=studentId;setAttendance(date,day,time,studentId,'present')}
    else {const old=state.makeups[k];if(old)setAttendance(date,day,time,old,'');delete state.makeups[k];saveState()}
  }

  function attendanceStudentCard(s,date,day,time,isMakeup=false){
    const st=attendanceStatus(date,day,time,s.id);
    return `<div class="daily-attendance-card ${isMakeup?'makeup-card':''}">
      <div class="daily-student"><span class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span>
      <div><strong>${escapeHTML(s.name)}</strong>${isMakeup?'<small>REPOSIÇÃO</small>':''}</div></div>
      <div class="attendance-actions">
        <button type="button" class="attendance-btn present ${st==='present'?'active':''}" data-att="present" data-id="${s.id}">✓ Presente</button>
        <button type="button" class="attendance-btn absent ${st==='absent'?'active':''}" data-att="absent" data-id="${s.id}">✕ Falta</button>
      </div>
      ${isMakeup?'<button type="button" class="remove-makeup" data-remove-makeup>Remover reposição</button>':''}
    </div>`;
  }

  function bindAttendanceButtons(root,date,day,time){
    $$('.attendance-btn',root).forEach(b=>b.addEventListener('click',()=>{
      const id=b.dataset.id,status=b.dataset.att;setAttendance(date,day,time,id,status);
      $$(`.attendance-btn[data-id="${id}"]`,root).forEach(x=>x.classList.toggle('active',x.dataset.att===status));
      toast(status==='present'?'Presença registrada.':'Falta registrada.');
    }));
  }

  function openScheduleSlot(day,time){
    const dayLabel=SCHEDULE_DAYS.find(d=>d.id===day)?.label||day,date=scheduleDateForDay(day);
    // A turma existe sempre que houver pelo menos 1 aluno fixo.
    // O limite de 4 é somente a capacidade máxima e nunca bloqueia a frequência.
    const ids=slotStudents(day,time).slice(0,4);
    const enrolled=ids.map(id=>state.students.find(s=>s.id===id)).filter(Boolean);
    const makeupId=makeupStudentId(date,day,time);
    const makeup=state.students.find(s=>s.id===makeupId);
    openModal(`${dayLabel} • ${fmtDate(date)} • ${time}`,`
      <div class="notice">Marque Presente ou Falta somente para os alunos desta aula. As presenças alimentam automaticamente o resumo mensal.</div>
      <div class="daily-attendance-list">${enrolled.length?enrolled.map(s=>attendanceStudentCard(s,date,day,time)).join(''):'<div class="empty compact"><strong>Nenhum aluno fixo</strong>Use “Editar alunos da turma” para montar este horário.</div>'}</div>
      ${enrolled.length?`<div class="notice compact">Turma ativa com ${enrolled.length}/4 aluno${enrolled.length===1?'':'s'}. A frequência pode ser registrada normalmente, mesmo sem a turma estar completa.</div>`:''}
      ${makeup?`<div class="makeup-title">Reposição nesta aula</div>${attendanceStudentCard(makeup,date,day,time,true)}`:''}
      <div class="lesson-tools">
        <button type="button" class="btn btn-secondary" id="editClassStudents">Editar alunos da turma</button>
        <button type="button" class="btn btn-makeup" id="addMakeup">${makeup?'Trocar reposição':'+ Adicionar reposição'}</button>
      </div>`);
    const modal=$('.modal');
    bindAttendanceButtons(modal,date,day,time);
    $('#editClassStudents',modal)?.addEventListener('click',()=>openClassEditor(day,time));
    $('#addMakeup',modal)?.addEventListener('click',()=>openMakeupPicker(day,time));
    $('[data-remove-makeup]',modal)?.addEventListener('click',()=>{setMakeupStudent(date,day,time,'');closeModal();toast('Reposição removida.');renderSchedule()});
  }

  function openClassEditor(day,time){
    const dayLabel=SCHEDULE_DAYS.find(d=>d.id===day)?.label||day,date=scheduleDateForDay(day),selected=new Set(slotStudents(day,time));
    const students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const studentRow=s=>`<label class="class-picker-student ${selected.has(s.id)?'selected':''}" data-student-name="${escapeHTML((s.name||'').toLowerCase())}" data-student-selected="${selected.has(s.id)?'1':'0'}">
      <span class="student-photo tiny-photo class-picker-avatar">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span>
      <span class="class-picker-name">${escapeHTML(s.name)}</span>
      <input class="class-picker-checkbox" type="checkbox" name="student" value="${s.id}" ${selected.has(s.id)?'checked':''} aria-label="Selecionar ${escapeHTML(s.name)}">
      <span class="class-picker-check" aria-hidden="true">${icon('check')}</span>
    </label>`;
    openModal(`Editar turma • ${dayLabel} • ${time}`,`
      <form id="slotForm" class="class-picker-form">
        <div class="class-picker-head">
          <div><strong id="classPickerCount">${selected.size} de 4 alunos selecionados</strong><span>Escolha os alunos fixos deste horário.</span></div>
          <span class="class-picker-capacity">Máx. 4</span>
        </div>
        <div class="search-wrap class-picker-search">${icon('search')}<input id="classPickerSearch" type="search" placeholder="Buscar aluno pelo nome" autocomplete="off" /></div>
        <div class="class-picker-tabs" role="tablist">
          <button type="button" class="class-picker-tab active" data-class-filter="all">Todos <span>${students.length}</span></button>
          <button type="button" class="class-picker-tab" data-class-filter="selected">Selecionados <span id="classPickerSelectedBadge">${selected.size}</span></button>
        </div>
        <div id="classPickerList" class="class-picker-list">${students.map(studentRow).join('')}</div>
        <div id="classPickerEmpty" class="empty compact hidden"><strong>Nenhum aluno encontrado</strong>Tente outro nome ou altere o filtro.</div>
        <div class="class-picker-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button type="submit" class="btn btn-primary">${icon('check')} Salvar turma</button></div>
      </form>`);
    const form=$('#slotForm'),search=$('#classPickerSearch'),list=$('#classPickerList'),empty=$('#classPickerEmpty');
    let filter='all';
    const update=()=>{
      const checked=$$('input[name="student"]:checked',form),count=checked.length,q=(search.value||'').trim().toLowerCase();
      $('#classPickerCount').textContent=`${count} de 4 alunos selecionados`;
      $('#classPickerSelectedBadge').textContent=String(count);
      $$('.class-picker-student',list).forEach(row=>{
        const input=$('input[name="student"]',row),isSelected=input.checked;
        row.classList.toggle('selected',isSelected);
        row.dataset.studentSelected=isSelected?'1':'0';
        input.disabled=!isSelected && count>=4;
        row.classList.toggle('disabled',input.disabled);
        const matchesName=(row.dataset.studentName||'').includes(q);
        const matchesFilter=filter==='all'||isSelected;
        row.classList.toggle('hidden',!(matchesName&&matchesFilter));
      });
      empty.classList.toggle('hidden',$$('.class-picker-student:not(.hidden)',list).length>0);
    };
    search.addEventListener('input',update);
    $$('.class-picker-tab',form).forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.classFilter;$$('.class-picker-tab',form).forEach(x=>x.classList.toggle('active',x===b));update()}));
    form.addEventListener('change',e=>{if(e.target.name==='student')update()});
    form.addEventListener('submit',e=>{e.preventDefault();const newIds=$$('input[name="student"]:checked',form).map(x=>x.value);state.schedule=state.schedule||{};state.schedule[slotKey(day,time)]=newIds;saveState();closeModal();toast('Turma atualizada.');renderSchedule()});
    update();
    setTimeout(()=>search.focus({preventScroll:true}),50);
  }

  function openMakeupPicker(day,time){
    const date=scheduleDateForDay(day),fixed=new Set(slotStudents(day,time));
    const current=makeupStudentId(date,day,time);
    const students=[...activeStudents()].filter(s=>!fixed.has(s.id)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    openModal(`Adicionar reposição • ${fmtDate(date)} • ${time}`,`<div class="notice makeup-notice">A reposição é uma vaga extra desta aula e não altera a turma fixa. Ao adicionar o aluno, ela já será contabilizada como presença no resumo mensal.</div>
      <div class="makeup-picker">${students.map(s=>`<button type="button" class="makeup-option ${current===s.id?'selected':''}" data-makeup-id="${s.id}"><span class="makeup-square">R</span><span class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span><span>${escapeHTML(s.name)}</span></button>`).join('')}</div>`);
    const modal=$('.modal');
    $$('.makeup-option',modal).forEach(b=>b.addEventListener('click',()=>{setMakeupStudent(date,day,time,b.dataset.makeupId);closeModal();toast('Reposição adicionada e presença contabilizada.');renderSchedule()}));
  }

  async function enableBirthdayNotifications(){
    if(!('Notification' in window)) return toast('Este navegador não oferece notificações.');
    const p=await Notification.requestPermission();
    state.birthdayNotifications=state.birthdayNotifications||{};
    state.birthdayNotifications.enabled=p==='granted';saveState();
    if(p==='granted'){toast('Notificações de aniversário ativadas.');checkBirthdayNotification(true);}
    else toast('Permissão de notificações não concedida.');
  }

  function checkBirthdayNotification(force=false){
    if(!('Notification' in window) || Notification.permission!=='granted' || !state.birthdayNotifications?.enabled) return;
    const today=isoToday();
    if(!force && state.birthdayNotifications.lastCheck===today) return;
    const todayBirthdays=birthdayStudents(0);
    if(todayBirthdays.length){
      const names=todayBirthdays.map(x=>x.s.name).join(', ');
      try{new Notification('🎂 Aniversário no Studio',{body:`Hoje: ${names}`});}catch{}
    }
    state.birthdayNotifications.lastCheck=today;saveState();
  }

  function renderSettings() {
    const m=metrics();
    viewEl.innerHTML=`
      <section class="logo-feature"><img src="assets/logo-interna.jpg" alt="Márcio Bueno Personal Trainer" /></section>
      <div class="section-head"><div><h3>Aplicativo</h3><p>Uso privado no seu dispositivo</p></div></div>
      <section class="card">
        <div class="settings-row"><div><strong>Versão instalada</strong><span>MB Gestor Luxury • versão ${APP_VERSION}</span></div><span class="pill">Estável</span></div>
        <div class="settings-row"><div><strong>Instalar na tela inicial</strong><span>Abre como aplicativo com o seu ícone.</span></div><button class="btn btn-primary btn-small" id="installSettings">Instalar</button></div>
        <div class="settings-row"><div><strong>Dias para aviso de vencimento</strong><span>Hoje: ${state.settings.chargeDaysBefore} dia(s) antes.</span></div><button class="btn btn-secondary btn-small" id="changeDays">Alterar</button></div>
        <div class="settings-row"><div><strong>Notificações de aniversário</strong><span>Avisa quando houver aniversariante do dia enquanto o app estiver ativo.</span></div><button class="btn btn-secondary btn-small" id="birthdayNotify">${state.birthdayNotifications?.enabled?'Ativadas':'Ativar'}</button></div>
        <div class="settings-row"><div><strong>Dados cadastrados</strong><span>${state.students.length} alunos • ${state.payments.length} receitas • ${state.expenses.length} gastos</span></div><span class="pill">Local</span></div>
      </section>
      <div class="section-head"><div><h3>Backup</h3><p>Proteja seus dados • ${state.settings.lastBackupAt?`último backup em ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(state.settings.lastBackupAt))}`:'nenhum backup registrado neste aparelho'}</p></div></div>
      <section class="card">
        <div class="settings-row"><div><strong>Exportar backup</strong><span>Baixa um arquivo JSON com todos os dados do aplicativo.</span></div><button class="btn btn-secondary btn-small" id="exportBackup">${icon('download')} Exportar</button></div>
        <div class="settings-row"><div><strong>Importar backup</strong><span>Restaura um backup exportado por este aplicativo.</span></div><button class="btn btn-secondary btn-small" id="importBackup">${icon('upload')} Importar</button><input id="backupFile" type="file" accept="application/json" class="hidden" /></div>
      </section>
      <div class="section-head"><div><h3>Resumo atual</h3></div></div>
      <section class="metrics">${metricCard('users',m.students,'Alunos ativos')}${metricCard('wallet',fmtMoney(m.expected),'Receita prevista')}${metricCard('chart',fmtMoney(m.received),'Recebido no mês','good')}${metricCard('receipt',fmtMoney(m.expenses),'Gastos no mês',m.expenses?'danger':'')}</section>
    `;
    $('#installSettings').addEventListener('click',installApp);
    $('#changeDays').addEventListener('click',changeChargeDays);
    $('#birthdayNotify')?.addEventListener('click',enableBirthdayNotifications);
    $('#exportBackup').addEventListener('click',exportBackup);
    $('#importBackup').addEventListener('click',()=>$('#backupFile').click());
    $('#backupFile').addEventListener('change',importBackup);
  }

  function changeChargeDays(){openModal('Aviso de vencimento',`<form id="daysForm"><div class="field"><label>Quantos dias antes deseja destacar a mensalidade?</label><input name="days" type="number" min="0" max="30" value="${Number(state.settings.chargeDaysBefore||3)}" required /></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div></form>`);$('#daysForm').addEventListener('submit',e=>{e.preventDefault();state.settings.chargeDaysBefore=Math.max(0,Math.min(30,Number(new FormData(e.currentTarget).get('days'))||0));saveState();closeModal();render();toast('Preferência atualizada.');});}

  function exportBackup(){const now=new Date();state.settings.lastBackupAt=now.toISOString();saveState();const payload={app:'MB Gestor Premium',appVersion:APP_VERSION,exportedAt:now.toISOString(),summary:{students:state.students.length,payments:state.payments.length,expenses:state.expenses.length},state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MB_Gestor_Backup_V8_2_2_${isoToday()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup V8.2.2 gerado e registrado.');renderSettings();}

  async function importBackup(e){const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());const incoming=data.state||data;if(!Array.isArray(incoming.students)||!Array.isArray(incoming.expenses)||!Array.isArray(incoming.payments))throw new Error('Formato inválido');openModal('Restaurar backup',`<div class="notice">O backup contém ${incoming.students.length} aluno(s), ${incoming.payments.length} receita(s) e ${incoming.expenses.length} gasto(s). Ao continuar, os dados atuais serão substituídos. Faça um backup antes desta restauração.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" id="confirmImport">Restaurar</button></div>`);$('#confirmImport').addEventListener('click',()=>{state={...structuredClone(DEFAULT_STATE),...incoming,schedule:(incoming.schedule&&typeof incoming.schedule==='object')?incoming.schedule:{},attendance:(incoming.attendance&&typeof incoming.attendance==='object')?incoming.attendance:{},makeups:(incoming.makeups&&typeof incoming.makeups==='object')?incoming.makeups:{},reminderDrafts:Array.isArray(incoming.reminderDrafts)?incoming.reminderDrafts:[],birthdayNotifications:(incoming.birthdayNotifications&&typeof incoming.birthdayNotifications==='object')?incoming.birthdayNotifications:{},settings:{...DEFAULT_STATE.settings,...(incoming.settings||{})}};saveState();closeModal();render();toast('Backup restaurado.');});}catch(err){toast('Não foi possível importar esse arquivo.');}finally{e.target.value='';}}

  function openModal(title, bodyHTML) {
    modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="modal-head"><h3>${escapeHTML(title)}</h3><button class="mini-icon" data-close-modal>${icon('x')}</button></div><div class="modal-body">${bodyHTML}</div></div></div>`;
    $$('[data-close-modal]',modalRoot).forEach(b=>b.addEventListener('click',closeModal));
    $('.modal-backdrop',modalRoot).addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal();});
  }
  function closeModal(){modalRoot.innerHTML='';}
  function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;toastRoot.appendChild(t);setTimeout(()=>t.remove(),3200);}

  async function installApp(){
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch {}
      deferredInstallPrompt=null; updateInstallButtons(); return;
    }
    openModal('Instalar aplicativo',`<div class="notice">Se o botão automático de instalação não aparecer, abra este endereço no Chrome, toque no menu ⋮ e escolha <strong>“Adicionar à tela inicial”</strong> ou <strong>“Instalar app”</strong>. Para instalação completa, o aplicativo precisa estar publicado em um endereço HTTPS.</div><div class="modal-actions"><button class="btn btn-primary" data-close-modal>Entendi</button></div>`);
  }
  function updateInstallButtons(){const can=Boolean(deferredInstallPrompt);$('#installBtnTop')?.classList.toggle('hidden',!can);$('#installBtnSide')?.classList.toggle('hidden',!can);}

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;updateInstallButtons();});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateInstallButtons();toast('Aplicativo instalado.');});
  $('#installBtnTop')?.addEventListener('click',installApp);
  $('#installBtnSide')?.addEventListener('click',installApp);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker não registrado',err)));
  }

  renderNav();
  render();
  setTimeout(()=>checkBirthdayNotification(false),1200);
})();
