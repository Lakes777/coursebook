/**
 * O logo do Coursebook: uma grade de horários 3×3 com a "aula de agora" acesa em bordô.
 * É decorativo (o nome vem escrito ao lado), então fica escondido do leitor de tela.
 */
export function LogoGrade({ tamanho = 26 }: { tamanho?: number }) {
  return (
    <svg
      className="icone logo-grade"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="24" height="24" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 1v24M17 1v24M1 9h24M1 17h24" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9.8" y="9.8" width="6.4" height="6.4" fill="var(--marca)" />
    </svg>
  )
}
