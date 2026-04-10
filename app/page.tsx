// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function VelascoPOS_Universal_Edition() {
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
    if (error) alert("Acceso denegado, viejo.");
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

    const { error } = await supabase.from('ventas').insert([{ items: carrito, total: totalVenta }]).select();
    if (error) return alert("Error de conexión");

    for (const item of carrito) {
        await supabase.rpc('decrement_stock', { row_id: item.id, amount: item.cant });
    }

    if (imprimir) {
        setTicketImpresion({ items: [...carrito], total: totalVenta, fecha: fechaActual });
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
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 transition-all">ENTRAR AL SISTEMA</button>
        </div>
      </div>
    );
  }

  if (!montado) return null;

  return (
    <div className="bg-slate-50 h-screen flex flex-col font-sans overflow-hidden text-black">
      
      {/* TICKET (Forzado a 80mm para cualquier impresora) */}
      <style>{`
        @media print {
            body * { visibility: hidden !important; }
            #tk, #tk * { visibility: visible !important; }
            #tk { position: absolute; left: 0; top: 0; width: 80mm !important; padding: 5mm; font-family: monospace; color: black; }
        }
      `}</style>

      <div id="tk">
          <center><h2 className="font-bold uppercase">Velasco Digital</h2><p>Punto de Venta</p>----------------------------</center>
          {ticketImpresion.items.map((it, idx) => (
            <div key={idx} className="flex justify-between text-xs my-1">
                <span>{it.cant}x {it.nombre}</span>
                <span>${(it.precio * it.cant).toFixed(2)}</span>
            </div>
          ))}
          <p>----------------------------</p>
          <div className="flex justify-between font-bold text-sm"><span>TOTAL:</span><span>${ticketImpresion.total.toFixed(2)}</span></div>
          <center><p className="text-[9px] mt-4">{ticketImpresion.fecha}</p></center>
      </div>

      {/* NAVBAR UNIVERSAL */}
      <nav className="bg-slate-900 p-3 flex flex-col sm:flex-row justify-between items-center shadow-xl border-b border-blue-600/30 no-print gap-3">
        <h1 className="text-blue-500 font-black italic text-xl tracking-tighter">VD POS</h1>
        <div className="flex gap-1 bg-slate-800 p-1 rounded-2xl w-full sm:w-auto">
            <button onClick={() => setVista('pos')} className={`flex-1 sm:px-6 py-2 rounded-xl text-[10px] font-black tracking-widest ${vista === 'pos' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>CAJA</button>
            <button onClick={() => setVista('inventario')} className={`flex-1 sm:px-6 py-2 rounded-xl text-[10px] font-black tracking-widest ${vista === 'inventario' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>STOCK</button>
            <button onClick={() => setVista('corte')} className={`flex-1 sm:px-6 py-2 rounded-xl text-[10px] font-black tracking-widest ${vista === 'corte' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>CORTE</button>
        </div>
        <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="hidden sm:block text-red-500 font-bold text-[9px] uppercase border border-red-500/20 px-4 py-2 rounded-xl">Salir</button>
      </nav>

      {/* CONTENIDO RESPONSIVO */}
      {vista === 'pos' && (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* GRILLA DE PRODUCTOS: 2 cols en cel, 4 en tablet, 6 en PC */}
          <section className="flex-1 p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 content-start">
            {catalogo.map(p => (
              <button key={p.id} onClick={() => agregarAlCarrito(p)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:border-blue-500 active:scale-95 transition-all text-left flex flex-col justify-between h-36">
                <div>
                    <h3 className="font-black text-slate-800 uppercase text-[10px] leading-tight mb-2">{p.nombre}</h3>
                    <p className="text-blue-600 font-black text-lg tracking-tighter">${parseFloat(p.precio).toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-center">
                    <span className={`text-[8px] font-black px-2 py-1 rounded-lg ${p.stock > 10 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>STOCK: {p.stock}</span>
                </div>
              </button>
            ))}
          </section>

          {/* CARRITO: Abajo en cel, Derecha en PC */}
          <section className="w-full md:w-80 lg:w-96 bg-white border-t md:border-t-0 md:border-l shadow-2xl flex flex-col h-[45vh] md:h-full">
            <div className="p-5 bg-slate-50 border-b flex justify-between font-black text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                <span>Carrito</span>
                <button onClick={() => setCarrito([])} className="text-red-400 font-bold">Vaciar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {carrito.map(i => (
                <div key={i.id} className="flex justify-between items-start text-xs border-b border-dashed border-slate-200 pb-3">
                  <div className="flex flex-col flex-1 pr-4">
                    <span className="font-black text-slate-800 uppercase leading-tight">{i.nombre}</span>
                    <span className="text-[10px] text-blue-500 font-bold">{i.cant} unidad(es)</span>
                  </div>
                  <span className="font-black text-slate-900">${(i.precio * i.cant).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="p-6 bg-slate-900 text-white md:rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
              <div className="flex justify-between items-end mb-6">
                <span className="text-blue-400 font-black italic text-xs uppercase tracking-widest">Total:</span>
                <span className="text-4xl font-black text-green-400 tracking-tighter tabular-nums">${(carrito.reduce((a,b)=>a+(b.precio*b.cant),0)*1.16).toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => finalizarVenta(false)} className="bg-slate-700 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Registrar</button>
                <button onClick={() => finalizarVenta(true)} className="bg-blue-600 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/30">Ticket</button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* VISTA CORTE (GRADIENTE PREMIUM) */}
      {vista === 'corte' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 p-10 md:p-14 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="z-10 relative">
                    <p className="text-[10px] font-black uppercase opacity-70 tracking-[0.3em] mb-3">Balance del Día</p>
                    <h2 className="text-5xl md:text-7xl font-black tracking-tighter tabular-nums">
                        ${historial.reduce((acc,v)=>acc+parseFloat(v.total),0).toFixed(2)}
                    </h2>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl font-black">$</div>
            </div>
            <div className="space-y-3">
                <h3 className="font-black text-slate-800 uppercase text-xs px-4 italic">Historial Reciente</h3>
                {historial.map(v => (
                    <div key={v.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[9px] text-slate-400 font-black uppercase">{new Date(v.fecha).toLocaleTimeString()}</span>
                            <span className="font-black text-slate-900 text-xl">${parseFloat(v.total).toFixed(2)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {v.items.map((item, idx) => (
                                <span key={idx} className="bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 text-[9px] font-black text-slate-600 uppercase">
                                    {item.cant} {item.nombre}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

      {/* VISTA INVENTARIO (LIMPIO) */}
      {vista === 'inventario' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border border-slate-100 text-center">
              <h2 className="font-black text-2xl mb-8 italic uppercase text-slate-800 tracking-tighter">Inventario</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nombre del Producto" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}/>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Precio ($)" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}/>
                    <input type="number" placeholder="Stock Inicial" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none" value={nuevoProd.stock} onChange={e => setNuevoProd({...nuevoProd, stock: parseInt(e.target.value)})}/>
                </div>
                <button onClick={async () => {
                    const { data } = await supabase.from('productos').insert([nuevoProd]).select();
                    if (data) setCatalogo([...catalogo, data[0]]);
                    setNuevoProd({nombre:'', precio:'', stock: 0});
                }} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95">Añadir al Sistema</button>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
                {catalogo.map(p => (
                    <div key={p.id} className="p-4 border-b border-slate-50 flex justify-between items-center text-[10px] font-black uppercase">
                        <span>{p.nombre} ({p.stock} pz)</span>
                        <button onClick={async () => {
                            await supabase.from('productos').delete().eq('id', p.id);
                            setCatalogo(catalogo.filter(x => x.id !== p.id));
                        }} className="text-red-500 hover:underline">Eliminar</button>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

    </div>
  );
}
