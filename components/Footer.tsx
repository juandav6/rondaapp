export default function Footer() {
  return (
    <footer className="bg-gray-200 text-center py-4 mt-6">
      <p className="text-sm text-gray-700">
        © {new Date().getFullYear()} Mini Caja de Ahorros. Todos los derechos reservados.
      </p>
    </footer>
  );
}
