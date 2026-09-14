export default function Capa() {
  return (
    <div className="relative w-full">
      {/* Foto de capa */}
      <div className="relative w-full h-[200px] sm:h-[260px] overflow-hidden">
        <img
          src="https://aghojttgeyvxwnvdjevt.supabase.co/storage/v1/object/public/fotos/imagem_2026-09-14_200535608.png"
          alt="Bom Sabor"
          className="w-full h-full object-cover"
        />
        {/* Composição: gradiente pra dar profundidade e legibilidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-transparent to-transparent" />
      </div>

      {/* Logo circular sobreposta, estilo capa + perfil */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-12 sm:-bottom-14">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-white shadow-xl overflow-hidden bg-white">
          <img
            src="https://aghojttgeyvxwnvdjevt.supabase.co/storage/v1/object/public/fotos/logo.jpg"
            alt="Bom Sabor"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}