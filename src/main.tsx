import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ProvedorPainel } from './estado/ProvedorPainel.tsx'
import { carregar } from './logica/armazenamento.ts'

// Fora dos componentes de propósito: carregar() pode gravar (a cópia do que não
// conseguiu ler), e o StrictMode chamaria um inicializador duas vezes.
const carregamento = carregar()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProvedorPainel inicial={carregamento}>
      <App />
    </ProvedorPainel>
  </StrictMode>,
)
