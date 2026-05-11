import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
 
const prisma = new PrismaClient();
 
async function main() {
  const email = "admin@mironda.com";      // ← cambia si quieres
  const password = "mironda2024";          // ← cambia a tu contraseña
  const nombre = "Administrador";
 
  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) {
    console.log("⚠️  Usuario ya existe:", email);
    return;
  }
 
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.usuario.create({
    data: { email, passwordHash, nombre, rol: "ADMIN" },
  });
 
  console.log("✅ Usuario admin creado:");
  console.log("   Email:", email);
  console.log("   Contraseña:", password);
  console.log("   ID:", user.id);
}
 
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());