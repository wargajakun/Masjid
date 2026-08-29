```react
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, Plus, History, X, 
  Building2, Calendar, Tag, AlignLeft, Trash2, 
  CreditCard, Banknote, Download, FileText, Image as ImageIcon,
  RefreshCw, CloudOff, CloudAuto
} from 'lucide-react';

// --- KONFIGURASI GOOGLE SHEETS ---
// Ganti URL ini dengan Web App URL dari Google Apps Script Anda nanti
const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxr8JK99_b0OqORtjSBrYUFLrcgwsP_hREkI3VNI2tUEoJfaGFeZGrVSE95pot2_HcPbg/exec"; 

const INCOME_CATEGORIES = ['Kotak Amal Jumat', 'Kotak Amal Harian', 'Donasi'];
const EXPENSE_CATEGORIES = ['Fasilitas & Operasional Masjid', 'Uang Uhro', 'Kegiatan'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const formatRupiah = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount);
};

export default function App() {
  // State Data
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(GOOGLE_SHEET_WEB_APP_URL ? 'syncing' : 'local'); // 'local', 'syncing', 'synced', 'error'

  // State UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const reportRef = useRef(null);

  const [formData, setFormData] = useState({
    type: 'income',
    category: INCOME_CATEGORIES[0],
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    paymentMethod: 'Tunai' // Default Tunai
  });

  // Load Libraries for Export (html2canvas & jsPDF)
  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        document.head.appendChild(script);
      });
    };
    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
    ]);
  }, []);

  // Fetch Data from Google Sheets (or fallback to local dummy)
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    if (!GOOGLE_SHEET_WEB_APP_URL) {
      // Dummy data jika belum terhubung
      setTransactions([
        { id: 1, type: 'income', category: 'Kotak Amal Jumat', amount: 1500000, date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-05`, description: 'Jumat minggu pertama', paymentMethod: 'Tunai' },
        { id: 2, type: 'income', category: 'Donasi', amount: 500000, date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-10`, description: 'Hamba Allah via QRIS', paymentMethod: 'Non Tunai' },
        { id: 3, type: 'expense', category: 'Fasilitas & Operasional Masjid', amount: 300000, date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-12`, description: 'Bayar PLN', paymentMethod: 'Non Tunai' },
      ]);
      setSyncStatus('local');
      setIsLoading(false);
      return;
    }

    try {
      setSyncStatus('syncing');
      const response = await fetch(GOOGLE_SHEET_WEB_APP_URL);
      const data = await response.json();
      if (data && data.status === 'success') {
        setTransactions(data.data);
        setSyncStatus('synced');
      } else {
        throw new Error('Format data tidak sesuai');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter Transaksi berdasarkan bulan
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selectedMonth, selectedYear]);

  // Kalkulasi total
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, curr) => {
        if (curr.type === 'income') {
          acc.totalIncome += Number(curr.amount);
          acc.balance += Number(curr.amount);
        } else {
          acc.totalExpense += Number(curr.amount);
          acc.balance -= Number(curr.amount);
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, balance: 0 }
    );
  }, [filteredTransactions]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'type' && {
        category: value === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
      })
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || isNaN(formData.amount)) return alert('Nominal tidak valid');

    const newTx = {
      id: Date.now().toString(),
      ...formData,
      amount: Number(formData.amount)
    };

    // Update UI Cepat (Optimistic UI)
    setTransactions([newTx, ...transactions]);
    setIsModalOpen(false);
    setFormData({ ...formData, amount: '', description: '' }); // Reset partial

    // Simpan ke Google Sheet jika ada URL
    if (GOOGLE_SHEET_WEB_APP_URL) {
      setSyncStatus('syncing');
      try {
        await fetch(GOOGLE_SHEET_WEB_APP_URL, {
          method: 'POST',
          body: JSON.stringify(newTx),
        });
        setSyncStatus('synced');
      } catch (error) {
        console.error("Gagal simpan ke Sheet:", error);
        setSyncStatus('error');
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus transaksi ini?')) return;
    
    setTransactions(transactions.filter(t => t.id !== id));

    if (GOOGLE_SHEET_WEB_APP_URL) {
       setSyncStatus('syncing');
       try {
         await fetch(`${GOOGLE_SHEET_WEB_APP_URL}?action=delete&id=${id}`);
         setSyncStatus('synced');
       } catch (error) {
         setSyncStatus('error');
       }
    }
  };

  // Fungsi Export
  const generateExportElement = async () => {
    // Tampilkan elemen report sementara untuk difoto
    reportRef.current.style.display = 'block';
    const canvas = await window.html2canvas(reportRef.current, { scale: 2, useCORS: true });
    reportRef.current.style.display = 'none';
    return canvas;
  };

  const downloadJPG = async () => {
    try {
      const canvas = await generateExportElement();
      const link = document.createElement('a');
      link.download = `Laporan_Keuangan_Masjid_${MONTHS[selectedMonth]}_${selectedYear}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 1.0);
      link.click();
    } catch (err) {
      alert("Gagal membuat JPG. Pastikan script termuat sempurna.");
    }
  };

  const downloadPDF = async () => {
    try {
      const canvas = await generateExportElement();
      const imgData = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Laporan_Keuangan_Masjid_${MONTHS[selectedMonth]}_${selectedYear}.pdf`);
    } catch (err) {
      alert("Gagal membuat PDF. Pastikan script termuat sempurna.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner">
                <Building2 className="w-8 h-8 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Sistem Keuangan Masjid</h1>
                <p className="text-emerald-100/90 font-medium text-sm sm:text-base mt-1 tracking-wide">
                  Miftahul Yaqin
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex bg-white/10 rounded-xl p-1 backdrop-blur-sm border border-white/10">
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-transparent text-white font-medium px-3 py-2 outline-none appearance-none cursor-pointer"
                >
                  {MONTHS.map((m, i) => <option key={m} value={i} className="text-slate-800">{m}</option>)}
                </select>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-white font-medium px-3 py-2 outline-none appearance-none cursor-pointer border-l border-white/20 pl-4 ml-1"
                >
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => <option key={y} value={y} className="text-slate-800">{y}</option>)}
                </select>
              </div>
              
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-amber-400 to-amber-500 text-emerald-950 px-5 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-xl hover:from-amber-300 hover:to-amber-400 transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Catat Transaksi</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        
        {/* Status Sinkronisasi */}
        <div className="flex justify-end mb-4 text-xs font-medium">
          {syncStatus === 'local' && <span className="flex items-center text-slate-500 bg-white px-3 py-1.5 rounded-full shadow-sm"><CloudOff className="w-3.5 h-3.5 mr-1.5" /> Mode Lokal (Belum Terhubung G-Sheet)</span>}
          {syncStatus === 'syncing' && <span className="flex items-center text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full shadow-sm"><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Menyinkronkan...</span>}
          {syncStatus === 'synced' && <span className="flex items-center text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full shadow-sm"><CloudAuto className="w-3.5 h-3.5 mr-1.5" /> Tersimpan di Google Sheet</span>}
          {syncStatus === 'error' && <span className="flex items-center text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full shadow-sm"><CloudOff className="w-3.5 h-3.5 mr-1.5" /> Gagal Sinkronisasi</span>}
        </div>

        {/* Dashboard Cards (Berdasarkan Bulan) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Saldo {MONTHS[selectedMonth]}</h3>
              <div className="p-2 bg-emerald-100/50 rounded-lg text-emerald-600"><Wallet className="w-5 h-5" /></div>
            </div>
            <p className="text-3xl font-bold text-emerald-800">{formatRupiah(balance)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pemasukan</h3>
              <div className="p-2 bg-teal-100/50 rounded-lg text-teal-600"><TrendingUp className="w-5 h-5" /></div>
            </div>
            <p className="text-2xl font-bold text-teal-700">{formatRupiah(totalIncome)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pengeluaran</h3>
              <div className="p-2 bg-rose-100/50 rounded-lg text-rose-600"><TrendingDown className="w-5 h-5" /></div>
            </div>
            <p className="text-2xl font-bold text-rose-600">{formatRupiah(totalExpense)}</p>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4">
           <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <History className="w-5 h-5 text-emerald-600" />
              <span>Rincian {MONTHS[selectedMonth]} {selectedYear}</span>
           </div>
           <div className="flex gap-2">
              <button onClick={downloadJPG} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition">
                <ImageIcon className="w-4 h-4 text-emerald-600" /> <span className="hidden sm:inline">Download</span> JPG
              </button>
              <button onClick={downloadPDF} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition">
                <FileText className="w-4 h-4 text-rose-600" /> <span className="hidden sm:inline">Download</span> PDF
              </button>
           </div>
        </div>

        {/* Tabel Transaksi */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">Memuat data...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <AlignLeft className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-lg font-medium">Belum ada transaksi di bulan ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Tanggal</th>
                    <th className="px-5 py-4 font-semibold">Kategori</th>
                    <th className="px-5 py-4 font-semibold">Metode</th>
                    <th className="px-5 py-4 font-semibold">Keterangan</th>
                    <th className="px-5 py-4 font-semibold text-right">Nominal</th>
                    <th className="px-5 py-4 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-4 text-slate-600">
                        {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${t.type === 'income' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                          {t.category}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center text-slate-500 text-xs font-medium">
                          {t.paymentMethod === 'Tunai' ? <Banknote className="w-3.5 h-3.5 mr-1" /> : <CreditCard className="w-3.5 h-3.5 mr-1" />}
                          {t.paymentMethod}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 truncate max-w-[200px]" title={t.description}>
                        {t.description || '-'}
                      </td>
                      <td className={`px-5 py-4 text-right font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatRupiah(t.amount)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-rose-50 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* --- HIDDEN REPORT TEMPLATE (For Canvas Capture) --- */}
      <div style={{ display: 'none' }}>
        <div ref={reportRef} className="bg-white p-10 w-[800px] font-sans text-slate-800">
          <div className="text-center border-b-4 border-emerald-800 pb-6 mb-6">
            <h1 className="text-3xl font-bold text-emerald-900 mb-1">LAPORAN KEUANGAN MASJID</h1>
            <h2 className="text-xl font-bold text-emerald-700 mb-2">MIFTAHUL YAQIN</h2>
            <p className="text-slate-600 font-medium">Periode: Bulan {MONTHS[selectedMonth]} Tahun {selectedYear}</p>
          </div>

          <div className="flex gap-4 mb-8">
            <div className="flex-1 bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
               <p className="text-sm font-semibold text-emerald-700 mb-1">Total Pemasukan</p>
               <p className="text-xl font-bold text-emerald-900">{formatRupiah(totalIncome)}</p>
            </div>
            <div className="flex-1 bg-rose-50 border border-rose-200 p-4 rounded-xl text-center">
               <p className="text-sm font-semibold text-rose-700 mb-1">Total Pengeluaran</p>
               <p className="text-xl font-bold text-rose-900">{formatRupiah(totalExpense)}</p>
            </div>
            <div className="flex-1 bg-slate-100 border border-slate-300 p-4 rounded-xl text-center">
               <p className="text-sm font-semibold text-slate-700 mb-1">Saldo Bersih Bulan Ini</p>
               <p className="text-xl font-bold text-slate-900">{formatRupiah(balance)}</p>
            </div>
          </div>

          <table className="w-full text-left text-sm border-collapse mb-8">
             <thead>
               <tr className="bg-emerald-800 text-white">
                 <th className="border border-emerald-900 px-3 py-2">Tanggal</th>
                 <th className="border border-emerald-900 px-3 py-2">Keterangan</th>
                 <th className="border border-emerald-900 px-3 py-2">Kategori</th>
                 <th className="border border-emerald-900 px-3 py-2">Metode</th>
                 <th className="border border-emerald-900 px-3 py-2 text-right">Pemasukan</th>
                 <th className="border border-emerald-900 px-3 py-2 text-right">Pengeluaran</th>
               </tr>
             </thead>
             <tbody>
               {filteredTransactions.map(t => (
                 <tr key={t.id} className="border-b border-slate-200">
                   <td className="border border-slate-300 px-3 py-2">{new Date(t.date).toLocaleDateString('id-ID', {day: '2-digit', month:'2-digit', year:'numeric'})}</td>
                   <td className="border border-slate-300 px-3 py-2">{t.description || '-'}</td>
                   <td className="border border-slate-300 px-3 py-2">{t.category}</td>
                   <td className="border border-slate-300 px-3 py-2">{t.paymentMethod}</td>
                   <td className="border border-slate-300 px-3 py-2 text-right text-emerald-700">{t.type === 'income' ? formatRupiah(t.amount) : '-'}</td>
                   <td className="border border-slate-300 px-3 py-2 text-right text-rose-700">{t.type === 'expense' ? formatRupiah(t.amount) : '-'}</td>
                 </tr>
               ))}
             </tbody>
          </table>

          <div className="flex justify-between mt-16 px-10">
             <div className="text-center">
                <p className="mb-16">Mengetahui,<br/>Ketua DKM</p>
                <p className="font-bold underline">_________________</p>
             </div>
             <div className="text-center">
                <p className="mb-16">Dibuat Oleh,<br/>Bendahara Masjid</p>
                <p className="font-bold underline">_________________</p>
             </div>
          </div>
        </div>
      </div>
      {/* --- END HIDDEN REPORT --- */}


      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-800 to-teal-800 text-white">
              <h3 className="text-lg font-bold">Input Transaksi</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <label className="flex-1 cursor-pointer">
                  <input type="radio" name="type" value="income" checked={formData.type === 'income'} onChange={handleInputChange} className="peer sr-only" />
                  <div className="text-center py-2 rounded-lg font-semibold text-sm text-slate-500 peer-checked:bg-white peer-checked:text-emerald-600 peer-checked:shadow-sm transition-all">Pemasukan</div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input type="radio" name="type" value="expense" checked={formData.type === 'expense'} onChange={handleInputChange} className="peer sr-only" />
                  <div className="text-center py-2 rounded-lg font-semibold text-sm text-slate-500 peer-checked:bg-white peer-checked:text-rose-600 peer-checked:shadow-sm transition-all">Pengeluaran</div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2"><Tag className="w-4 h-4 text-emerald-600" /> Kategori</label>
                <select name="category" value={formData.category} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm" required>
                  {(formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600" /> Nominal (Rp)</label>
                <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} min="0" placeholder="Contoh: 500000" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-lg" required />
              </div>

               <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-3">
                   <label className={`border rounded-xl p-3 flex items-center gap-2 cursor-pointer transition ${formData.paymentMethod === 'Tunai' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input type="radio" name="paymentMethod" value="Tunai" checked={formData.paymentMethod === 'Tunai'} onChange={handleInputChange} className="sr-only" />
                      <Banknote className="w-5 h-5" /> <span className="font-medium text-sm">Tunai</span>
                   </label>
                   <label className={`border rounded-xl p-3 flex items-center gap-2 cursor-pointer transition ${formData.paymentMethod === 'Non Tunai' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input type="radio" name="paymentMethod" value="Non Tunai" checked={formData.paymentMethod === 'Non Tunai'} onChange={handleInputChange} className="sr-only" />
                      <CreditCard className="w-5 h-5" /> <span className="font-medium text-sm">Non Tunai <br/><span className="text-[10px] font-normal leading-none">(QRIS/Transfer)</span></span>
                   </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-600" /> Tanggal</label>
                <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm" required />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2"><AlignLeft className="w-4 h-4 text-emerald-600" /> Keterangan</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows="2" placeholder="Catatan opsional..." className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"></textarea>
              </div>

              <div className="pt-2 flex space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">Batal</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```
