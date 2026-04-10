// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

export default function VelascoPOS_Barcode_Edition() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vista, setVista] = useState('pos');
  const [carrito, setCarrito] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [montado, setMontado] = useState(false);
  const [ticketImpresion, setTicketImpresion] = useState({ items: [], total: 0, fecha: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', stock: 0, barcode: '' });
  const [inputBarras, setInputBarras] = useState(''); // Para el lector de barras
  const inputRef = useRef(null);

  useEffect(() => {
    setMontado(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) fetchData();
    });
  }, []);

  const fetchData = async () => {
    const { data: catData } = await supabase.from('productos').select('*').order('id', { ascending: true });
    if (catData) setCatalogo(catData);
    const { data: histData } = await supabase.from('ventas').select('*').order('id', { ascending: false }).limit(20);
    if (histData) setHistorial(histData);
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Acceso denegado, viejo.");
    else window.location.reload();
  };

  const agregarAlCarrito = (p) => {
    const ex = carrito.find(i => i.id === p.id);
    if (ex) setCarrito(carrito.map(i => i.id === p.id ? {...i, cant: i.cant + 1} : i));
    else setCarrito([...carrito, {...p, cant: 1}]);
  };

  // --- LÓGICA DEL LECTOR DE BARRAS ---
  const handleBarcodeSearch = (e) => {
    e.preventDefault();
    const productoEncontrado = catalogo.find(p => p.barcode === inputBarras);
    if (productoEncontrado) {
      agregarAlCarrito(productoEncontrado);
      setInputBarras(''); // Limpiar para el siguiente escaneo
    } else {
      alert("Código no registrado: " + inputBarras);
      setInputBarras('');
    }
  };

  const actualizarStockManual = async (id, nuevoStock) => {
    const { error } = await supabase.from('productos').update({ stock: parseInt(nuevoStock) }).eq('id', id);
    if (error) fetchData();
  };

  const finalizarVenta = async (imprimir = false) => {
    if (carrito.length === 0) return;
    const subtotal = carrito.reduce((a,b)=>a+(b.precio*b.cant), 0);
    const totalVenta = subtotal * 1.16;
    const { error } = await supabase.from('ventas').insert([{ items: carrito, total: totalVenta }]).select();
    if (error) return alert("Error de conexión");
    for (const item of carrito) {
        await supabase.rpc('decrement_stock', { row_id: item.id, amount: item.cant });
    }
    if (imprimir) {
        setTicketImpresion({ items: [...carrito], total: totalVenta, fecha: new Date().toLocaleString() });
        setTimeout(() => { window.print(); setCarrito([]); fetchData(); }, 500);
    } else {
        alert("VENTA CONFIRMADA");
        setCarrito([]);
        fetchData();
    }
  };

  if (!session && montado) {
    return (
      <div className="bg-slate-900 h-screen flex items-center justify-center p-6 text-black">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md text-center border-t-8 border-blue-600">
          <h1 className="text-blue-600 font-black italic text-4xl mb-2 tracking-tighter">VD POS</h1>
          <p className="text-slate-400 text-[10px] uppercase tracking-[0.3em] mb-8 font-bold">Terminal de Acceso</p>
          <input type="email" placeholder="Usuario" className="w-full bg-slate-50 p-5 rounded-2xl mb-4 font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Clave" className="w-full bg-slate-50 p-5 rounded-2xl mb-8 font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl">ENTRAR</button>
        </div>
      </div>
    );
  }

  if (!montado) return null;

  return (
    <div className="bg-slate-50 h-screen flex flex-col font-sans overflow-hidden text-black">
      
      <style>{`
        @media screen { #tk-gh { display: none !important; } }
        @media print {
            body * { visibility: hidden !important; }
            #tk-gh, #tk-gh * { visibility: visible !important; }
            #tk-gh { position: absolute; left: 0; top: 0; width: 80mm !important; padding: 5mm; font-family: monospace; color: black !important; display: block !important; }
        }
      `}</style>

      {/* TICKET INVISIBLE */}
      <div id="tk-gh">
          <center><h2 className="font-bold uppercase">Velasco Digital</h2><p>Punto de Venta</p>----------------------------</center>
          <div style={{margin: '10px 0'}}>
            {ticketImpresion.items.map((it, idx) => (
                <div key={idx} style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px'}}>
                    <span>{it.cant}x {it.nombre}</span>
                    <span>${(it.precio * it.cant).toFixed(2)}</span>
                </div>
            ))}
          </div>
          <p>----------------------------</p>
          <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px'}}>
            <span>TOTAL:</span><span>${ticketImpresion.total.toFixed(2)}</span>
          </div>
          <center><p style={{fontSize: '9px', marginTop: '15px'}}>{ticketImpresion.fecha}</p></center>
      </div>

      {/* NAVBAR */}
      <nav className="bg-slate-900 p-3 flex flex-col sm:flex-row justify-between items-center shadow-xl border-b border-blue-600/30 no-print gap-3">
        <h1 className="text-blue-500 font-black italic text-xl">VD POS</h1>
        <div className="flex gap-1 bg-slate-800 p-1 rounded-2xl w-full sm:w-auto">
            <button onClick={() => setVista('pos')} className={`flex-1 sm:px-6 py-2 rounded-xl text-[10px] font-black ${vista === 'pos' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>CAJA</button>
            <button onClick={() => setVista('inventario')} className={`flex-1 sm:px-6 py-2 rounded-xl text-[10px] font-black ${vista === 'inventario' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>STOCK</button>
            <button onClick={() => setVista('corte')} className={`flex-1 sm:px-6 py-2 rounded-xl text-[10px] font-black ${vista === 'corte' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>CORTE</button>
        </div>
      </nav>

      {/* VISTA CAJA CON LECTOR DE BARRAS */}
      {vista === 'pos' && (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden animate-in fade-in">
          <section className="flex-1 p-4 overflow-y-auto flex flex-col">
            {/* INPUT DEL LECTOR (Siempre listo) */}
            <form onSubmit={handleBarcodeSearch} className="mb-4">
                <input 
                    type="text" 
                    placeholder="Escanear Código de Barras..." 
                    className="w-full bg-white p-4 rounded-2xl shadow-sm border border-blue-100 font-bold text-xs outline-none focus:border-blue-500 transition-all"
                    value={inputBarras}
                    onChange={(e) => setInputBarras(e.target.value)}
                    autoFocus
                />
            </form>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 content-start">
                {catalogo.map(p => (
                <button key={p.id} onClick={() => agregarAlCarrito(p)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:border-blue-500 active:scale-95 transition-all text-left flex flex-col justify-between h-36">
                    <div>
                        <h3 className="font-black text-slate-800 uppercase text-[10px] leading-tight mb-2 h-8 overflow-hidden">{p.nombre}</h3>
                        <p className="text-blue-600 font-black text-lg tracking-tighter">${parseFloat(p.precio).toFixed(2)}</p>
                    </div>
                    <span className={`text-[8px] font-black px-2 py-1 rounded-lg w-fit ${p.stock > 10 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>Stock: {p.stock}</span>
                </button>
                ))}
            </div>
          </section>

          <section className="w-full md:w-80 lg:w-96 bg-white border-t md:border-t-0 md:border-l shadow-2xl flex flex-col h-[45vh] md:h-full">
            <div className="p-5 bg-slate-50 border-b flex justify-between font-black text-[10px] text-slate-400 uppercase tracking-widest">Carrito de Ventas</div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {carrito.map(i => (
                <div key={i.id} className="flex justify-between items-start text-xs border-b border-dashed border-slate-200 pb-3">
                  <span className="font-black text-slate-800 uppercase flex-1 pr-2">{i.cant}x {i.nombre}</span>
                  <span className="font-black text-slate-900">${(i.precio * i.cant).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="p-6 bg-slate-900 text-white md:rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
              <div className="flex justify-between items-end mb-6 px-2">
                <span className="text-blue-400 font-black italic text-xs">TOTAL:</span>
                <span className="text-4xl font-black text-green-400 tracking-tighter">${(carrito.reduce((a,b)=>a+(b.precio*b.cant),0)*1.16).toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => finalizarVenta(false)} className="bg-slate-700 py-5 rounded-2xl font-black text-[10px] uppercase">Registrar</button>
                <button onClick={() => finalizarVenta(true)} className="bg-blue-600 py-5 rounded-2xl font-black text-[10px] uppercase shadow-lg">Ticket</button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* VISTA CORTE (GRADIENTE) */}
      {vista === 'corte' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 p-10 md:p-14 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="z-10 relative">
                    <p className="text-[10px] font-black uppercase opacity-70 tracking-[0.3em] mb-3">Balance Diario</p>
                    <h2 className="text-5xl md:text-7xl font-black tracking-tighter tabular-nums">
                        ${historial.reduce((acc,v)=>acc+parseFloat(v.total),0).toFixed(2)}
                    </h2>
                </div>
            </div>
            <div className="space-y-4">
                <h3 className="font-black text-slate-800 uppercase text-xs px-4 italic">Historial</h3>
                {historial.map(v => (
                    <div key={v.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[9px] text-slate-400 font-black uppercase">{new Date(v.fecha).toLocaleTimeString()}</span>
                            <span className="font-black text-slate-900 text-xl tabular-nums">${parseFloat(v.total).toFixed(2)}</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl flex flex-wrap gap-2 text-[9px] font-black text-slate-600 uppercase">
                            {v.items.map((item, idx) => (<span key={idx}>{item.cant}x {item.nombre}</span>))}
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

      {/* VISTA INVENTARIO CON BARCODE */}
      {vista === 'inventario' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border border-slate-100">
              <h2 className="font-black text-2xl mb-8 italic uppercase text-slate-800 tracking-tighter text-center">Gestión Global</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nombre" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}/>
                <input type="text" placeholder="Código de Barras (Escanea aquí)" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.barcode} onChange={e => setNuevoProd({...nuevoProd, barcode: e.target.value})}/>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Precio ($)" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}/>
                    <input type="number" placeholder="Stock" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none" value={nuevoProd.stock} onChange={e => setNuevoProd({...nuevoProd, stock: parseInt(e.target.value)})}/>
                </div>
                <button onClick={async () => {
                    const { data } = await supabase.from('productos').insert([nuevoProd]).select();
                    if (data) setCatalogo([...catalogo, data[0]]);
                    setNuevoProd({nombre:'', precio:'', stock: 0, barcode: ''});
                }} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Registrar Producto</button>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
                {catalogo.map(p => (
                    <div key={p.id} className="p-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex-1">
                            <span className="font-black text-[10px] text-slate-800 uppercase block">{p.nombre}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">Código: {p.barcode || 'Sin Código'}</span>
                            <span className="text-[9px] text-blue-500 font-bold uppercase">Precio: ${parseFloat(p.precio).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="number" className="w-20 bg-slate-50 p-2 rounded-lg font-black text-center text-xs border" defaultValue={p.stock} onBlur={(e) => actualizarStockManual(p.id, e.target.value)}/>
                            <button onClick={async () => { if(confirm("¿Eliminar?")) { await supabase.from('productos').delete().eq('id', p.id); fetchData(); } }} className="text-red-500 font-black text-[9px] uppercase border px-3 py-2 rounded-lg">Borrar</button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

    </div>
  );
}
