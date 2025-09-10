export default function InformacionPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Información de la Caja de Ahorros</h2>
      <p>
        Nuestra mini caja de ahorros fue creada con el objetivo de fomentar la cultura del ahorro 
        entre nuestros socios. Ofrecemos un sistema transparente y accesible para todos.
      </p>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-semibold">📜 Misión</h3>
        <p>Brindar a nuestros socios un espacio seguro para ahorrar y crecer juntos.</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-semibold">👥 Visión</h3>
        <p>Ser reconocidos como una comunidad sólida y responsable en el manejo de ahorros.</p>
      </div>
    </div>
  );
}
