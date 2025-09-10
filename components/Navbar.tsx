"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav style={{background: 'linear-gradient(to right, #1e40af, #2563eb)', color: 'white', padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}}>
      <div style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <Link href="/" style={{display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none'}}>
          <div style={{background: 'white', padding: '0.5rem', borderRadius: '9999px', transition: 'transform 0.3s', width: '3rem', height: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              style={{color: '#1d4ed8', width: '1.5rem', height: '1.5rem'}}
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 style={{fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '-0.025em'}}>Mini Caja de Ahorros</h1>
        </Link>
        
        <div style={{display: 'flex', gap: '0.5rem'}}>
          <Link 
            href="/" 
            style={{
              position: 'relative',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: pathname === '/' ? '#1d4ed8' : 'white',
              background: pathname === '/' ? 'white' : 'transparent',
              fontWeight: pathname === '/' ? '600' : 'normal'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" style={{width: '1.25rem', height: '1.25rem', marginRight: '0.5rem'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Inicio
            {pathname === '/' && (
              <span style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80%',
                height: '2px',
                backgroundColor: '#1d4ed8',
                borderRadius: '2px 2px 0 0'
              }}></span>
            )}
          </Link>
          
          <Link 
            href="/socios" 
            style={{
              position: 'relative',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: pathname === '/socios' ? '#1d4ed8' : 'white',
              background: pathname === '/socios' ? 'white' : 'transparent',
              fontWeight: pathname === '/socios' ? '600' : 'normal'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" style={{width: '1.25rem', height: '1.25rem', marginRight: '0.5rem'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Socios
            {pathname === '/socios' && (
              <span style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80%',
                height: '2px',
                backgroundColor: '#1d4ed8',
                borderRadius: '2px 2px 0 0'
              }}></span>
            )}
          </Link>
          
          <Link 
            href="/informacion" 
            style={{
              position: 'relative',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: pathname === '/informacion' ? '#1d4ed8' : 'white',
              background: pathname === '/informacion' ? 'white' : 'transparent',
              fontWeight: pathname === '/informacion' ? '600' : 'normal'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" style={{width: '1.25rem', height: '1.25rem', marginRight: '0.5rem'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Información
            {pathname === '/informacion' && (
              <span style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80%',
                height: '2px',
                backgroundColor: '#1d4ed8',
                borderRadius: '2px 2px 0 0'
              }}></span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}