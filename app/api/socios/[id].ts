import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      await pool.query('DELETE FROM socios WHERE id = $1', [id]);
      res.status(200).json({ message: 'Socio eliminado correctamente' });
    } catch (error) {
      res.status(500).json({ error: 'Error al eliminar socio' });
    }
  } else {
    res.setHeader('Allow', ['DELETE']);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}