// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

// --- COMPONENTE DE ICONOS GRÁFICOS (SVG) ---
// Aquí es donde la "magia" interpreta el nombre del producto
const ProductIcon = ({ name, className = "w-6 h-6" }) => {
  const n = name.toLowerCase();
  // Lógica de interpretación visual
  if (n.includes('pan') || n.includes('birote')) return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 13c1.1 0 2.2-.4 3-1.2.8.8 1.9 1.2 3 1.2s2.2-.4 3-1.2c.8.8 1.9 1.2 3 1.2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2z"/><path d="M2 10h20"/><path d="M7 13v5c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-5"/></svg>;
  if (n.includes('refresco') || n.includes('coca') || n.includes('agua') || n.includes('jugo')) return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 3h10v18H7z"/><path d="M7 7h10"/><path d="M10 3v18"/><path d="M14 3v18"/></svg>;
  if (n.includes('jamon') || n.includes('carne') || n.includes('tocino')) return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/><path d="M7 12c2 0 4-2 4-4s-2-4-4-4-4 2-4 4 2 4 4 4z"/></svg>;
  if (n.includes('cafe') || n.includes('tea') || n.includes('caliente')) return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>;
  // Icono genérico (Caja)
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
};

const IconMoney = () => <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const IconCaja = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 9.5h20"/></svg>;
const IconStock = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H3M21 6H3M21 14H3M21 18H3"/></svg>;
const IconCorte = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>;

export default function VelascoPOS_Final_NoEmoji() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vista, setVista] = useState('pos');
  const [carrito, setCarrito] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [montado, setMontado] = useState(false);
  const [ticketImpresion, setTicketImpresion] = useState({ items: [], total: 0, fecha: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', stock: 0 });

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
    if (error) alert("Credenciales incorrectas, viejo.");
    else window.location.reload();
  };

  const agregarAlCarrito = (p) => {
    const ex = carrito.find(i => i.id === p.id);
    if (ex) setCarrito(carrito.map(i => i.id === p.id ? {...i, cant: i.cant + 1} : i));
    else setCarrito([...carrito, {...p, cant: 1}]);
  };

  const finalizarVenta = async (imprimir = false) => {
    if (carrito.length === 0) return;
    const subtotal = carrito.reduce((a,b)=>a+(b.precio*b.cant), 0);
    const totalVenta = subtotal * 1.16;
    const fechaActual = new Date().toLocaleString();

    const { data: vRealizada, error: vError } = await supabase.from('ventas').insert([{ items: carrito, total: totalVenta }]).select();
    if (vError) return alert("Error al guardar venta");

    for (const item of carrito) {
        await supabase.rpc('decrement_stock', { row_id: item.id, amount: item.cant });
    }

    if (imprimir) {
        setTicketImpresion({ items: [...carrito], total: totalVenta, fecha: fechaActual });
        setTimeout(() => { window.print(); setCarrito([]); fetchData(); }, 500);
    } else {
        alert("✅ Venta Guardada con éxito");
        setCarrito([]);
        fetchData();
    }
  };

  if (!session && montado) {
    return (
      <div className="bg-slate-900 h-screen flex items-center justify-center p-6 text-black">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md text-center border-t-8 border-blue-600">
          <h1 className="text-blue-600 font-black italic text-4xl mb-2">VD <span className="text-slate-900 not-italic">POS</span></h1>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-8 font-bold">Terminal Segura</p>
          <input type="email" placeholder="Usuario" className="w-full bg-slate-50 p-5 rounded-2xl mb-4 text-black font-bold outline-none border-2 border-transparent focus:border-blue-500" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Clave" className="w-full bg-slate-50 p-5 rounded-2xl mb-8 text-black font-bold outline-none border-2 border-transparent focus:border-blue-500" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700">INICIAR SESIÓN</button>
        </div>
      </div>
    );
  }

  if (!montado) return null;

  return (
    <div className="bg-slate-100 h-screen flex flex-col font-sans overflow-hidden text-black">
      
      <style>{`
        @media screen { #printable-ticket { display: none; } }
        @media print {
            body * { visibility: hidden !important; }
            #printable-ticket, #printable-ticket * { visibility: visible !important; }
            #printable-ticket { 
                position: absolute; left: 0; top: 0; 
                width: 80mm !important; 
                padding: 5mm;
                font-family: monospace !important;
                color: black !important;
            }
        }
      `}</style>

      {/* DISEÑO DEL TICKET (ESTÉTICA MINIMALISTA) */}
      <div id="printable-ticket">
          <center>
            <h2 style={{fontSize: '16px', fontWeight: 'bold', margin: 0}}>VELASCO DIGITAL</h2>
            <p style={{fontSize: '9px'}}>SISTEMA DE PUNTO DE VENTA</p>
            <p>--------------------------------</p>
          </center>
          <div style={{fontSize: '11px', margin: '10px 0'}}>
            {ticketImpresion.items.map((it, idx) => (
                <div key={idx} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                    <span>{it.cant}x {it.nombre}</span>
                    <span>${(it.precio * it.cant).toFixed(2)}</span>
                </div>
            ))}
          </div>
          <p>--------------------------------</p>
          <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px'}}>
            <span>TOTAL:</span>
            <span>${ticketImpresion.total.toFixed(2)}</span>
          </div>
          <center>
            <p style={{marginTop: '15px', fontSize: '9px'}}>{ticketImpresion.fecha}</p>
            <p style={{fontSize: '8px'}}>Comprobante Digital No Fiscal</p>
          </center>
      </div>

      {/* NAVBAR CON ICONOS GRÁFICOS */}
      <nav className="bg-slate-900 p-3 flex justify-between items-center shadow-xl border-b-2 border-blue-600 no-print">
        <div className="flex items-center gap-4">
          <h1 className="text-blue-500 font-black italic text-xl px-2">VD POS</h1>
          <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setVista('pos')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'pos' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
                <IconCaja /> CAJA
            </button>
            <button onClick={() => setVista('inventario')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'inventario' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>
                <IconStock /> STOCK
            </button>
            <button onClick={() => setVista('corte')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'corte' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>
                <IconCorte /> CORTE
            </button>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="text-red-500 font-black text-[9px] uppercase border border-red-500/20 px-3 py-2 rounded-xl">Cerrar Sesión</button>
      </nav>

      {/* VISTA POS CON INTERPRETACIÓN VISUAL */}
      {vista === 'pos' && (
        <main className="flex-1 flex overflow-hidden p-4 gap-4 animate-in fade-in">
          <section className="flex-[3] grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 content-start overflow-y-auto pr-2">
            {catalogo.map(p => (
              <button key={p.id} onClick={() => agregarAlCarrito(p)} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-blue-500 active:scale-95 transition-all flex flex-col items-center group">
                {/* Aquí está el icono inteligente que lee el nombre */}
                <div className="text-blue-600 mb-3 transition-transform group-hover:scale-110">
                    <ProductIcon name={p.nombre} className="w-10 h-10" />
                </div>
                <h3 className="font-bold text-slate-800 uppercase text-[10px] text-center mb-1">{p.nombre}</h3>
                <p className="text-slate-900 font-black text-sm">${parseFloat(p.precio).toFixed(2)}</p>
                <div className={`mt-3 px-3 py-1 rounded-full text-[8px] font-black uppercase ${p.stock > 10 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>Quedan: {p.stock}</div>
              </button>
            ))}
          </section>

          <section className="flex-1 min-w-[320px] bg-white rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border">
              <div className="p-6 bg-slate-50 border-b flex justify-between items-center font-black text-[10px] text-slate-400 uppercase tracking-widest">Carrito de Ventas</div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {carrito.map(i => (
                    <div key={i.id} className="flex justify-between items-center text-xs border-b border-slate-100 pb-3">
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-800 uppercase">{i.nombre}</span>
                            <span className="text-[10px] text-blue-500 font-bold">{i.cant} x ${parseFloat(i.precio).toFixed(2)}</span>
                        </div>
                        <span className="font-black text-slate-900 text-sm">${(i.precio * i.cant).toFixed(2)}</span>
                    </div>
                ))}
              </div>
              <div className="p-8 bg-slate-900 text-white rounded-t-[3.5rem]">
                <div className="flex justify-between items-end mb-8">
                    <span className="text-blue-400 font-black italic text-sm">TOTAL:</span>
                    <span className="text-4xl font-black text-green-400">${(carrito.reduce((a,b)=>a+(b.precio*b.cant),0)*1.16).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => finalizarVenta(false)} className="bg-slate-700 py-5 rounded-[1.5rem] font-black text-[10px] uppercase">Registrar</button>
                    <button onClick={() => finalizarVenta(true)} className="bg-blue-600 py-5 rounded-[1.5rem] font-black text-[10px] uppercase shadow-lg">Imprimir</button>
                </div>
              </div>
          </section>
        </main>
      )}

      {/* VISTA CORTE CON PANEL PREMIUM (Símbolo de dinero SVG) */}
      {vista === 'corte' && (
        <main className="flex-1 p-8 overflow-y-auto animate-in fade-in">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 p-12 rounded-[3.5rem] text-white shadow-2xl flex justify-between items-center relative overflow-hidden group">
                <div className="z-10">
                    <p className="text-[10px] font-black uppercase opacity-70 tracking-[0.3em] mb-3">Balance Total</p>
                    <h2 className="text-6xl font-black tracking-tighter tabular-nums text-white">
                        ${historial.reduce((acc,v)=>acc+parseFloat(v.total),0).toFixed(2)}
                    </h2>
                </div>
                {/* Elemento gráfico de dinero en lugar de emoji */}
                <div className="z-10 bg-white/10 p-5 rounded-full backdrop-blur-md text-white">
                    <IconMoney />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-black text-slate-800 uppercase italic text-xl tracking-tighter px-2">Movimientos del Día</h3>
                {historial.map(v => (
                    <div key={v.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(v.fecha).toLocaleTimeString()}</span>
                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight italic">Venta Registrada</span>
                            </div>
                            <span className="font-black text-emerald-600 text-xl tabular-nums">${parseFloat(v.total).toFixed(2)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {v.items.map((item, idx) => (
                                <span key={idx} className="bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 text-[9px] font-bold text-slate-600 uppercase flex items-center gap-2">
                                    <ProductIcon name={item.nombre} className="w-3 h-3" />
                                    {item.cant}x {item.nombre}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

      {/* VISTA INVENTARIO */}
      {vista === 'inventario' && (
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
              <h2 className="font-black text-2xl mb-8 italic uppercase text-slate-800 text-center tracking-tighter">Inventario de Productos</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nombre (Ej: Jamón de pierna)" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none text-black" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}/>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Precio ($)" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none text-black" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}/>
                    <input type="number" placeholder="Stock Inicial" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none text-black" value={nuevoProd.stock} onChange={e => setNuevoProd({...nuevoProd, stock: parseInt(e.target.value)})}/>
                </div>
                <button onClick={async () => {
                    const { data } = await supabase.from('productos').insert([nuevoProd]).select();
                    if (data) setCatalogo([...catalogo, data[0]]);
                    setNuevoProd({nombre:'', precio:'', stock: 0});
                }} className="w-full bg-slate-900 text-white font-black py-5 rounded-[1.5rem] shadow-xl uppercase text-[10px] tracking-widest">Añadir al Sistema</button>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
                {catalogo.map(p => (
                    <div key={p.id} className="p-4 border-b flex justify-between items-center text-[10px] font-bold uppercase">
                        <div className="flex items-center gap-3">
                            <ProductIcon name={p.nombre} className="w-4 h-4 text-slate-400" />
                            <span>{p.nombre} ({p.stock} pz)</span>
                        </div>
                        <button onClick={async () => {
                            await supabase.from('productos').delete().eq('id', p.id);
                            setCatalogo(catalogo.filter(x => x.id !== p.id));
                        }} className="text-red-400 hover:underline">Eliminar</button>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

    </div>
  );
}
