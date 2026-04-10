// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function VelascoPOS_Final_Pro() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vista, setVista] = useState('pos');
  const [carrito, setCarrito] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [montado, setMontado] = useState(false);
  const [ticketImpresion, setTicketImpresion] = useState({ items: [], total: 0, fecha: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', icono: '📦', stock: 0 });

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

    // 1. Guardar Venta
    const { data: vRealizada, error: vError } = await supabase.from('ventas').insert([{ items: carrito, total: totalVenta }]).select();
    if (vError) return alert("Error al guardar venta");

    // 2. Restar Stock (Usando la función de Supabase)
    for (const item of carrito) {
        await supabase.rpc('decrement_stock', { row_id: item.id, amount: item.cant });
    }

    // 3. Preparar Ticket antes de limpiar
    if (imprimir) {
        setTicketImpresion({ items: [...carrito], total: totalVenta, fecha: fechaActual });
        setTimeout(() => { window.print(); setCarrito([]); fetchData(); }, 500);
    } else {
        alert("✅ Venta Guardada");
        setCarrito([]);
        fetchData();
    }
  };

  if (!session && montado) {
    return (
      <div className="bg-slate-900 h-screen flex items-center justify-center p-6 text-black">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md text-center">
          <h1 className="text-blue-600 font-black italic text-4xl mb-2">VD POS</h1>
          <p className="text-slate-400 text-[10px] uppercase mb-8 font-bold">Acceso Privado</p>
          <input type="email" placeholder="Correo" className="w-full bg-slate-100 p-4 rounded-2xl mb-4 font-bold outline-none" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Clave" className="w-full bg-slate-100 p-4 rounded-2xl mb-8 font-bold outline-none" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl">ENTRAR</button>
        </div>
      </div>
    );
  }

  if (!montado) return null;

  return (
    <div className="bg-slate-100 h-screen flex flex-col font-sans overflow-hidden text-black">
      <style>{`
        @media screen { #printable-ticket { position: fixed; left: -9999px; } }
        @media print {
            body * { visibility: hidden !important; }
            #printable-ticket, #printable-ticket * { visibility: visible !important; }
            #printable-ticket { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        }
      `}</style>

      {/* TICKET OCULTO */}
      <div id="printable-ticket" className="bg-white p-4 font-mono text-black">
          <center>
            <h2 className="font-bold">VELASCO DIGITAL</h2>
            <p>Ticket de Venta</p>
            <p>---------------------------</p>
          </center>
          {ticketImpresion.items.map((it, idx) => (
            <div key={idx} className="flex justify-between text-xs">
                <span>{it.cant}x {it.nombre}</span>
                <span>${(it.precio * it.cant).toFixed(2)}</span>
            </div>
          ))}
          <p>---------------------------</p>
          <div className="flex justify-between font-bold">
            <span>TOTAL:</span>
            <span>${ticketImpresion.total.toFixed(2)}</span>
          </div>
          <center><p className="mt-4 text-[10px]">{ticketImpresion.fecha}</p></center>
      </div>

      <nav className="bg-slate-900 p-3 flex justify-between items-center shadow-xl no-print">
        <div className="flex items-center gap-4">
          <h1 className="text-blue-500 font-black italic text-xl">VD POS</h1>
          <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setVista('pos')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'pos' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>CAJA</button>
            <button onClick={() => setVista('inventario')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'inventario' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>STOCK</button>
            <button onClick={() => setVista('corte')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'corte' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>CORTE</button>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="text-red-500 font-black text-[10px] border border-red-500/30 px-3 py-2 rounded-xl">SALIR</button>
      </nav>

      {vista === 'pos' && (
        <main className="flex-1 flex overflow-hidden p-4 gap-4">
          <section className="flex-[3] grid grid-cols-2 md:grid-cols-4 gap-3 content-start overflow-y-auto">
            {catalogo.map(p => (
              <button key={p.id} onClick={() => agregarAlCarrito(p)} className="bg-white p-4 rounded-3xl shadow-sm border flex flex-col items-center hover:border-blue-500">
                <div className="text-2xl mb-1">{p.icono}</div>
                <h3 className="font-bold uppercase text-[10px]">{p.nombre}</h3>
                <p className="text-blue-600 font-black text-xs">${parseFloat(p.precio).toFixed(2)}</p>
                <span className="text-[8px] font-bold text-slate-400 mt-1">STOCK: {p.stock}</span>
              </button>
            ))}
          </section>
          <section className="flex-1 min-w-[300px] bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border">
              <div className="p-4 bg-slate-50 border-b font-black text-[10px] text-slate-400 uppercase tracking-widest">Carrito</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {carrito.map(i => (
                    <div key={i.id} className="flex justify-between items-center text-xs border-b pb-2">
                        <span>{i.cant}x {i.nombre}</span>
                        <span className="font-bold">${(i.precio * i.cant).toFixed(2)}</span>
                    </div>
                ))}
              </div>
              <div className="p-6 bg-slate-900 text-white">
                <div className="flex justify-between mb-4">
                    <span className="text-blue-400 font-black italic">TOTAL:</span>
                    <span className="text-2xl font-black text-green-400">${(carrito.reduce((a,b)=>a+(b.precio*b.cant),0)*1.16).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => finalizarVenta(false)} className="bg-slate-700 py-3 rounded-xl font-black text-[10px]">REGISTRAR</button>
                    <button onClick={() => finalizarVenta(true)} className="bg-blue-600 py-3 rounded-xl font-black text-[10px]">TICKET 🖨️</button>
                </div>
              </div>
          </section>
        </main>
      )}

      {vista === 'inventario' && (
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-xl mx-auto bg-white p-8 rounded-[2.5rem] shadow-xl border">
            <h2 className="font-black text-xl mb-6 italic uppercase">Gestión de Productos</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Nombre" className="w-full bg-slate-50 p-4 rounded-xl font-bold" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}/>
              <input type="number" placeholder="Precio" className="w-full bg-slate-50 p-4 rounded-xl font-bold" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}/>
              <input type="number" placeholder="Stock Inicial" className="w-full bg-slate-50 p-4 rounded-xl font-bold" value={nuevoProd.stock} onChange={e => setNuevoProd({...nuevoProd, stock: parseInt(e.target.value)})}/>
              <button onClick={async () => {
                  const { data } = await supabase.from('productos').insert([nuevoProd]).select();
                  if (data) setCatalogo([...catalogo, data[0]]);
                  setNuevoProd({nombre:'', precio:'', icono:'📦', stock: 0});
              }} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl">GUARDAR EN NUBE</button>
            </div>
            <div className="mt-8 space-y-2">
                {catalogo.map(p => (
                    <div key={p.id} className="flex justify-between border-b py-2 text-xs font-bold uppercase">
                        <span>{p.nombre} (Stock: {p.stock})</span>
                        <button onClick={async () => {
                            await supabase.from('productos').delete().eq('id', p.id);
                            setCatalogo(catalogo.filter(x => x.id !== p.id));
                        }} className="text-red-500">Eliminar</button>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}
      
      {/* VISTA CORTE (Sencilla para que no falle) */}
      {vista === 'corte' && (
          <main className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-xl mx-auto bg-white p-10 rounded-[3rem] shadow-xl text-center border">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total en Caja</p>
                  <h2 className="text-5xl font-black text-emerald-600 tracking-tighter">${historial.reduce((acc,v)=>acc+parseFloat(v.total),0).toFixed(2)}</h2>
                  <div className="mt-8 space-y-3">
                      {historial.map(v => (
                          <div key={v.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between text-[10px] font-bold">
                              <span>{new Date(v.fecha).toLocaleTimeString()}</span>
                              <span>${parseFloat(v.total).toFixed(2)}</span>
                          </div>
                      ))}
                  </div>
              </div>
          </main>
      )}
    </div>
  );
}
