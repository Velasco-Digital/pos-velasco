// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function VelascoPOS_Ultra_Detailed() {
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
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md text-center">
          <h1 className="text-blue-600 font-black italic text-4xl mb-2">VD <span className="text-slate-900 not-italic">POS</span></h1>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-8 font-bold">Seguridad Velasco Digital</p>
          <input type="email" placeholder="Correo" className="w-full bg-slate-100 p-4 rounded-2xl mb-4 text-black font-bold outline-none border-2 border-transparent focus:border-blue-500" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Contraseña" className="w-full bg-slate-100 p-4 rounded-2xl mb-8 text-black font-bold outline-none border-2 border-transparent focus:border-blue-500" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl">ACCEDER AL SISTEMA</button>
        </div>
      </div>
    );
  }

  if (!montado) return null;

  return (
    <div className="bg-slate-100 h-screen flex flex-col font-sans overflow-hidden text-black">
      
      {/* CSS PARA TICKET (Respetando el ancho de 80mm que pediste) */}
      <style>{`
        @media screen { #printable-ticket { display: none; } }
        @media print {
            body * { visibility: hidden !important; }
            #printable-ticket, #printable-ticket * { visibility: visible !important; }
            #printable-ticket { 
                position: absolute; left: 0; top: 0; 
                width: 80mm !important; 
                padding: 5mm;
                font-family: 'Courier New', Courier, monospace !important;
                color: black !important;
            }
        }
      `}</style>

      {/* DISEÑO DEL TICKET */}
      <div id="printable-ticket">
          <center>
            <h2 style={{fontSize: '18px', fontWeight: '900', margin: 0}}>VELASCO DIGITAL</h2>
            <p style={{fontSize: '10px', margin: '5px 0'}}>Ticket de Compra</p>
            <p>===============================</p>
          </center>
          <div style={{fontSize: '11px', margin: '15px 0'}}>
            {ticketImpresion.items.map((it, idx) => (
                <div key={idx} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '3px'}}>
                    <span>{it.cant}x {it.nombre}</span>
                    <span>${(it.precio * it.cant).toFixed(2)}</span>
                </div>
            ))}
          </div>
          <p>===============================</p>
          <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px'}}>
            <span>TOTAL:</span>
            <span>${ticketImpresion.total.toFixed(2)}</span>
          </div>
          <center>
            <p style={{marginTop: '15px', fontSize: '10px'}}>{ticketImpresion.fecha}</p>
            <p style={{fontSize: '9px'}}>*** Gracias por su compra ***</p>
          </center>
      </div>

      {/* NAVBAR */}
      <nav className="bg-slate-900 p-3 flex justify-between items-center shadow-xl border-b-2 border-blue-600 no-print">
        <div className="flex items-center gap-4">
          <h1 className="text-blue-500 font-black italic text-xl px-2">VD <span className="text-white font-light uppercase">POS</span></h1>
          <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setVista('pos')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'pos' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>CAJA</button>
            <button onClick={() => setVista('inventario')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'inventario' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>STOCK</button>
            <button onClick={() => setVista('corte')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'corte' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>CORTE</button>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="text-red-500 font-black text-[10px] uppercase border border-red-500/20 px-3 py-2 rounded-xl">Cerrar Sesión</button>
      </nav>

      {/* VISTA POS */}
      {vista === 'pos' && (
        <main className="flex-1 flex overflow-hidden p-4 gap-4 animate-in fade-in">
          <section className="flex-[3] grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 content-start overflow-y-auto pr-2">
            {catalogo.map(p => (
              <button key={p.id} onClick={() => agregarAlCarrito(p)} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 hover:border-blue-500 active:scale-95 transition-all flex flex-col items-center">
                <div className="text-3xl mb-2">{p.icono}</div>
                <h3 className="font-bold text-slate-800 uppercase text-[10px] text-center mb-1">{p.nombre}</h3>
                <p className="text-blue-600 font-black text-sm">${parseFloat(p.precio).toFixed(2)}</p>
                <div className={`mt-2 px-3 py-1 rounded-full text-[8px] font-black uppercase ${p.stock > 10 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>Stock: {p.stock}</div>
              </button>
            ))}
          </section>

          <section className="flex-1 min-w-[320px] bg-white rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border">
              <div className="p-6 bg-slate-50 border-b flex justify-between items-center font-black text-[10px] text-slate-400 uppercase tracking-widest">
                <span>Venta actual</span>
                <button onClick={() => setCarrito([])} className="text-red-400">Limpiar</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {carrito.map(i => (
                    <div key={i.id} className="flex justify-between items-center text-xs border-b border-dashed pb-3">
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
                    <button onClick={() => finalizarVenta(false)} className="bg-slate-700 py-5 rounded-[1.5rem] font-black text-[10px] uppercase">Solo Registro</button>
                    <button onClick={() => finalizarVenta(true)} className="bg-blue-600 py-5 rounded-[1.5rem] font-black text-[10px] uppercase shadow-lg shadow-blue-500/30">Generar Ticket</button>
                </div>
              </div>
          </section>
        </main>
      )}

      {/* VISTA CORTE (CON DETALLE DE PRODUCTOS) */}
      {vista === 'corte' && (
        <main className="flex-1 p-8 overflow-y-auto animate-in fade-in">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Header de Dinero con estética Premium */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-12 rounded-[3.5rem] text-white shadow-2xl flex justify-between items-center relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 text-[12rem] text-white/10 rotate-12 transition-transform group-hover:scale-110">💸</div>
                <div className="z-10">
                    <p className="text-[10px] font-black uppercase opacity-70 tracking-[0.3em] mb-3">Ingresos Totales Hoy</p>
                    <h2 className="text-6xl font-black tracking-tighter tabular-nums">${historial.reduce((acc,v)=>acc+parseFloat(v.total),0).toFixed(2)}</h2>
                </div>
                <div className="z-10 bg-white/20 p-5 rounded-full backdrop-blur-md">
                    <span className="text-3xl">💹</span>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-black text-slate-800 uppercase italic text-xl tracking-tighter px-2">Historial Detallado</h3>
                {historial.map(v => (
                    <div key={v.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border-l-8 border-emerald-500 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">{new Date(v.fecha).toLocaleTimeString()}</span>
                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Venta #{v.id}</span>
                            </div>
                            <span className="font-black text-slate-900 text-xl tabular-nums">${parseFloat(v.total).toFixed(2)}</span>
                        </div>
                        
                        {/* ESTA ES LA MAGIA: Detalle de productos vendidos */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Productos:</p>
                            <div className="flex flex-wrap gap-2">
                                {v.items.map((item, idx) => (
                                    <span key={idx} className="bg-white px-3 py-1 rounded-lg border text-[10px] font-bold text-slate-700">
                                        {item.cant}x {item.nombre}
                                    </span>
                                ))}
                            </div>
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
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-indigo-50">
              <h2 className="font-black text-2xl mb-8 italic uppercase text-slate-800 tracking-tighter text-center">Gestión de Productos</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nombre" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}/>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Precio" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}/>
                    <input type="number" placeholder="Stock" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none" value={nuevoProd.stock} onChange={e => setNuevoProd({...nuevoProd, stock: parseInt(e.target.value)})}/>
                </div>
                <button onClick={async () => {
                    const { data } = await supabase.from('productos').insert([nuevoProd]).select();
                    if (data) setCatalogo([...catalogo, data[0]]);
                    setNuevoProd({nombre:'', precio:'', icono:'📦', stock: 0});
                }} className="w-full bg-slate-900 text-white font-black py-5 rounded-[1.5rem] shadow-xl uppercase text-[10px] tracking-widest">Añadir al Sistema</button>
              </div>
            </div>
            {/* Lista rápida de eliminación */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
                {catalogo.map(p => (
                    <div key={p.id} className="p-4 border-b flex justify-between items-center text-[10px] font-bold uppercase">
                        <span>{p.nombre} ({p.stock} pz)</span>
                        <button onClick={async () => {
                            await supabase.from('productos').delete().eq('id', p.id);
                            setCatalogo(catalogo.filter(x => x.id !== p.id));
                        }} className="text-red-400">Eliminar</button>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

    </div>
  );
}
