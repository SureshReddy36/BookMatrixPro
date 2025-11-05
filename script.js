// Data keys
const STORAGE_KEY = 'lms.books.v1';
const THEME_KEY = 'lms.theme';
const ORDERS_KEY = 'lms.orders.v1';
const ROLE_KEY = 'lms.role';

// Elements
const searchInput = document.getElementById('search');
const sortBySelect = document.getElementById('sortBy');
const filterGenreSelect = document.getElementById('filterGenre');
const filterAvailabilitySelect = document.getElementById('filterAvailability');
const addBookForm = document.getElementById('addBookForm');
const bookListEl = document.getElementById('bookList');
const resultCountEl = document.getElementById('resultCount');
const searchResultsEl = document.getElementById('searchResults');
const themeSelect = document.getElementById('themeSelect');
const tabUserBtn = document.getElementById('tabUser');
const tabAdminBtn = document.getElementById('tabAdmin');
const ordersListEl = document.getElementById('ordersList');
const myRequestsListEl = document.getElementById('myRequestsList');

// Modal elements
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalTitle = document.getElementById('modalTitle');

// State
let books = [];
let genres = new Set();
let activeSuggestionIndex = -1;
let orders = [];
let role = 'user';

function getDefaultTheme(){
    const preferDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return preferDark ? 'dark-midnight-blue' : 'light-mint-cream';
}

function normalizeThemeKey(key){
    if(key === 'light') return 'light-mint-cream';
    if(key === 'dark') return 'dark-midnight-blue';
    return key;
}

function loadTheme(){
    const savedRaw = localStorage.getItem(THEME_KEY);
    const saved = normalizeThemeKey(savedRaw);
    const theme = saved || getDefaultTheme();
    document.documentElement.setAttribute('data-theme', theme);
    if(themeSelect){ themeSelect.value = theme; }
}

function logout(){
    localStorage.removeItem('lms.role');
    const current = location.pathname.toLowerCase();
    // Navigate to login
    location.href = current.endsWith('login.html') ? 'login.html' : 'login.html';
}

function onThemeChange(e){
    const value = e.target.value;
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem(THEME_KEY, value);
}

function loadBooks(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
        try { books = JSON.parse(raw) || []; }
        catch { books = []; }
    }
    if(!books.length){
        books = [
            { id: crypto.randomUUID(), title:'The Great Gatsby', author:'F. Scott Fitzgerald', genre:'Classic', year:1925, quantity:3 },
            { id: crypto.randomUUID(), title:'1984', author:'George Orwell', genre:'Science', year:1949, quantity:0 },
            { id: crypto.randomUUID(), title:'The Hobbit', author:'J. R. R. Tolkien', genre:'Fantasy', year:1937, quantity:5 },
            { id: crypto.randomUUID(), title:'Educated', author:'Tara Westover', genre:'Nonfiction', year:2018, quantity:2 },
            { id: crypto.randomUUID(), title:'The Hound of the Baskervilles', author:'Arthur Conan Doyle', genre:'Mystery', year:1902, quantity:1 },
            { id: crypto.randomUUID(), title:'Sapiens', author:'Yuval Noah Harari', genre:'Nonfiction', year:2011, quantity:4 },
        ];
        saveBooks();
    }
}

function saveBooks(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function updateGenres(){
    genres = new Set(['All', ...books.map(b => b.genre)]);
    const prev = filterGenreSelect.value || 'all';
    filterGenreSelect.innerHTML = '';
    for(const g of Array.from(genres).filter(Boolean)){
        const opt = document.createElement('option');
        opt.value = g.toLowerCase();
        opt.textContent = g;
        filterGenreSelect.appendChild(opt);
    }
    if(Array.from(filterGenreSelect.options).some(o => o.value === prev)){
        filterGenreSelect.value = prev;
    }
}

function normalize(text){
    return (text || '').toString().trim();
}

function matchesSearch(book, query){
    if(!query) return true;
    const q = query.toLowerCase();
    return (
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        (book.genre||'').toLowerCase().includes(q)
    );
}

function applyFilters(data){
    const byGenre = (filterGenreSelect.value || 'all');
    const byAvail = (filterAvailabilitySelect.value || 'all');
    let result = data;
    if(byGenre !== 'all'){
        result = result.filter(b => (b.genre||'').toLowerCase() === byGenre);
    }
    if(byAvail !== 'all'){
        const wantAvailable = byAvail === 'available';
        result = result.filter(b => (b.quantity > 0) === wantAvailable);
    }
    return result;
}

function sortBooks(data){
    const key = sortBySelect.value;
    const copy = [...data];
    copy.sort((a,b) => {
        if(key === 'year') return (a.year||0) - (b.year||0);
        if(key === 'availability') return (b.quantity>0) - (a.quantity>0);
        return String(a[key]||'').localeCompare(String(b[key]||''));
    });
    return copy;
}

function highlight(text, query){
    if(!query) return text;
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc, 'ig');
    return text.replace(re, m => `<span class="highlight">${m}</span>`);
}

function createBookCard(book, query){
    const card = document.createElement('div');
    card.className = 'book-card fade-in';
    card.dataset.id = book.id;

    const available = book.quantity > 0;

    const isAdmin = role === 'admin';
    card.innerHTML = `
        <h4 class="book-title">${highlight(escapeHtml(book.title), query)}</h4>
        <p class="book-meta">by ${highlight(escapeHtml(book.author), query)} • <span>${highlight(escapeHtml(book.genre||'Unknown'), query)}</span> • ${book.year||'—'}</p>
        <div class="tags">
            <span class="tag genre-${escapeAttr(book.genre||'Unknown')}">${escapeHtml(book.genre||'Unknown')}</span>
            <span class="tag ${available ? 'available' : 'unavailable'}">${available ? 'Available' : 'Unavailable'}</span>
            <span class="tag" title="Quantity">Qty: ${book.quantity}</span>
        </div>
        <div class="card-actions">
            <button class="btn details-btn" data-action="details">Details</button>
            ${isAdmin 
                ? `<button class="btn remove-btn" data-action="remove">Remove</button>
                   <button class="btn qty-btn" data-action="inc" title="Increase quantity">+1</button>`
                : `<button class="btn request-btn" data-action="request" ${available?'' :'disabled'}>${available? 'Request' : 'Out of stock'}</button>`}
        </div>
    `;
    return card;
}

function escapeHtml(s){
    return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
}
function escapeAttr(s){
    return String(s).replace(/[^a-zA-Z0-9_-]/g,'');
}

function render(){
    const query = normalize(searchInput.value);
    let data = books.filter(b => matchesSearch(b, query));
    data = applyFilters(data);
    data = sortBooks(data);

    bookListEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    data.forEach(b => frag.appendChild(createBookCard(b, query)));
    bookListEl.appendChild(frag);
    resultCountEl.textContent = `${data.length} result${data.length!==1?'s':''}`;
}

function renderSuggestions(){
    const query = normalize(searchInput.value);
    const list = !query ? [] : books.filter(b => matchesSearch(b, query)).slice(0, 8);
    if(!list.length){
        searchResultsEl.classList.remove('active');
        searchInput.setAttribute('aria-expanded','false');
        searchResultsEl.innerHTML = '';
        activeSuggestionIndex = -1;
        return;
    }
    searchResultsEl.innerHTML = list.map((b,i)=>
        `<div class="item" role="option" data-id="${b.id}" data-index="${i}">
            <span>${highlight(escapeHtml(b.title), query)}</span>
            <span class="meta">${escapeHtml(b.author)} • ${escapeHtml(b.genre||'')}</span>
        </div>`
    ).join('');
    searchResultsEl.classList.add('active');
    searchInput.setAttribute('aria-expanded','true');
    activeSuggestionIndex = -1;
}

function onAddBook(e){
    e.preventDefault();
    const form = new FormData(addBookForm);
    const newBook = {
        id: crypto.randomUUID(),
        title: normalize(form.get('title')),
        author: normalize(form.get('author')),
        genre: normalize(form.get('genre')),
        year: Number(form.get('year')) || null,
        quantity: Math.max(0, Number(form.get('quantity')) || 0)
    };
    if(!newBook.title || !newBook.author){
        alert('Please provide at least Title and Author.');
        return;
    }
    books.unshift(newBook);
    saveBooks();
    updateGenres();
    addBookForm.reset();
    render();
    renderSuggestions();
}

function onListClick(e){
    const btn = e.target.closest('button');
    if(!btn) return;
    const card = btn.closest('.book-card');
    if(!card) return;
    const id = card.dataset.id;
    const book = books.find(b => b.id === id);
    if(!book) return;

    const action = btn.dataset.action;
    if(action === 'remove' && role === 'admin'){
        if(confirm(`Remove "${book.title}"?`)){
            books = books.filter(b => b.id !== id);
            saveBooks();
            updateGenres();
            render();
        }
    } else if(action === 'request' && role === 'user'){
        createOrder(book);
        render();
        renderOrders();
        renderMyRequests();
    } else if(action === 'inc' && role === 'admin'){
        book.quantity += 1;
        saveBooks();
        render();
    } else if(action === 'details'){
        openModal(book);
    }
}

function openModal(book){
    modalTitle.textContent = book.title;
    modalBody.innerHTML = `
        <p><strong>Author:</strong> ${escapeHtml(book.author)}</p>
        <p><strong>Genre:</strong> ${escapeHtml(book.genre||'Unknown')}</p>
        <p><strong>Year:</strong> ${book.year||'—'}</p>
        <p><strong>Quantity:</strong> ${book.quantity}</p>
        <p class="muted">Availability: ${book.quantity>0 ? 'Available' : 'Unavailable'}</p>
    `;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden','false');
}

function closeModal(){
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden','true');
}

function onSearchInput(){
    render();
    renderSuggestions();
}

function saveOrders(){
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function loadOrders(){
    const raw = localStorage.getItem(ORDERS_KEY);
    if(raw){
        try { orders = JSON.parse(raw) || []; }
        catch { orders = []; }
    }
}

function createOrder(book){
    if(book.quantity <= 0){ alert('This book is currently out of stock.'); return; }
    const me = localStorage.getItem('lms.username') || 'You';
    const order = { id: crypto.randomUUID(), bookId: book.id, title: book.title, user: me, status: 'Pending', createdAt: Date.now() };
    orders.unshift(order);
    // Reserve one copy immediately so availability reflects the pending request
    book.quantity -= 1;
    saveBooks();
    saveOrders();
}

function renderOrders(){
    if(!ordersListEl) return;
    loadOrders();
    ordersListEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    if(!orders.length){
        const empty = document.createElement('div');
        empty.className = 'order-meta';
        empty.textContent = 'No requests yet.';
        ordersListEl.appendChild(empty);
        return;
    }
    orders.forEach(o => {
        const row = document.createElement('div');
        row.className = 'order-card fade-in';
        row.dataset.id = o.id;
        row.innerHTML = `
            <div>
                <div><strong>${escapeHtml(o.title)}</strong></div>
                <div class="order-meta">Requester: ${escapeHtml(o.user)} • ${new Date(o.createdAt).toLocaleString()}</div>
            </div>
            <div class="order-actions">
                <span class="status ${o.status}">${o.status}</span>
                ${o.status==='Pending' ? `
                    <button class="btn approve" data-action="approve">Approve</button>
                    <button class="btn reject" data-action="reject">Reject</button>
                ` : ''}
            </div>
        `;
        frag.appendChild(row);
    });
    ordersListEl.appendChild(frag);
}

function renderMyRequests(){
    if(!myRequestsListEl) return;
    loadOrders();
    myRequestsListEl.innerHTML = '';
    const me = localStorage.getItem('lms.username') || 'You';
    const mine = orders.filter(o => o.user === me);
    const frag = document.createDocumentFragment();
    mine.forEach(o => {
        const row = document.createElement('div');
        row.className = 'order-card fade-in';
        row.innerHTML = `
            <div>
                <div><strong>${escapeHtml(o.title)}</strong></div>
                <div class="order-meta">Requested on ${new Date(o.createdAt).toLocaleString()}</div>
            </div>
            <div><span class="status ${o.status}">${o.status}</span></div>
        `;
        frag.appendChild(row);
    });
    myRequestsListEl.appendChild(frag);
}

function onOrdersClick(e){
    const btn = e.target.closest('button');
    if(!btn) return;
    const card = btn.closest('.order-card');
    if(!card) return;
    const id = card.dataset.id;
    const order = orders.find(o => o.id === id);
    if(!order || order.status !== 'Pending') return;
    if(btn.dataset.action === 'approve'){
        order.status = 'Approved';
        // quantity already reserved at request time
    } else if(btn.dataset.action === 'reject'){
        order.status = 'Rejected';
        // return reserved copy to stock
        const book = books.find(b => b.id === order.bookId);
        if(book){ book.quantity += 1; saveBooks(); }
    }
    saveOrders();
    render();
    renderOrders();
    renderMyRequests();
}

function setRole(next){
    role = next;
    document.body.classList.toggle('role-admin', role==='admin');
    document.body.classList.toggle('role-user', role==='user');
    tabUserBtn.classList.toggle('active', role==='user');
    tabAdminBtn.classList.toggle('active', role==='admin');
    localStorage.setItem(ROLE_KEY, role);
    render();
    renderOrders();
    renderMyRequests();
}

function init(){
    loadTheme();
    loadBooks();
    loadOrders();
    const path = location.pathname.toLowerCase();
    const savedRole = localStorage.getItem(ROLE_KEY);
    // Guarded routes
    if(path.endsWith('admin.html')){
        if(savedRole !== 'admin'){ location.href = 'login.html'; return; }
        role = 'admin';
    } else if(path.endsWith('user.html')){
        if(savedRole !== 'user'){ location.href = 'login.html'; return; }
        role = 'user';
    } else if(path.endsWith('login.html') || !path.endsWith('.html') || path.endsWith('index.html')){
        role = savedRole || 'user';
        // If on index and already logged in, redirect to proper view
        if((path.endsWith('index.html') || !path.endsWith('.html')) && savedRole){
            location.href = savedRole === 'admin' ? 'admin.html' : 'user.html';
            return;
        }
    }
    document.body.classList.toggle('role-admin', role==='admin');
    document.body.classList.toggle('role-user', role==='user');
    updateGenres();
    render();
    renderOrders();
    renderMyRequests();

    // Events
    themeSelect && themeSelect.addEventListener('change', onThemeChange);
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn && logoutBtn.addEventListener('click', logout);
    if(addBookForm){ addBookForm.addEventListener('submit', onAddBook); }
    searchInput.addEventListener('input', onSearchInput);
    searchInput.addEventListener('focus', renderSuggestions);
    searchInput.addEventListener('blur', ()=> setTimeout(()=>{ searchResultsEl.classList.remove('active'); searchInput.setAttribute('aria-expanded','false'); }, 120));
    searchResultsEl.addEventListener('mousedown', (e)=>{
        const item = e.target.closest('.item');
        if(!item) return;
        const id = item.dataset.id;
        const book = books.find(b => b.id === id);
        if(book){
            openModal(book);
        }
    });
    searchInput.addEventListener('keydown', (e)=>{
        const items = Array.from(searchResultsEl.querySelectorAll('.item'));
        if(!items.length) return;
        if(e.key === 'ArrowDown'){ e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex+1)%items.length; updateActiveSuggestion(items, activeSuggestionIndex); }
        else if(e.key === 'ArrowUp'){ e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex-1+items.length)%items.length; updateActiveSuggestion(items, activeSuggestionIndex); }
        else if(e.key === 'Enter' && activeSuggestionIndex>=0){ e.preventDefault(); items[activeSuggestionIndex].dispatchEvent(new MouseEvent('mousedown')); }
    });
    sortBySelect.addEventListener('change', render);
    filterGenreSelect.addEventListener('change', render);
    filterAvailabilitySelect.addEventListener('change', render);
    bookListEl.addEventListener('click', onListClick);
    if(ordersListEl){ ordersListEl.addEventListener('click', onOrdersClick); }
    if(tabUserBtn){ tabUserBtn.addEventListener('click', ()=> setRole('user')); }
    if(tabAdminBtn){ tabAdminBtn.addEventListener('click', ()=> setRole('admin')); }
    modal.addEventListener('click', (e) => {
        if(e.target.matches('[data-close]') || e.target.classList.contains('modal')){
            closeModal();
        }
    });
    document.addEventListener('keydown', (e) => {
        if(e.key === 'Escape') closeModal();
    });

    // Sync across tabs/pages when served over HTTP(S)
    window.addEventListener('storage', (e) => {
        if(e.key === ORDERS_KEY){
            loadOrders();
            renderOrders();
            renderMyRequests();
        }
        if(e.key === STORAGE_KEY){
            loadBooks();
            updateGenres();
            render();
        }
    });
}

function updateActiveSuggestion(items, index){
    items.forEach(el => el.classList.remove('active'));
    if(index>=0 && items[index]){
        items[index].classList.add('active');
        items[index].scrollIntoView({block:'nearest'});
    }
}

// Login page wiring
document.addEventListener('DOMContentLoaded', ()=>{
    const loginForm = document.getElementById('loginForm');
    const roleSelect = document.getElementById('roleSelect');
    const usernameInput = document.getElementById('username');
    if(loginForm){
        loginForm.addEventListener('submit', (e)=>{
            e.preventDefault();
            const role = roleSelect.value;
            const username = (usernameInput.value||'You').trim() || 'You';
            localStorage.setItem('lms.role', role);
            localStorage.setItem('lms.username', username);
            location.href = role === 'admin' ? 'admin.html' : 'user.html';
        });
    }
    // Hide Admin View link when logged in as user
    const savedRole = localStorage.getItem('lms.role');
    if(savedRole === 'user'){
        const adminLinks = document.querySelectorAll('a[href="admin.html"], button[data-role-link="admin"]');
        adminLinks.forEach(el => { el.style.display = 'none'; });
    }
    // Update header Login button on index to continue to view when logged in
    const headerLoginLink = document.querySelector('header .header-actions a[href="login.html"]');
    if(headerLoginLink){
        const r = localStorage.getItem('lms.role');
        const u = localStorage.getItem('lms.username') || '';
        if(r){
            headerLoginLink.href = r === 'admin' ? 'admin.html' : 'user.html';
            headerLoginLink.textContent = `Continue as ${u || (r==='admin'?'Admin':'User')}`;
        }
    }
    init();
});


