import React from 'react';
import { Badge } from 'react-bootstrap';

const StatusBadge = ({ status }) => {
  const s = String(status || '').toLowerCase();
  let variant = 'secondary';
  let label = status || '—';

  switch (s) {
    // Idoso
    case 'internado':
      variant = 'info';
      label = 'Institucionalizado';
      break;
    case 'nao_internado':
      variant = 'secondary';
      label = 'Não Institucionalizado';
      break;
    // Quarto
    case 'disponivel':
      variant = 'success';
      label = 'Disponível';
      break;
    case 'ocupado':
      variant = 'danger';
      label = 'Ocupado';
      break;
    default:
      variant = 'secondary';
      label = status || '—';
  }

  return (
    <Badge bg={variant} className="status-badge">
      {label}
    </Badge>
  );
};

export default StatusBadge;
