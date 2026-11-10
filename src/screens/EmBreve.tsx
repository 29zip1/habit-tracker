export default function EmBreve({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
    >
      <h1 className="text-[24px] font-bold">{titulo}</h1>
      <p className="text-[15px] text-texto2">Esta tela chega na {fase}.</p>
    </div>
  );
}
