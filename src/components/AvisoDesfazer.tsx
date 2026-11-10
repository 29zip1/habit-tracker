import type { Aviso } from '../hooks/useAviso';

/** RF-15: aviso acima da navegação, com "Desfazer" (botão de 44 px). */
export function AvisoDesfazer({ aviso, aoDesfazer }: { aviso: Aviso | null; aoDesfazer: () => void }) {
  if (!aviso) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-4 right-4 z-30 mx-auto flex max-w-[480px] items-center justify-between gap-2 rounded-[14px] py-1 pl-4 pr-1.5 text-white ${
        aviso.cruzou ? 'bg-verde' : 'bg-aviso'
      }`}
      style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 72px)' }}
    >
      <span className="text-[14px]">{aviso.rotulo}</span>
      <button
        type="button"
        onClick={aoDesfazer}
        className={`h-11 rounded-full border-0 bg-transparent px-3.5 text-[14px] font-bold ${
          aviso.cruzou ? 'text-white' : 'text-aviso-desfazer'
        }`}
      >
        Desfazer
      </button>
    </div>
  );
}
