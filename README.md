# Motion Reel Studio v3 (HTML5, Sem FFMPEG)

Estúdio de criação de showreels verticais animados (9:16) gerados por IA via Gemini API, Canvas 2D e narração com Gemini TTS sincronizada.

---

## 🚀 Como Hospedar na Vercel (Guia Passo a Passo)

O projeto já está **100% configurado para a Vercel** com o arquivo `vercel.json` e o manipulador serverless `api/index.ts`.

### Passo 1: Enviar o Projeto para o GitHub / Git
Envie este repositório para o seu GitHub (ou GitLab / Bitbucket).

### Passo 2: Importar na Vercel
1. No painel da Vercel ([vercel.com](https://vercel.com)), clique em **"Add New..." &rarr; "Project"**.
2. Selecione o repositório do projeto.
3. As configurações de compilação são detectadas automaticamente:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

---

## 🔑 Gerenciamento de Chaves Gemini (Individuais por Usuário)

No deploy do sistema, **não é necessário configurar nenhuma variável de ambiente no servidor ou na Vercel**. Cada usuário adiciona e utiliza suas próprias chaves individuais diretamente na interface:

- **No Próprio Sistema (Cartão de Chaves na UI)**:
  - No cabeçalho ou no cartão **"Suas Chaves Gemini API"**, o usuário clica em **Configurar** / **Chaves Gemini**.
  - Cola sua própria chave ou lista de chaves (em lote ou uma a uma).
  - O sistema salva de forma segura e privada no `localStorage` do navegador do usuário.
  - A cada geração, as chaves são enviadas e o backend em Python faz o **rodízio inteligente** automático entre elas, com proteção de pausa de 60 segundos caso alguma atinja o limite gratuito (429).

---

## 🛠️ Tecnologias
- **Backend**: Python 3 puro (`motion_reel_studio.py`) + Express / Node.js
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Motor Gráfico**: HTML5 Canvas 2D nativo + biblioteca matemática `M`
- **Áudio**: Batida sintetizada Web Audio API + Gemini TTS (análise de volume reativa)
- **Exportação de Vídeo**: MediaRecorder nativo no navegador (MP4 / WebM sem ffmpeg)
