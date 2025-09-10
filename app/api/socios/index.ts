import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const result = await pool.query(`
        SELECT s.id, s.numeroCuenta, s.nombres, s.apellidos, s.cedula, s.edad, s.multas,
              COALESCE(SUM(a.monto), 0) AS ahorros
        FROM socios s
        LEFT JOIN ahorros a ON a.socio_id = s.id
        GROUP BY s.id, s.numeroCuenta, s.nombres, s.apellidos, s.cedula, s.edad, s.multas
        ORDER BY s.id
      `);
      res.status(200).json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener socios' });
    }
  } else if (req.method === 'POST') {
    const { numeroCuenta, nombres, apellidos, cedula, edad, ahorros, multas } = req.body;
    
    try {
      const result = await pool.query(
        'INSERT INTO socios (numeroCuenta, nombres, apellidos, cedula, edad, ahorros, multas) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [numeroCuenta, nombres, apellidos, cedula, edad, ahorros || 0, multas || 0]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Error al crear socio' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}