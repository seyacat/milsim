import React, { useEffect, useRef } from 'react';

interface ControlPointMenuProps {
  position: { lat: number; lng: number };
  onClose: () => void;
  onCreateControlPoint: (lat: number, lng: number) => void;
}

export const ControlPointMenu: React.FC<ControlPointMenuProps> = ({ position, onClose, onCreateControlPoint }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  const handleCreateControlPoint = () => {
    onCreateControlPoint(position.lat, position.lng);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.95)',
        border: '2px solid #4CAF50',
        borderRadius: '8px',
        padding: '20px',
        zIndex: 9999,
        minWidth: '220px',
        boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '5px',
          textAlign: 'center'
        }}>
          Crear Punto de Control
        </div>
        <button
          onClick={handleCreateControlPoint}
          style={{
            padding: '10px 20px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            width: '100%',
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#45a049'}
          onMouseOut={(e) => e.currentTarget.style.background = '#4CAF50'}
        >
          Crear
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            color: '#ccc',
            border: '1px solid #666',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            width: '100%'
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};