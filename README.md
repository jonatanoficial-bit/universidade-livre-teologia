# Universidade Livre de Teologia

MVP de uma plataforma gratuita de cursos livres em teologia. O projeto trata a leitura como centro da aula, não cria paywall e separa cuidadosamente o catálogo planejado do conteúdo realmente publicado.

> Marca pública provisória. Antes de divulgar a marca, emitir certificados institucionais ou usar o nome de uma entidade emissora, faça a validação jurídica e institucional correspondente. Cursos livres não são diplomas de graduação nem reconhecimento pelo MEC.

## Entregue neste repositório

- Aplicação React + Vite + TypeScript responsiva, com rotas por hash adequadas ao GitHub Pages.
- Catálogo estruturado de 6 períodos, 24 disciplinas e 96 módulos. As 93 unidades sem texto aparecem como **Em desenvolvimento**, nunca como aulas disponíveis.
- Três aulas-piloto autorais no curso D01: texto orientado, objetivos, leitura por seções, referências e notas editoriais de revisão pendente.
- Minicurso fechado para testar conclusão, avaliação formativa e certificado de **demonstração**.
- Leitor com índice, navegação entre aulas, tamanho de fonte, tema, progresso local e anotações privadas no navegador.
- Vídeo do YouTube opcional e seguro: aceita apenas ID ou URL HTTPS de domínios YouTube, cria player após clique e mantém link alternativo para a origem.
- Painel editorial demonstrativo: novo curso, módulo, aula por blocos estruturados, rascunho, prévia, publicação/despublicação, importação e exportação JSON.
- PWA simples com cache local do shell do app, manifesto e ícone próprio.
- Regras Firestore e índices para a futura camada online, além de um workflow de deploy para GitHub Pages.

## Executar localmente

```bash
pnpm install
pnpm dev
```

Para validar a entrega:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Fluxos demonstráveis

### Visitante

1. Abra `#/cursos` e pesquise uma disciplina.
2. Entre em **Introdução ao Estudo da Teologia** e abra uma das três aulas publicadas, sem login.
3. Ajuste a fonte, leia a aula e avance para a próxima.
4. Note que o vídeo não é carregado sem uma ação explícita e que o texto continua útil sem ele.

### Estudante

1. Use `#/entrar` e escolha **Entrar como estudante**.
2. Conclua as três aulas do minicurso `#/curso/mini-metodo`.
3. Responda à avaliação com 70% ou mais.
4. A tela de emissão passa a liberar um certificado com marca d'água `DEMONSTRAÇÃO - SEM VALIDADE`; ele pode ser impresso como PDF local.

### Editora

1. Em `#/entrar`, escolha **Entrar como editora**.
2. Abra **Painel** e crie um curso, módulo e aula sem editar código.
3. Cole uma URL de YouTube válida e marque a aprovação somente depois da revisão humana.
4. Salve como rascunho, abra a prévia e publique/despublique. A persistência é em `localStorage`, portanto sobrevive ao recarregamento no mesmo navegador.

## Limites explícitos do modo demonstração

O produto no navegador está funcional para navegação, produção local de conteúdo e validação do desenho de experiência. Ele **não** usa login real, banco remoto, sincronização entre dispositivos, nem emissão institucional de certificados.

Isso é uma decisão de segurança: o browser não pode ser autoridade para papéis, notas ou certificados. Não há segredo, chave de serviço, emissor real ou CNPJ inserido neste repositório. A verificação de certificados do modo demo é deliberadamente apenas local e sinalizada na interface.

## Caminho para produção

1. Crie um projeto Firebase no plano compatível com a operação e habilite os provedores de login aprovados.
2. Copie `.env.example` para `.env.local` e preencha as chaves públicas de cliente. Nunca publique credenciais administrativas.
3. Revise, teste com o Emulator e implante `firebase/firestore.rules` e `firebase/firestore.indexes.json`.
4. Crie um endpoint confiável (por exemplo, Cloudflare Worker ou função de servidor) que valide o token do usuário, leia progresso e tentativas persistidos, confira a versão publicada do curso e faça emissão idempotente com token aleatório. Esse endpoint deve manter os segredos no provedor, não no app.
5. Substitua o adaptador de armazenamento local por Firestore para perfil, notas, tentativas e progresso; na entrada, ofereça a mesclagem consciente do progresso local com o perfil.
6. Configure entidade emissora, texto jurídico, política de privacidade, idade atendida e processo de revogação antes de habilitar certificado público verificável.
7. Para GitHub Pages, em **Settings → Pages**, escolha **GitHub Actions**. O workflow em `.github/workflows/deploy-pages.yml` constrói e publica o diretório `dist` a cada push em `main`.

## Modelo de conteúdo e importação

O painel exporta o formato completo em JSON. Para importar, o arquivo precisa conter as coleções `courses`, `modules`, `lessons` e, opcionalmente, `questions`. IDs estáveis são usados para substituir registros existentes; aulas importadas entram sempre como rascunho. O conteúdo é renderizado em blocos estruturados - parágrafos, títulos, listas e chamadas de atenção - e não aceita HTML arbitrário.

## Segurança e privacidade

- Validação de URL impede `javascript:`, iframes colados e hosts que não sejam YouTube.
- Links externos devem usar `rel="noopener noreferrer"`.
- As regras Firestore recusam criação de papel pelo cliente e reservam emissão/revogação de certificados ao servidor.
- Anotações, progresso e tentativas pertencem exclusivamente ao respectivo UID quando a camada online estiver configurada.
- O cache PWA é apenas para assets estáticos e não promete vídeo offline nem substitui backup.

## Decisões de produto

O conteúdo inicial é propositalmente pequeno: há três aulas-piloto e um minicurso técnico. A matriz de 24 disciplinas existe como planejamento curricular, mas nenhuma aula vazia ou referência fictícia é apresentada como publicada. A expansão editorial deve seguir lotes revisados, com autoria, referências, data, direitos e revisão humana registrados no CMS.
