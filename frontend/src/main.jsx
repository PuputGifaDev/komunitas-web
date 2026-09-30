import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('ic_token')
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Terjadi kesalahan')
  return data
}

function App() {
  const [view, setView] = useState('home')
  const [articles, setArticles] = useState([])
  const [events, setEvents] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    request('/articles?status=published').then(setArticles).catch(() => {})
    request('/events').then(setEvents).catch(() => {})
  }, [])

  async function submitContact(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await request('/contacts', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) })
      event.currentTarget.reset()
      setMessage('Pesan berhasil dikirim. Terima kasih!')
    } catch (error) { setMessage(error.message) }
  }

  return <>
    <header className="header"><a className="brand" href="#home" onClick={() => setView('home')}><span>IC</span><b>Internet Club<small>Semarang</small></b></a><nav><a href="#about">Tentang</a><a href="#program">Program</a><a href="#articles">Kabar</a><a href="#contact">Kontak</a><button onClick={() => setView('admin')}>Admin</button></nav></header>
    {view === 'admin' ? <Admin onBack={() => setView('home')} /> : <main>
      <section id="home" className="hero"><div><label>Komunitas digital Semarang</label><h1>Berbagi kabar.<br /><em>Membangun koneksi.</em></h1><p>Internet Club adalah prasarana untuk berbagi info, dokumentasi, dan kolaborasi yang bermanfaat.</p><a className="primary" href="#contact">Bergabung bersama kami</a></div><div className="hero-card"><span>RUANG INFORMASI</span><h2>Ide baik tumbuh saat dibagikan.</h2><div><b>100+</b><small>Anggota aktif</small><b>20+</b><small>Kegiatan</small></div></div></section>
      <section id="about" className="section"><label>TENTANG KAMI</label><h2>Komunitas untuk saling berbagi dan berkembang.</h2><div className="two"><p>Internet Club Semarang menghadirkan ruang terbuka untuk kabar, informasi, dokumentasi, dan pembelajaran digital. Kami percaya informasi yang terdokumentasi dengan baik dapat memberi dampak lebih luas.</p><div className="feature-grid"><article>📣<b>Kabar & info</b><span>Informasi relevan untuk komunitas.</span></article><article>🗂️<b>Dokumentasi</b><span>Arsip kegiatan dan sumber belajar.</span></article><article>🤝<b>Kolaborasi</b><span>Berjejaring secara positif.</span></article><article>💡<b>Eksplorasi</b><span>Belajar teknologi bersama.</span></article></div></div></section>
      <section id="program" className="section tinted"><label>PROGRAM</label><h2>Yang kami kerjakan</h2><div className="cards"><article><strong>01</strong><h3>Forum Diskusi</h3><p>Tempat bertukar ide, pengalaman, dan solusi.</p></article><article><strong>02</strong><h3>Workshop Digital</h3><p>Kegiatan praktik untuk meningkatkan keterampilan.</p></article><article><strong>03</strong><h3>Resource Sharing</h3><p>Berbagi referensi dan sumber daya yang bermanfaat.</p></article></div></section>
      <section id="articles" className="section"><label>KABAR TERBARU</label><h2>Catatan dari komunitas</h2><div className="cards">{articles.length ? articles.slice(0, 3).map(article => <article key={article.id}><strong>{article.category || 'INFO'}</strong><h3>{article.title}</h3><p>{article.content.slice(0, 130)}...</p></article>) : <article><h3>Belum ada artikel</h3><p>Konten terbaru akan tampil di sini setelah ditambahkan melalui admin panel.</p></article>}</div>{events.length > 0 && <p className="event-note">Agenda terdekat: <b>{events[0].title}</b> — {new Date(events[0].date).toLocaleDateString('id-ID')}</p>}</section>
      <section id="contact" className="section contact"><div><label>HUBUNGI KAMI</label><h2>Punya kabar untuk dibagikan?</h2><p>Silakan kirim pesan kepada tim Internet Club Semarang.</p></div><form onSubmit={submitContact}><input name="name" placeholder="Nama lengkap" required /><input name="email" type="email" placeholder="Email" required /><input name="subject" placeholder="Subjek" required /><textarea name="message" placeholder="Pesan" rows="5" required /><button className="primary">Kirim pesan</button>{message && <small>{message}</small>}</form></section>
    </main>}
    <footer>© 2024 Internet Club Semarang · Berbagi kabar, info, dan dokumentasi.</footer>
  </>
}

function Admin({ onBack }) {
  const [logged, setLogged] = useState(Boolean(localStorage.getItem('ic_token')))
  const [tab, setTab] = useState('articles')
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ title: '', content: '', category: 'Info', status: 'published' })
  const [error, setError] = useState('')

  useEffect(() => { if (logged) load() }, [logged, tab])
  async function load() { try { setItems(await request(tab === 'articles' ? '/articles' : tab === 'events' ? '/events' : '/documents')) } catch (e) { setError(e.message) } }
  async function login(e) { e.preventDefault(); const data = new FormData(e.currentTarget); try { const result = await request('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) }); localStorage.setItem('ic_token', result.token); setLogged(true) } catch (e) { setError(e.message) } }
  async function save(e) { e.preventDefault(); try { await request(tab === 'articles' ? '/articles' : '/events', { method: 'POST', body: JSON.stringify(form) }); setForm({ title: '', content: '', category: 'Info', status: 'published' }); load() } catch (e) { setError(e.message) } }
  async function remove(id) { if (confirm('Hapus data ini?')) { await request(`/${tab}/${id}`, { method: 'DELETE' }); load() } }

  if (!logged) return <main className="login"><button onClick={onBack}>← Kembali</button><form onSubmit={login}><h1>Masuk ke admin</h1><input name="username" placeholder="Username" defaultValue="admin" /><input name="password" type="password" placeholder="Password" defaultValue="admin123" /><button className="primary">Masuk</button>{error && <small>{error}</small>}</form></main>
  return <main className="dashboard"><div className="dash-top"><div><label>ADMIN PANEL</label><h1>Kelola komunitas</h1></div><button onClick={() => { localStorage.removeItem('ic_token'); setLogged(false) }}>Keluar</button></div><div className="dash-tabs"><button className={tab === 'articles' ? 'active' : ''} onClick={() => setTab('articles')}>Artikel</button><button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>Event</button><button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Dokumen</button><button onClick={onBack}>Website</button></div><div className="admin-grid"><form className="editor" onSubmit={save}><h2>{tab === 'articles' ? 'Tambah artikel' : 'Tambah event'}</h2><input placeholder="Judul" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /><textarea placeholder="Konten / deskripsi" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows="8" required /><input placeholder="Kategori" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /><button className="primary">Simpan</button></form><div className="data-list"><h2>Data tersimpan</h2>{items.map(item => <article key={item.id}><div><b>{item.title}</b><p>{item.content?.slice(0, 100) || item.description || item.file_path}</p></div><button onClick={() => remove(item.id)}>Hapus</button></article>)}{error && <small>{error}</small>}</div></div></main>
}

createRoot(document.getElementById('root')).render(<App />)
